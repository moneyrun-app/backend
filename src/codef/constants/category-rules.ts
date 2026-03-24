/**
 * 거래 내역 자동 분류 규칙.
 * 가맹점명(description)에 키워드가 포함되면 해당 카테고리/태그로 분류한다.
 * MVP에서는 JSON 상수로 관리, 추후 DB 테이블로 이전 가능.
 */

/** 카테고리 목록 */
export const CATEGORIES = [
  '외식',
  '카페',
  '편의점',
  '마트/식료품',
  '교통',
  '쇼핑',
  '구독',
  '고정비용',
  '투자',
  '저축',
  '의료',
  '교육',
  '문화/여가',
  '뷰티/미용',
  '기타',
] as const;

export type Category = (typeof CATEGORIES)[number];

/** 태그 목록 */
export const TAGS = {
  DISCRETIONARY: '선택적 소비',
  FIXED_COST: '고정비용',
  STRATEGIC_ASSET: '전략적 자산',
  OBSTACLE: '장해물 소비',
} as const;

export type Tag = (typeof TAGS)[keyof typeof TAGS];

/** 카테고리 매핑 규칙: 키워드 → 카테고리 */
export const CATEGORY_RULES: { keywords: string[]; category: Category }[] = [
  // 외식
  {
    keywords: [
      '배달의민족',
      '요기요',
      '쿠팡이츠',
      '맥도날드',
      '버거킹',
      '롯데리아',
      '피자헛',
      '도미노',
      'KFC',
      '서브웨이',
      '맘스터치',
      '교촌',
      'BBQ',
      'BHC',
      '굽네',
      '네네치킨',
      '식당',
      '밥집',
      '분식',
      '김밥',
      '떡볶이',
      '삼겹살',
      '고깃집',
      '초밥',
      '라멘',
    ],
    category: '외식',
  },
  // 카페
  {
    keywords: [
      '스타벅스',
      '투썸',
      '이디야',
      '할리스',
      '메가커피',
      '컴포즈',
      '빽다방',
      '폴바셋',
      '블루보틀',
      '카페',
      'CAFE',
      '커피',
      '공차',
      '탐앤탐스',
    ],
    category: '카페',
  },
  // 편의점
  {
    keywords: ['CU', 'GS25', '세븐일레븐', '이마트24', '미니스톱', '편의점'],
    category: '편의점',
  },
  // 마트/식료품
  {
    keywords: [
      '이마트',
      '홈플러스',
      '롯데마트',
      '코스트코',
      '트레이더스',
      '하나로마트',
      '농협',
      '쿠팡',
      '마켓컬리',
      '오아시스',
      'SSG',
    ],
    category: '마트/식료품',
  },
  // 교통
  {
    keywords: [
      '택시',
      '카카오T',
      '타다',
      '지하철',
      '버스',
      '코레일',
      'SRT',
      'KTX',
      '주유소',
      'SK에너지',
      'GS칼텍스',
      'S-OIL',
      '현대오일',
      '주차',
      '톨게이트',
      '하이패스',
      '티머니',
    ],
    category: '교통',
  },
  // 쇼핑
  {
    keywords: [
      '무신사',
      '지그재그',
      'ABLY',
      '에이블리',
      '올리브영',
      '다이소',
      '자라',
      'ZARA',
      'H&M',
      '유니클로',
      'UNIQLO',
      '나이키',
      'NIKE',
      '아디다스',
      '뉴발란스',
      '11번가',
      '위메프',
      '티몬',
      'G마켓',
      '옥션',
    ],
    category: '쇼핑',
  },
  // 구독
  {
    keywords: [
      '넷플릭스',
      'NETFLIX',
      '유튜브프리미엄',
      '스포티파이',
      'SPOTIFY',
      '멜론',
      '지니',
      '디즈니',
      '왓챠',
      '웨이브',
      '쿠팡플레이',
      '애플뮤직',
      'APPLE',
      'CHATGPT',
      'OPENAI',
    ],
    category: '구독',
  },
  // 고정비용
  {
    keywords: [
      '월세',
      '관리비',
      '전기',
      '가스',
      '수도',
      '인터넷',
      'KT',
      'SKT',
      'LGU',
      '통신비',
      '보험',
      '삼성생명',
      '한화생명',
      '교보생명',
      '국민연금',
      '건강보험',
      '아파트',
    ],
    category: '고정비용',
  },
  // 투자
  {
    keywords: [
      '증권',
      '키움',
      '미래에셋',
      '삼성증권',
      '한국투자',
      'NH투자',
      'KB증권',
      '토스증권',
      '카카오페이증권',
      '비트코인',
      '업비트',
      '빗썸',
      '코인',
      '펀드',
    ],
    category: '투자',
  },
  // 저축
  {
    keywords: ['적금', '예금', '저축', '정기적금', '자유적금', 'CMA'],
    category: '저축',
  },
  // 의료
  {
    keywords: [
      '병원',
      '의원',
      '약국',
      '치과',
      '안과',
      '피부과',
      '정형외과',
      '한의원',
      '건강검진',
    ],
    category: '의료',
  },
  // 교육
  {
    keywords: [
      '학원',
      '인강',
      '강의',
      '클래스101',
      '패스트캠퍼스',
      '코드잇',
      '인프런',
      '유데미',
      'UDEMY',
      '학교',
      '대학교',
      '등록금',
    ],
    category: '교육',
  },
  // 문화/여가
  {
    keywords: [
      'CGV',
      '메가박스',
      '롯데시네마',
      '영화',
      'PC방',
      '노래방',
      '헬스',
      '필라테스',
      '요가',
      '수영',
      '골프',
      '볼링',
      '놀이공원',
      '에버랜드',
      '롯데월드',
    ],
    category: '문화/여가',
  },
  // 뷰티/미용
  {
    keywords: [
      '미용실',
      '헤어',
      '네일',
      '속눈썹',
      '피부관리',
      '에스테틱',
      '화장품',
      '이니스프리',
      '아모레',
      '더페이스샵',
    ],
    category: '뷰티/미용',
  },
];

