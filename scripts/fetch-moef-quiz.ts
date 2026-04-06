/**
 * 재경부 시사경제퀴즈 수집
 * 소스: https://www.data.go.kr/data/15131287/fileData.do
 * 이미 퀴즈 형태 → 변환 없이 바로 사용 가능
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_URL =
  'https://api.odcloud.kr/api/15131287/v1/uddi:28b321b1-0351-4451-956c-8e197151877f';
const API_KEY = process.env.DATA_GO_KR_API_KEY;
const OUT_FILE = path.resolve(__dirname, '../data/moef-quizzes.json');

interface MoefRow {
  번호: number;
  구분: string; // '객관식4택' | 'OX문제'
  문제내용: string;
  보기1: string;
  보기2: string;
  보기3: string;
  보기4: string;
  정답: string; // '1번', '2번', '1번(O)', etc.
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

function parseCorrectAnswer(raw: string): number {
  const match = raw.match(/(\d)/);
  return match ? parseInt(match[1]) : 1;
}

function convertRow(row: MoefRow): Quiz | null {
  // OX문제는 객관식으로 변환
  if (row.구분 === 'OX문제') {
    return {
      question: row.문제내용,
      choices: ['O (맞다)', 'X (틀리다)'],
      correct_answer: row.정답.includes('O') ? 1 : 2,
      brief_explanation: row.해설?.slice(0, 100) || '',
      detailed_explanation: row.해설 || '',
      source: '재경부 시사경제퀴즈',
      category: '경제상식',
    };
  }

  // 객관식 4택
  const choices = [row.보기1, row.보기2, row.보기3, row.보기4].filter(Boolean);
  if (choices.length < 2 || !row.문제내용) return null;

  return {
    question: row.문제내용,
    choices,
    correct_answer: parseCorrectAnswer(row.정답),
    brief_explanation: row.해설?.slice(0, 100) || '',
    detailed_explanation: row.해설 || '',
    source: '재경부 시사경제퀴즈',
    category: '경제상식',
  };
}

async function fetchAll(): Promise<MoefRow[]> {
  if (!API_KEY) {
    throw new Error('DATA_GO_KR_API_KEY가 .env에 없습니다.');
  }

  const rows: MoefRow[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const url = `${API_URL}?page=${page}&perPage=${perPage}&serviceKey=${encodeURIComponent(API_KEY)}&returnType=JSON`;
    console.log(`[재경부] 페이지 ${page} 수집 중...`);

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`API 오류: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    const data: MoefRow[] = json.data || [];

    if (data.length === 0) break;
    rows.push(...data);

    if (rows.length >= json.totalCount) break;
    page++;
  }

  return rows;
}

async function main() {
  console.log('=== 재경부 시사경제퀴즈 수집 시작 ===');

  const rows = await fetchAll();
  console.log(`수집 완료: ${rows.length}개 원본`);

  const quizzes = rows.map(convertRow).filter(Boolean) as Quiz[];
  console.log(`변환 완료: ${quizzes.length}개 퀴즈`);

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(quizzes, null, 2), 'utf-8');
  console.log(`저장: ${OUT_FILE}`);
}

main().catch((e) => {
  console.error('실패:', e.message);
  process.exit(1);
});
