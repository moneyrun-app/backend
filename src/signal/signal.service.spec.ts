import { SignalService } from './signal.service.js';

describe('SignalService — 순수 로직', () => {
  let service: SignalService;

  beforeEach(() => {
    service = Object.create(SignalService.prototype);
  });

  describe('determineGrade', () => {
    it('지출이 소득의 105% 초과 → red', () => {
      // 소득 100만원, 지출 106만원 (106%)
      expect(service.determineGrade(1000000, 1060000)).toBe('red');
    });

    it('지출이 소득의 정확히 105% → yellow (경계값)', () => {
      // 소득 100만원, 지출 105만원 (105%)
      expect(service.determineGrade(1000000, 1050000)).toBe('yellow');
    });

    it('지출이 소득의 100% → yellow', () => {
      expect(service.determineGrade(1000000, 1000000)).toBe('yellow');
    });

    it('지출이 소득의 95% → yellow (경계값)', () => {
      // 소득 100만원, 지출 95만원 (95%)
      expect(service.determineGrade(1000000, 950000)).toBe('yellow');
    });

    it('지출이 소득의 95% 미만 → green', () => {
      // 소득 100만원, 지출 94만원 (94%)
      expect(service.determineGrade(1000000, 940000)).toBe('green');
    });

    it('지출이 소득의 50% → green', () => {
      expect(service.determineGrade(1000000, 500000)).toBe('green');
    });

    it('지출이 0 → green', () => {
      expect(service.determineGrade(1000000, 0)).toBe('green');
    });

    it('소득이 0이면 → red', () => {
      expect(service.determineGrade(0, 500000)).toBe('red');
    });

    it('소득과 지출 모두 0이면 → red', () => {
      expect(service.determineGrade(0, 0)).toBe('red');
    });

    it('지출이 소득의 200% → red', () => {
      expect(service.determineGrade(1000000, 2000000)).toBe('red');
    });

    // 5% 이내 경계 테스트
    it('지출이 소득의 96% → yellow', () => {
      expect(service.determineGrade(1000000, 960000)).toBe('yellow');
    });

    it('지출이 소득의 104% → yellow', () => {
      expect(service.determineGrade(1000000, 1040000)).toBe('yellow');
    });

    // 소수점 비율 테스트
    it('소득 250만원, 지출 237.5만원 (95%) → yellow', () => {
      expect(service.determineGrade(2500000, 2375000)).toBe('yellow');
    });

    it('소득 250만원, 지출 237만원 (94.8%) → green', () => {
      expect(service.determineGrade(2500000, 2370000)).toBe('green');
    });
  });
});
