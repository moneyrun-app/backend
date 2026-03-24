import { BlocksService } from './blocks.service.js';

describe('BlocksService — 순수 로직', () => {
  let service: BlocksService;

  beforeEach(() => {
    // 순수 함수 테스트이므로 DI 없이 인스턴스 생성
    service = Object.create(BlocksService.prototype);
  });

  describe('determineBlockColor', () => {
    it('지출이 예산을 초과하면 red', () => {
      expect(service.determineBlockColor(50000, 42857)).toBe('red');
    });

    it('지출이 예산 이하이면 blue', () => {
      expect(service.determineBlockColor(30000, 42857)).toBe('blue');
    });

    it('지출이 예산과 정확히 같으면 blue', () => {
      expect(service.determineBlockColor(42857, 42857)).toBe('blue');
    });

    it('지출이 0이면 blue', () => {
      expect(service.determineBlockColor(0, 42857)).toBe('blue');
    });

    it('예산이 0이고 지출이 있으면 red', () => {
      expect(service.determineBlockColor(1000, 0)).toBe('red');
    });

    it('예산과 지출 모두 0이면 blue', () => {
      expect(service.determineBlockColor(0, 0)).toBe('blue');
    });
  });

  describe('calculateRunningSpeed', () => {
    it('알뜰 5일 / 전체 12일 → 41.7', () => {
      expect(service.calculateRunningSpeed(5, 12)).toBe(41.7);
    });

    it('알뜰 10일 / 전체 10일 → 100', () => {
      expect(service.calculateRunningSpeed(10, 10)).toBe(100);
    });

    it('알뜰 0일 / 전체 10일 → 0', () => {
      expect(service.calculateRunningSpeed(0, 10)).toBe(0);
    });

    it('전체 0일이면 0', () => {
      expect(service.calculateRunningSpeed(0, 0)).toBe(0);
    });

    it('알뜰 7일 / 전체 30일 → 23.3', () => {
      expect(service.calculateRunningSpeed(7, 30)).toBe(23.3);
    });
  });

  describe('getLastDayOfMonth', () => {
    it('3월은 31일', () => {
      expect(service.getLastDayOfMonth(2026, 3)).toBe('2026-03-31');
    });

    it('2월 (평년)은 28일', () => {
      expect(service.getLastDayOfMonth(2025, 2)).toBe('2025-02-28');
    });

    it('2월 (윤년)은 29일', () => {
      expect(service.getLastDayOfMonth(2024, 2)).toBe('2024-02-29');
    });

    it('4월은 30일', () => {
      expect(service.getLastDayOfMonth(2026, 4)).toBe('2026-04-30');
    });

    it('12월은 31일', () => {
      expect(service.getLastDayOfMonth(2026, 12)).toBe('2026-12-31');
    });
  });

  describe('getCurrentWeekRange', () => {
    it('월요일~일요일 범위를 반환한다', () => {
      const result = service.getCurrentWeekRange();
      expect(result.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // endDate - startDate = 6일
      const start = new Date(result.startDate);
      const end = new Date(result.endDate);
      const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBe(6);

      // startDate는 월요일 (1)
      expect(start.getDay()).toBe(1);
    });
  });

  describe('getYesterday', () => {
    it('어제 날짜를 YYYY-MM-DD 형식으로 반환한다', () => {
      const result = service.getYesterday();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const expected = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
      expect(result).toBe(expected);
    });
  });
});
