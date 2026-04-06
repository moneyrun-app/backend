/**
 * 한국은행 ECOS 경제용어사전 수집 (~1,000개)
 * 소스: http://ecos.bok.or.kr/api/StatisticWord/
 * 용어 + 정의 → 나중에 AI로 퀴즈 변환
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_KEY = process.env.ECOS_API_KEY;
const OUT_FILE = path.resolve(__dirname, '../data/ecos-words.json');

interface Term {
  name: string;
  definition: string;
}

// ECOS API는 검색어가 필수 → 한글 초성별로 검색해서 전체 수집
const SEARCH_CHARS = [
  'ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
  '가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하',
  '경', '금', '투', '채', '주', '세', '보', '대', '수', '시',
  '이', '재', '통', '환', '외', '국', '무', '자', '인', '소',
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W',
];

async function fetchByWord(word: string): Promise<Term[]> {
  const url = `https://ecos.bok.or.kr/api/StatisticWord/${API_KEY}/json/kr/1/1000/${encodeURIComponent(word)}`;
  const res = await fetch(url);
  const json = await res.json();

  const result = json.StatisticWord;
  if (!result || !result.row) return [];

  return result.row
    .map((item: any) => ({
      name: (item.WORD || '').trim(),
      definition: (item.CONTENT || '').trim(),
    }))
    .filter((t: Term) => t.name && t.definition.length > 10);
}

async function main() {
  if (!API_KEY) {
    throw new Error('ECOS_API_KEY가 .env에 없습니다.');
  }

  console.log('=== ECOS 경제용어 수집 시작 ===');
  const allTerms = new Map<string, Term>();

  for (const word of SEARCH_CHARS) {
    console.log(`[ECOS] "${word}" 검색 중...`);
    try {
      const terms = await fetchByWord(word);
      for (const t of terms) {
        if (!allTerms.has(t.name)) {
          allTerms.set(t.name, t);
        }
      }
      console.log(`  → ${terms.length}개 (누적: ${allTerms.size}개)`);
    } catch (e: any) {
      console.warn(`  → 실패: ${e.message}`);
    }

    // rate limit 대비
    await new Promise((r) => setTimeout(r, 300));
  }

  const unique = Array.from(allTerms.values());
  console.log(`\n수집 완료: ${unique.length}개 (중복 제거 후)`);

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(unique, null, 2), 'utf-8');
  console.log(`저장: ${OUT_FILE}`);
}

main().catch((e) => {
  console.error('실패:', e.message);
  process.exit(1);
});
