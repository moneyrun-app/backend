import { SimulatorService } from './simulator.service.js';

describe('SimulatorService', () => {
  let service: SimulatorService;

  beforeEach(() => {
    service = new SimulatorService();
  });

  describe('calculateFutureValue', () => {
    it('복리 없이 월 적립만 하면 단순 합산', () => {
      // 0원 시작, 월 100만원, 수익률 0%, 10년
      const result = service.calculateFutureValue(0, 1000000, 0, 10);
      expect(result).toBe(120000000); // 1,200만 × 10 = 1.2억
    });

    it('초기 투자 + 월 적립 + 복리', () => {
      // 1000만원 시작, 월 50만원, 연 5%, 10년
      const result = service.calculateFutureValue(10000000, 500000, 0.05, 10);
      expect(result).toBeGreaterThan(90000000); // 9천만원 이상
    });

    it('초기 투자만 있고 월 적립 없으면 복리만 적용', () => {
      // 1000만원 시작, 월 0원, 연 10%, 10년
      const result = service.calculateFutureValue(10000000, 0, 0.10, 10);
      expect(result).toBeGreaterThan(25000000); // 2.5배 이상
    });

    it('모두 0이면 0', () => {
      expect(service.calculateFutureValue(0, 0, 0, 0)).toBe(0);
    });
  });

  describe('calculateOpportunityCost', () => {
    it('커피 5,000원을 10년 투자하면 상당한 금액이 된다', () => {
      // 매일 5,000원 → 월 150,000원, 연 5%, 10년
      const result = service.calculateOpportunityCost(5000, 0.05, 10);
      expect(result).toBeGreaterThan(20000000); // 2천만원 이상
    });

    it('0원이면 0', () => {
      expect(service.calculateOpportunityCost(0, 0.05, 10)).toBe(0);
    });
  });

  describe('calculateGoalProgress', () => {
    it('목표의 50%를 달성하면 50', () => {
      expect(service.calculateGoalProgress(500000, 1000000)).toBe(50);
    });

    it('목표를 100% 달성하면 100', () => {
      expect(service.calculateGoalProgress(1000000, 1000000)).toBe(100);
    });

    it('목표를 초과하면 100 이상', () => {
      expect(service.calculateGoalProgress(1500000, 1000000)).toBe(150);
    });

    it('목표가 0이면 0', () => {
      expect(service.calculateGoalProgress(500000, 0)).toBe(0);
    });

    it('현재 자산이 0이면 0', () => {
      expect(service.calculateGoalProgress(0, 1000000)).toBe(0);
    });
  });

  describe('calculateMonthsToGoal', () => {
    it('이미 목표 달성이면 0', () => {
      expect(service.calculateMonthsToGoal(1000000, 1000000, 100000, 0.05)).toBe(0);
    });

    it('월 저축이 0이면 도달 불가 (-1)', () => {
      expect(service.calculateMonthsToGoal(0, 1000000, 0, 0.05)).toBe(-1);
    });

    it('수익률 0%이면 단순 나눗셈', () => {
      // 목표 100만원, 현재 0원, 월 10만원, 수익률 0%
      expect(service.calculateMonthsToGoal(0, 1000000, 100000, 0)).toBe(10);
    });

    it('복리 효과가 있으면 더 빨리 도달한다', () => {
      const withRate = service.calculateMonthsToGoal(0, 10000000, 100000, 0.05);
      const withoutRate = service.calculateMonthsToGoal(0, 10000000, 100000, 0);
      expect(withRate).toBeLessThan(withoutRate);
    });
  });

  describe('calculateDaysAccelerated', () => {
    it('절약하면 목표 달성이 앞당겨진다', () => {
      const days = service.calculateDaysAccelerated(
        5000,   // 일 5,000원 절약
        0.05,   // 연 5%
        100000000, // 목표 1억
        0,      // 현재 0원
        500000, // 현재 월 50만원 저축
      );
      expect(days).toBeGreaterThan(0);
    });

    it('목표가 이미 달성이면 0', () => {
      const days = service.calculateDaysAccelerated(
        5000, 0.05, 1000000, 2000000, 500000,
      );
      expect(days).toBe(0);
    });
  });
});
