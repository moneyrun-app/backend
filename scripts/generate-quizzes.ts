/**
 * 수집된 용어 데이터 → Claude API로 퀴즈 배치 생성
 * - 정답/팩트는 원본 데이터 그대로 (할루시네이션 제로)
 * - AI는 오답 보기 3개 생성 + 설명 다듬기만 담당
 * - 10개씩 배치 처리 (토큰 효율)
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import Anthropic from '@anthropic-ai/sdk';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const OUT_FILE = path.resolve(__dirname, '../data/generated-quizzes.json');
const BATCH_SIZE = 10;

interface Term {
  name: string;
  definition: string;
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

const client = new Anthropic();

const SYSTEM_PROMPT = `너는 금융/경제 교육 퀴즈 생성기야.
주어진 용어와 정의를 바탕으로 객관식 퀴즈를 만들어.

규칙:
1. 정답은 반드시 원본 정의에서 나온 내용이어야 해 (절대 지어내지 마)
2. 오답 보기 3개는 그럴듯하지만 명확히 틀린 것으로 만들어
3. 보기는 총 4개, 정답 위치는 랜덤 (1~4번)
4. brief_explanation: 1~2문장으로 핵심 포인트
5. detailed_explanation: 2~3문장으로 이해하기 쉽게 설명 (마크다운 볼드 가능)
6. category는 다음 중 선택: 투자기초, 저축, 경제상식, 금융제도, 세금, 부동산, 보험, 자산관리

JSON 배열로만 응답해. 다른 텍스트 없이.`;

function buildUserPrompt(terms: Term[], source: string): string {
  const list = terms
    .map((t, i) => `${i + 1}. 용어: ${t.name}\n   정의: ${t.definition}`)
    .join('\n\n');

  return `다음 ${terms.length}개 용어로 퀴즈를 만들어줘.
각 용어당 1개 퀴즈, 총 ${terms.length}개.

${list}

응답 형식 (JSON 배열):
[{
  "question": "문제 텍스트",
  "choices": ["보기1", "보기2", "보기3", "보기4"],
  "correct_answer": 정답번호(1~4),
  "brief_explanation": "간단 설명",
  "detailed_explanation": "상세 설명",
  "category": "카테고리"
}]`;
}

async function generateBatch(terms: Term[], source: string): Promise<Quiz[]> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(terms, source) }],
  });

  const text = message.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as any).text)
    .join('');

  // JSON 추출 (```json ... ``` 감싸진 경우 대응)
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.warn('JSON 파싱 실패, 스킵:', text.slice(0, 200));
    return [];
  }

  const parsed: any[] = JSON.parse(jsonMatch[0]);
  return parsed.map((q) => ({
    question: q.question,
    choices: q.choices,
    correct_answer: q.correct_answer,
    brief_explanation: q.brief_explanation,
    detailed_explanation: q.detailed_explanation,
    source,
    category: q.category || '경제상식',
  }));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function processSource(filePath: string, source: string): Promise<Quiz[]> {
  if (!fs.existsSync(filePath)) {
    console.log(`[스킵] ${filePath} 파일 없음`);
    return [];
  }

  const terms: Term[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log(`\n[${source}] ${terms.length}개 용어 → 퀴즈 변환 시작`);

  const quizzes: Quiz[] = [];
  const batches = chunk(terms, BATCH_SIZE);

  for (let i = 0; i < batches.length; i++) {
    console.log(`  배치 ${i + 1}/${batches.length} (${batches[i].length}개)...`);
    try {
      const batch = await generateBatch(batches[i], source);
      quizzes.push(...batch);
      console.log(`  → ${batch.length}개 생성 (누적: ${quizzes.length}개)`);
    } catch (e: any) {
      console.error(`  → 배치 실패: ${e.message}`);
    }

    // API rate limit 대비 — 1초 간격
    if (i < batches.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return quizzes;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY가 .env에 없습니다.');
  }

  console.log('=== AI 퀴즈 배치 생성 시작 ===');

  const allQuizzes: Quiz[] = [];

  // 재경부는 이미 퀴즈 형태 → 그대로 로드
  const moefPath = path.resolve(__dirname, '../data/moef-quizzes.json');
  if (fs.existsSync(moefPath)) {
    const moef: Quiz[] = JSON.parse(fs.readFileSync(moefPath, 'utf-8'));
    allQuizzes.push(...moef);
    console.log(`[재경부] ${moef.length}개 퀴즈 로드 (변환 불필요)`);
  }

  // 예탁결제원 용어 → 퀴즈
  const seibroQuizzes = await processSource(
    path.resolve(__dirname, '../data/seibro-terms.json'),
    '예탁결제원 금융용어',
  );
  allQuizzes.push(...seibroQuizzes);

  // ECOS 경제용어 → 퀴즈
  const ecosQuizzes = await processSource(
    path.resolve(__dirname, '../data/ecos-words.json'),
    'ECOS 경제용어',
  );
  allQuizzes.push(...ecosQuizzes);

  console.log(`\n=== 전체 ${allQuizzes.length}개 퀴즈 생성 완료 ===`);

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(allQuizzes, null, 2), 'utf-8');
  console.log(`저장: ${OUT_FILE}`);
}

main().catch((e) => {
  console.error('실패:', e.message);
  process.exit(1);
});
