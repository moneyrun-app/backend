/**
 * 예탁결제원 금융용어사전 수집 (~2,000개)
 * 소스: http://api.seibro.or.kr/openapi/service/FnTermSvc/getFinancialTermMeaning
 * 용어 + 정의 → 나중에 AI로 퀴즈 변환
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { parseStringPromise } from 'xml2js';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_URL =
  'http://api.seibro.or.kr/openapi/service/FnTermSvc/getFinancialTermMeaning';
const API_KEY = process.env.DATA_GO_KR_API_KEY;
const OUT_FILE = path.resolve(__dirname, '../data/seibro-terms.json');

interface Term {
  name: string;
  definition: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchPage(pageNo: number, numOfRows: number): Promise<{ terms: Term[]; totalCount: number }> {
  const params = new URLSearchParams({
    serviceKey: API_KEY!,
    pageNo: String(pageNo),
    numOfRows: String(numOfRows),
  });

  const url = `${API_URL}?${params}`;
  const res = await fetch(url);
  const xml = await res.text();
  const parsed = await parseStringPromise(xml, { explicitArray: false });

  const response = parsed.response;
  const header = response.header;

  if (header.resultCode !== '00') {
    throw new Error(`API 오류: ${header.resultMsg}`);
  }

  const totalCount = parseInt(response.body.totalCount) || 0;
  const items = response.body.items?.item;

  if (!items) return { terms: [], totalCount };

  const itemList = Array.isArray(items) ? items : [items];
  const terms: Term[] = itemList
    .map((item: any) => ({
      name: (item.fnceDictNm || '').trim(),
      definition: stripHtml(item.ksdFnceDictDescContent || ''),
    }))
    .filter((t: Term) => t.name && t.definition.length > 10);

  return { terms, totalCount };
}

async function main() {
  if (!API_KEY) {
    throw new Error('DATA_GO_KR_API_KEY가 .env에 없습니다.');
  }

  console.log('=== 예탁결제원 금융용어 수집 시작 ===');

  const numOfRows = 100;
  const { terms: firstBatch, totalCount } = await fetchPage(1, numOfRows);
  console.log(`전체: ${totalCount}개, 1페이지: ${firstBatch.length}개`);

  const allTerms: Term[] = [...firstBatch];
  const totalPages = Math.ceil(totalCount / numOfRows);

  for (let page = 2; page <= totalPages; page++) {
    console.log(`[예탁결제원] 페이지 ${page}/${totalPages} 수집 중...`);
    const { terms } = await fetchPage(page, numOfRows);
    allTerms.push(...terms);

    // API rate limit 대비 — 0.5초 간격
    await new Promise((r) => setTimeout(r, 500));
  }

  // 중복 제거
  const unique = Array.from(
    new Map(allTerms.map((t) => [t.name, t])).values(),
  );

  console.log(`수집 완료: ${unique.length}개 (중복 제거 후)`);

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(unique, null, 2), 'utf-8');
  console.log(`저장: ${OUT_FILE}`);
}

main().catch((e) => {
  console.error('실패:', e.message);
  process.exit(1);
});