/**
 * 카테고리별 태그 매핑 규칙.
 * 카테고리가 결정되면 자동으로 태그가 부여된다.
 */
export const TAG_RULES: Record<Category, Tag[]> = {
  외식: [TAGS.DISCRETIONARY],
  카페: [TAGS.DISCRETIONARY, TAGS.OBSTACLE],
  편의점: [TAGS.DISCRETIONARY],
  '마트/식료품': [TAGS.FIXED_COST],
  교통: [TAGS.FIXED_COST],
  쇼핑: [TAGS.DISCRETIONARY, TAGS.OBSTACLE],
  구독: [TAGS.FIXED_COST],
  고정비용: [TAGS.FIXED_COST],
  투자: [TAGS.STRATEGIC_ASSET],
  저축: [TAGS.STRATEGIC_ASSET],
  의료: [TAGS.FIXED_COST],
  교육: [TAGS.STRATEGIC_ASSET],
  '문화/여가': [TAGS.DISCRETIONARY],
  '뷰티/미용': [TAGS.DISCRETIONARY],
  기타: [],
};

/**
 * 거래 설명(description)에서 카테고리를 자동 분류한다.
 * 여러 규칙에 매칭되면 첫 번째 매칭 규칙을 사용한다.
 * @param description - 거래 설명 (가맹점명 등)
 * @returns 분류된 카테고리
 */
export function classifyCategory(description: string): Category {
  const normalized = description.toUpperCase();

  for (const rule of CATEGORY_RULES) {
    for (const keyword of rule.keywords) {
      if (normalized.includes(keyword.toUpperCase())) {
        return rule.category;
      }
    }
  }

  return '기타';
}

/**
 * 카테고리에 해당하는 태그 목록을 반환한다.
 * @param category - 거래 카테고리
 * @returns 태그 배열
 */
export function getTagsForCategory(category: Category): Tag[] {
  return TAG_RULES[category] ?? [];
}

/**
 * 카테고리가 투자성 거래인지 판별한다.
 * @param category - 거래 카테고리
 * @returns 투자 여부
 */
export function isInvestmentCategory(category: Category): boolean {
  return category === '투자' || category === '저축';
}

/**
 * 카테고리가 고정비용인지 판별한다.
 * @param category - 거래 카테고리
 * @returns 고정비용 여부
 */
export function isFixedExpenseCategory(category: Category): boolean {
  return category === '고정비용';
}
