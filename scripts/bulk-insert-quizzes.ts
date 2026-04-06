/**
 * 생성된 퀴즈 JSON → quizzes 테이블 벌크 인서트
 * 기존 퀴즈와 중복 방지 (question 기준)
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const IN_FILE = path.resolve(__dirname, '../data/generated-quizzes.json');
const BATCH_SIZE = 50; // Supabase insert 한 번에 50개씩

interface Quiz {
  question: string;
  choices: string[];
  correct_answer: number;
  brief_explanation: string;
  detailed_explanation: string;
  source: string;
  category: string;
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY가 .env에 없습니다.');
  }

  if (!fs.existsSync(IN_FILE)) {
    throw new Error(`${IN_FILE} 파일이 없습니다. generate-quizzes.ts를 먼저 실행하세요.`);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const quizzes: Quiz[] = JSON.parse(fs.readFileSync(IN_FILE, 'utf-8'));
  console.log(`=== 벌크 인서트 시작: ${quizzes.length}개 ===`);

  // 기존 퀴즈 question 목록 조회 (중복 방지)
  const { data: existing } = await supabase
    .from('quizzes')
    .select('question');

  const existingQuestions = new Set(
    (existing || []).map((q: any) => q.question),
  );
  console.log(`기존 퀴즈: ${existingQuestions.size}개`);

  const newQuizzes = quizzes.filter((q) => !existingQuestions.has(q.question));
  console.log(`새 퀴즈: ${newQuizzes.length}개 (중복 제외: ${quizzes.length - newQuizzes.length}개)`);

  if (newQuizzes.length === 0) {
    console.log('삽입할 새 퀴즈가 없습니다.');
    return;
  }

  // 배치 인서트
  let inserted = 0;
  for (let i = 0; i < newQuizzes.length; i += BATCH_SIZE) {
    const batch = newQuizzes.slice(i, i + BATCH_SIZE);
    const rows = batch.map((q) => ({
      question: q.question,
      choices: q.choices,
      correct_answer: q.correct_answer,
      brief_explanation: q.brief_explanation,
      detailed_explanation: q.detailed_explanation,
      source: q.source,
      category: q.category,
    }));

    const { error } = await supabase.from('quizzes').insert(rows);

    if (error) {
      console.error(`배치 ${Math.floor(i / BATCH_SIZE) + 1} 실패:`, error.message);
    } else {
      inserted += batch.length;
      console.log(`  ${inserted}/${newQuizzes.length} 삽입 완료`);
    }
  }

  console.log(`\n=== 완료: ${inserted}개 삽입 ===`);

  // 최종 확인
  const { count } = await supabase
    .from('quizzes')
    .select('*', { count: 'exact', head: true });

  console.log(`quizzes 테이블 총 퀴즈 수: ${count}개`);
}

main().catch((e) => {
  console.error('실패:', e.message);
  process.exit(1);
});
