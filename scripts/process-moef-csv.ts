/**
 * 재경부 시사경제퀴즈 CSV → 톤 조절 + 비금융 필터링 → DB 삽입
 * CSV 파일을 읽어서 Claude API로 톤을 기존 퀴즈 스타일에 맞추고
 * 비금융 문제는 제외한 뒤 quizzes 테이블에 삽입
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import * as iconv from 'iconv-lite';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const CSV_PATH = '/Users/sieun/Downloads/재정경제부_시사경제퀴즈_20250829.csv';
const OUT_FILE = path.resolve(__dirname, '../data/moef-quizzes-processed.json');
const BATCH_SIZE = 5;

interface RawQuiz {
  번호: string;
  구분: string;
  문제내용: string;
  보기1: string;
  보기2: string;
  보기3: string;
  보기4: string;
  정답: string;
  해설: string;
}

interface Quiz {
  question: string;
  choices: string[];
  correct_answer: number;
  brief_explanation: string;
  detailed_explanation: string;
  source: string;
  category: string;
}

/** CSV 파싱 — EUC-KR 인코딩, 콤마 구분, 따옴표 필드 지원 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function readCSV(filePath: string): RawQuiz[] {
  const buf = fs.readFileSync(filePath);
  const content = iconv.decode(buf, 'euc-kr');
  const lines = content.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim());

  const header = parseCSVLine(lines[0]);
  console.log('CSV 헤더:', header);

  return lines.slice(1).map((line) => {
    const cols = parseCSVLine(line);
    const row: any = {};
    header.forEach((h, i) => {
      row[h.trim()] = (cols[i] || '').trim();
    });
    return row as RawQuiz;
  });
}

function parseCorrectAnswer(raw: string, type: string): number {
  if (type.includes('OX')) {
    return raw.includes('O') ? 1 : 2;
  }
  const match = raw.match(/(\d)/);
  return match ? parseInt(match[1]) : 1;
}

function toRawQuiz(row: RawQuiz): Quiz {
  const isOX = row.구분.includes('OX');
  const choices = isOX
    ? ['O (맞다)', 'X (틀리다)']
    : [row.보기1, row.보기2, row.보기3, row.보기4].filter(Boolean);

  return {
    question: row.문제내용,
    choices,
    correct_answer: parseCorrectAnswer(row.정답, row.구분),
    brief_explanation: row.해설.slice(0, 100),
    detailed_explanation: row.해설,
    source: '재경부 시사경제퀴즈',
    category: '경제상식',
  };
}

const client = new Anthropic();

const SYSTEM_PROMPT = `너는 머니런 앱의 퀴즈 톤 조절 담당이야.

기존 퀴즈 스타일 예시:
- brief: "최소 월 생활비 3개월분이 권장돼요. 실직이나 긴급 상황에 대비할 수 있는 최소 안전망이에요."
- detailed: "**비상금**은 예상치 못한 상황에 대비하는 자금이야. 전문가들은 최소 **월 생활비 3~6개월분**을 권장해."

규칙:
1. 반말 + 친근한 톤 (이야, ~거야, ~돼, ~해 등)
2. brief_explanation: 1~2문장, 핵심만
3. detailed_explanation: 2~4문장, 쉬운 설명, 마크다운 볼드 활용
4. 원본 팩트는 절대 변경하지 마 — 톤만 바꿔
5. 비금융 문제(과학, IT, 역사 등 금융/경제/투자와 관련 없는 것)는 skip: true로 표시
6. category: 투자기초, 저축, 경제상식, 금융제도, 세금, 부동산, 보험, 자산관리 중 선택

JSON 배열로만 응답해.`;

async function adjustToneBatch(quizzes: Quiz[]): Promise<(Quiz & { skip?: boolean })[]> {
  const input = quizzes.map((q, i) => ({
    index: i,
    question: q.question,
    choices: q.choices,
    correct_answer: q.correct_answer,
    brief_explanation: q.brief_explanation,
    detailed_explanation: q.detailed_explanation,
  }));

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `다음 ${quizzes.length}개 퀴즈의 톤을 조절해줘. 비금융 문제는 skip: true로 표시.

${JSON.stringify(input, null, 2)}

응답 형식:
[{
  "index": 0,
  "skip": false,
  "brief_explanation": "조절된 간단 설명",
  "detailed_explanation": "조절된 상세 설명",
  "category": "카테고리"
}]`,
      },
    ],
  });

  const text = message.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as any).text)
    .join('');

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.warn('JSON 파싱 실패, 원본 유지');
    return quizzes;
  }

  const adjusted: any[] = JSON.parse(jsonMatch[0]);
  return quizzes.map((q, i) => {
    const adj = adjusted.find((a: any) => a.index === i);
    if (!adj) return q;
    if (adj.skip) return { ...q, skip: true };
    return {
      ...q,
      brief_explanation: adj.brief_explanation || q.brief_explanation,
      detailed_explanation: adj.detailed_explanation || q.detailed_explanation,
      category: adj.category || q.category,
    };
  });
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY가 .env에 없습니다.');
  }

  console.log('=== 재경부 시사경제퀴즈 처리 시작 ===');

  // 1. CSV 파싱 (EUC-KR → UTF-8 변환)
  const rows = readCSV(CSV_PATH);
  console.log(`CSV 파싱: ${rows.length}개 문항`);

  // 2. 기본 변환
  const rawQuizzes = rows.map(toRawQuiz).filter((q) => q.question);
  console.log(`기본 변환: ${rawQuizzes.length}개`);

  // 3. AI 톤 조절 (배치)
  const batches = chunk(rawQuizzes, BATCH_SIZE);
  const allProcessed: Quiz[] = [];
  let skipped = 0;

  for (let i = 0; i < batches.length; i++) {
    console.log(`톤 조절 배치 ${i + 1}/${batches.length}...`);
    try {
      const results = await adjustToneBatch(batches[i]);
      for (const r of results) {
        if ((r as any).skip) {
          skipped++;
          console.log(`  [스킵] ${r.question.slice(0, 40)}...`);
        } else {
          allProcessed.push(r);
        }
      }
    } catch (e: any) {
      console.error(`  배치 실패: ${e.message}, 원본 유지`);
      allProcessed.push(...batches[i]);
    }

    // rate limit
    if (i < batches.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log(`\n톤 조절 완료: ${allProcessed.length}개 (스킵: ${skipped}개)`);

  // 4. 결과 저장 (DB 삽입은 Supabase CLI로 별도 진행)
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(allProcessed, null, 2), 'utf-8');
  console.log(`저장: ${OUT_FILE}`);
  console.log(`\nDB 삽입은 Supabase CLI로 별도 진행하세요.`);
}

main().catch((e) => {
  console.error('실패:', e.message);
  process.exit(1);
});
