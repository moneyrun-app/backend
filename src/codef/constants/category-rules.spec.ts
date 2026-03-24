import {
  classifyCategory,
  getTagsForCategory,
  isInvestmentCategory,
  isFixedExpenseCategory,
  TAGS,
} from './category-rules.js';

describe('classifyCategory', () => {
  it.each([
    ['배달의민족 강남점', '외식'],
    ['맥도날드 역삼DT', '외식'],
    ['요기요 결제', '외식'],
    ['스타벅스 선릉역점', '카페'],
    ['이디야커피', '카페'],
    ['메가커피 홍대점', '카페'],
    ['CU 편의점', '편의점'],
    ['GS25 강남점', '편의점'],
    ['이마트 성수점', '마트/식료품'],
    ['쿠팡 배송', '마트/식료품'],
    ['카카오T 택시', '교통'],
    ['코레일 KTX', '교통'],
    ['무신사 스토어', '쇼핑'],
    ['올리브영 강남', '쇼핑'],
    ['넷플릭스', '구독'],
    ['SPOTIFY', '구독'],
    ['CHATGPT SUBSCRIPTION', '구독'],
    ['월세 이체', '고정비용'],
    ['KT 통신비', '고정비용'],
    ['삼성생명 보험료', '고정비용'],
    ['키움증권 주식매수', '투자'],
    ['업비트 비트코인', '투자'],
    ['신한은행 정기적금', '저축'],
    ['CMA 입금', '저축'],
    ['서울대학교병원', '의료'],
    ['연세치과의원', '의료'],
    ['패스트캠퍼스 강의', '교육'],
    ['인프런 결제', '교육'],
    ['CGV 영등포', '문화/여가'],
    ['헬스장 회원권', '문화/여가'],
    ['미용실 커트', '뷰티/미용'],
    ['올리브영 화장품', '쇼핑'],
  ])('"%s" → %s', (description, expected) => {
    expect(classifyCategory(description)).toBe(expected);
  });

  it('매칭되지 않는 가맹점은 "기타"로 분류한다', () => {
    expect(classifyCategory('알 수 없는 거래처')).toBe('기타');
    expect(classifyCategory('ABC123 결제')).toBe('기타');
  });

  it('대소문자를 구분하지 않는다', () => {
    expect(classifyCategory('netflix')).toBe('구독');
    expect(classifyCategory('NETFLIX')).toBe('구독');
    expect(classifyCategory('Netflix')).toBe('구독');
    expect(classifyCategory('cafe 라운지')).toBe('카페'); // CAFE 키워드 매칭
  });
});

describe('getTagsForCategory', () => {
  it('외식은 선택적 소비 태그를 반환한다', () => {
    expect(getTagsForCategory('외식')).toEqual([TAGS.DISCRETIONARY]);
  });

  it('카페는 선택적 소비 + 장해물 소비 태그를 반환한다', () => {
    expect(getTagsForCategory('카페')).toEqual([
      TAGS.DISCRETIONARY,
      TAGS.OBSTACLE,
    ]);
  });

  it('고정비용은 고정비용 태그를 반환한다', () => {
    expect(getTagsForCategory('고정비용')).toEqual([TAGS.FIXED_COST]);
  });

  it('투자는 전략적 자산 태그를 반환한다', () => {
    expect(getTagsForCategory('투자')).toEqual([TAGS.STRATEGIC_ASSET]);
  });

  it('기타는 빈 배열을 반환한다', () => {
    expect(getTagsForCategory('기타')).toEqual([]);
  });
});

describe('isInvestmentCategory', () => {
  it('투자/저축은 true를 반환한다', () => {
    expect(isInvestmentCategory('투자')).toBe(true);
    expect(isInvestmentCategory('저축')).toBe(true);
  });

  it('그 외는 false를 반환한다', () => {
    expect(isInvestmentCategory('외식')).toBe(false);
    expect(isInvestmentCategory('카페')).toBe(false);
    expect(isInvestmentCategory('기타')).toBe(false);
  });
});

describe('isFixedExpenseCategory', () => {
  it('고정비용은 true를 반환한다', () => {
    expect(isFixedExpenseCategory('고정비용')).toBe(true);
  });

  it('그 외는 false를 반환한다', () => {
    expect(isFixedExpenseCategory('외식')).toBe(false);
    expect(isFixedExpenseCategory('투자')).toBe(false);
  });
});
