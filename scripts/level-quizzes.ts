/**
 * 퀴즈 난이도 레벨링 스크립트
 * - DB에서 전체 퀴즈 로드
 * - Claude API로 배치 분석 (20개씩)
 * - difficulty_level 1~5 업데이트
 *
 * 레벨 기준:
 *   1 (입문):  일상생활 금융 기초 — 가계, 저축, 소비 등 누구나 아는 개념
 *   2 (초급):  기본 금융상식 — 예금/적금, 기초 세금, 보험 기본, 기초 투자 개념
 *   3 (중급):  실무 금융지식 — 재무비율, 금융제도, 투자지표, 경제정책 기본
 *   4 (고급):  전문 금융지식 — 파생상품, 국제금융, 구체적 법률/규제, 복잡한 경제이론
 *   5 (전문가): 전문가 수준 — 고급 파생상품 구조, 특수 금융기법, 심화 경제모델
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const BATCH_SIZE = 20;
const OUT_FILE = path.resolve(__dirname, '../data/quiz-levels.json');

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
const anthropic = new Anthropic();

interface QuizRow {
  id: string;
  question: string;
  choices: string[];
  category: string;
  source: string;
}

const SYSTEM_PROMPT = `너는 금융/경제 교육 전문가야. 퀴즈의 난이도를 1~5로 분류해.

레벨 기준:
- 1 (입문): 일상생활에서 접하는 기초 금융 개념. 가계, 소비, 저축의 기본 정의. 금융 비전공자도 쉽게 풀 수 있는 수준.
  예: "가계의 정의는?", "소비지출에 포함되지 않는 것은?"

- 2 (초급): 기본적인 금융상식. 예금/적금 차이, 기초적인 세금/보험 개념, 단순한 경제 용어.
  예: "MMDA란?", "보험료의 정의는?", "흑자를 계산하는 공식은?"

- 3 (중급): 실무에서 쓰이는 금융지식. 재무비율(ROE, BIS 등), 금융제도, 투자 지표, 경제정책 기본 원리.
  예: "자기자본경상이익률이란?", "자금순환표의 구성요소가 아닌 것은?", "래퍼곡선 설명으로 옳지 않은 것은?"

- 4 (고급): 전문적인 금융지식. 파생상품(CDO, CDS 등), 국제금융 이론, 구체적인 금융법률/규제, 복잡한 경제모델.
  예: "부채담보부증권(CDO)이란?", "금리평가이론 설명으로 옳지 않은 것은?", "그램-리치-블라일리법이란?"

- 5 (전문가): 전문가/실무자 수준. 고급 파생상품 구조, 특수 금융기법, 심화 계량경제 모델, 매우 세부적인 규제 지식.
  예: 고급 옵션 전략, 바젤 III 세부 규정, 복잡한 구조화상품

중요 규칙:
1. O/X(참/거짓) 퀴즈라도 내용이 어려우면 높은 레벨 부여 (형식이 아닌 내용 기준)
2. 용어 자체의 전문성 + 보기의 변별력 + 필요한 배경지식을 종합 판단
3. 골고루 분포시키되, 실제 난이도에 맞게 (억지로 균등 분배하지 마)
4. JSON 배열로만 응답. 다른 텍스트 없이.

응답 형식: [{"id": "quiz-uuid", "level": 3}, ...]`;

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function levelBatch(quizzes: QuizRow[]): Promise<Array<{ id: string; level: number }>> {
  const quizList = quizzes
    .map(
      (q, i) =>
        `${i + 1}. [ID: ${q.id}] [카테고리: ${q.category}] [출처: ${q.source}]\n   문제: ${q.question}\n   보기: ${JSON.stringify(q.choices)}`,
    )
    .join('\n\n');

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `다음 ${quizzes.length}개 퀴즈의 난이도 레벨(1~5)을 판정해줘.\n\n${quizList}`,
      },
    ],
  });

  const text = message.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as any).text)
    .join('');

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.warn('  JSON 파싱 실패, 스킵');
    return [];
  }

  const parsed: Array<{ id: string; level: number }> = JSON.parse(jsonMatch[0]);

  // 유효성 검증
  return parsed
    .filter((r) => r.id && r.level >= 1 && r.level <= 5)
    .map((r) => ({ id: r.id, level: Math.round(r.level) }));
}

async function main() {
  console.log('=== 퀴즈 난이도 레벨링 시작 ===\n');

  // 1. DB에서 전체 퀴즈 로드
  const { data: quizzes, error } = await supabase
    .from('quizzes')
    .select('id, question, choices, category, source')
    .order('created_at', { ascending: true });

  if (error || !quizzes) {
    throw new Error(`퀴즈 조회 실패: ${error?.message}`);
  }

  console.log(`총 ${quizzes.length}개 퀴즈 로드\n`);

  // 2. 배치 레벨링
  const batches = chunk(quizzes as QuizRow[], BATCH_SIZE);
  const allResults: Array<{ id: string; level: number }> = [];

  for (let i = 0; i < batches.length; i++) {
    console.log(`배치 ${i + 1}/${batches.length} (${batches[i].length}개)...`);
    try {
      const results = await levelBatch(batches[i]);
      allResults.push(...results);
      console.log(`  → ${results.length}개 레벨링 완료 (누적: ${allResults.length})`);
    } catch (e: any) {
      console.error(`  → 배치 실패: ${e.message}`);
    }

    // rate limit 대비
    if (i < batches.length - 1) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  // 3. 결과 저장 (백업)
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(allResults, null, 2), 'utf-8');
  console.log(`\n레벨링 결과 저장: ${OUT_FILE}`);

  // 4. 분포 확인
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  allResults.forEach((r) => {
    dist[r.level] = (dist[r.level] || 0) + 1;
  });
  console.log('\n레벨 분포:');
  for (let lv = 1; lv <= 5; lv++) {
    const count = dist[lv] || 0;
    const bar = '█'.repeat(Math.round(count / 3));
    console.log(`  Level ${lv}: ${String(count).padStart(3)}개 ${bar}`);
  }

  // 5. DB 업데이트
  console.log('\nDB 업데이트 시작...');
  let updated = 0;
  let failed = 0;

  // 10개씩 배치 업데이트
  const updateBatches = chunk(allResults, 10);
  for (const batch of updateBatches) {
    const promises = batch.map((r) =>
      supabase
        .from('quizzes')
        .update({ difficulty_level: r.level })
        .eq('id', r.id),
    );

    const results = await Promise.all(promises);
    results.forEach((res) => {
      if (res.error) {
        failed++;
      } else {
        updated++;
      }
    });
  }

  console.log(`\n=== 완료 ===`);
  console.log(`성공: ${updated}개 / 실패: ${failed}개 / 전체: ${allResults.length}개`);
}

main().catch((e) => {
  console.error('실패:', e.message);
  process.exit(1);
});
