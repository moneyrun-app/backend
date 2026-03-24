import { CommunityService } from './community.service.js';

describe('CommunityService — 순수 로직', () => {
  let service: CommunityService;

  beforeEach(() => {
    service = Object.create(CommunityService.prototype);
  });

  describe('calculateCreatorScore', () => {
    it('게시글×1 + 좋아요×2 + 댓글×3 으로 점수를 계산한다', () => {
      expect(service.calculateCreatorScore(5, 10, 3)).toBe(5 + 20 + 9);
    });

    it('모두 0이면 0', () => {
      expect(service.calculateCreatorScore(0, 0, 0)).toBe(0);
    });

    it('좋아요만 있는 경우', () => {
      expect(service.calculateCreatorScore(0, 15, 0)).toBe(30);
    });

    it('댓글 가중치가 가장 높다', () => {
      const likesOnly = service.calculateCreatorScore(0, 10, 0); // 20
      const commentsOnly = service.calculateCreatorScore(0, 0, 10); // 30
      expect(commentsOnly).toBeGreaterThan(likesOnly);
    });
  });

  describe('extractTags', () => {
    it('한글 2글자 이상 단어를 추출한다', () => {
      const tags = service.extractTags('오늘 커피 대신 물을 마셨다');
      expect(tags).toContain('커피');
      expect(tags).toContain('마셨다');
    });

    it('불용어를 제거한다', () => {
      const tags = service.extractTags('이것 때문에 절약을 했다');
      expect(tags).not.toContain('이것');
      expect(tags).not.toContain('때문에');
      expect(tags).toContain('절약을');
    });

    it('중복 단어는 하나만 남긴다', () => {
      const tags = service.extractTags('커피 커피 커피 대신 투자');
      const coffeeCount = tags.filter((t) => t === '커피').length;
      expect(coffeeCount).toBe(1);
    });

    it('최대 15개까지만 반환한다', () => {
      const longContent = Array.from({ length: 20 }, (_, i) => `단어${i}번째`).join(' ');
      const tags = service.extractTags(longContent);
      expect(tags.length).toBeLessThanOrEqual(15);
    });

    it('영어/숫자만 있으면 빈 배열', () => {
      expect(service.extractTags('hello world 123')).toEqual([]);
    });

    it('1글자 한글은 추출하지 않는다', () => {
      const tags = service.extractTags('나 는 돈 을 모은다');
      expect(tags).not.toContain('나');
      expect(tags).not.toContain('는');
      expect(tags).toContain('모은다');
    });
  });

  describe('generateAnonymousNickname', () => {
    it('문자열을 반환한다', () => {
      const nickname = service.generateAnonymousNickname();
      expect(typeof nickname).toBe('string');
      expect(nickname.length).toBeGreaterThan(0);
    });

    it('한글 + 숫자 조합이다', () => {
      const nickname = service.generateAnonymousNickname();
      expect(nickname).toMatch(/[가-힣]+\d+/);
    });

    it('호출할 때마다 다른 결과를 반환할 수 있다', () => {
      const nicknames = new Set(
        Array.from({ length: 20 }, () => service.generateAnonymousNickname()),
      );
      // 20번 중 최소 2가지 이상 다른 닉네임 (확률적으로 거의 확실)
      expect(nicknames.size).toBeGreaterThan(1);
    });
  });

  describe('getRoomName', () => {
    it('red → 불난방', () => {
      expect(service.getRoomName('red')).toBe('불난방');
    });

    it('yellow → 허리띠방', () => {
      expect(service.getRoomName('yellow')).toBe('허리띠방');
    });

    it('green → 투자방', () => {
      expect(service.getRoomName('green')).toBe('투자방');
    });

    it('알 수 없는 등급 → 미배정', () => {
      expect(service.getRoomName('unknown')).toBe('미배정');
    });
  });
});
