import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { UsersService } from './users.service.js';
import { SupabaseService } from '../common/supabase/supabase.service.js';

/** Supabase 쿼리 빌더 mock 헬퍼 */
function createQueryBuilderMock(
  resolvedValue: { data: unknown; error: unknown },
) {
  const builder: Record<string, jest.Mock> = {};
  const chainMethods = [
    'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'neq', 'gte', 'lte', 'order', 'range',
    'limit', 'single', 'maybeSingle',
  ];

  for (const method of chainMethods) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }

  builder['single']!.mockResolvedValue(resolvedValue);
  builder['maybeSingle']!.mockResolvedValue(resolvedValue);

  return builder;
}

describe('UsersService', () => {
  let service: UsersService;
  let supabaseService: { getClient: jest.Mock };

  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    supabaseService = { getClient: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: SupabaseService, useValue: supabaseService },
        { provide: WINSTON_MODULE_NEST_PROVIDER, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─────────────────────────────────────────────
  // 소득 그룹 계산 (onboard를 통해 간접 테스트)
  // ─────────────────────────────────────────────

  describe('onboard — 소득 그룹 자동 매핑', () => {
    const baseDto = {
      nickname: '테스터',
      birthYear: 1998,
      residence: '서울',
      annualIncome: 3000,
      isSme: false,
    };

    function setupOnboardMocks(insertedData: Record<string, unknown>) {
      const fromMock = jest.fn();

      // user_profiles 조회 (중복 확인) → 없음
      const checkQuery = createQueryBuilderMock({ data: null, error: null });
      // user_profiles insert → 성공
      const insertQuery = createQueryBuilderMock({
        data: insertedData,
        error: null,
      });

      let callCount = 0;
      fromMock.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? checkQuery : insertQuery;
      });

      supabaseService.getClient.mockReturnValue({ from: fromMock });
      return fromMock;
    }

    it('연소득 1,400만원 이하 → basic', async () => {
      const fromMock = setupOnboardMocks({ income_group: 'basic' });

      await service.onboard('user-1', { ...baseDto, annualIncome: 1400 });

      // insert 호출 시 income_group이 basic인지 확인
      const insertCall = fromMock.mock.results[1].value.insert.mock.calls[0][0];
      expect(insertCall.income_group).toBe('basic');
    });

    it('연소득 1,401~5,000만원 → middle', async () => {
      const fromMock = setupOnboardMocks({ income_group: 'middle' });

      await service.onboard('user-1', { ...baseDto, annualIncome: 3000 });

      const insertCall = fromMock.mock.results[1].value.insert.mock.calls[0][0];
      expect(insertCall.income_group).toBe('middle');
    });

    it('연소득 5,001만원 이상 → high', async () => {
      const fromMock = setupOnboardMocks({ income_group: 'high' });

      await service.onboard('user-1', { ...baseDto, annualIncome: 8000 });

      const insertCall = fromMock.mock.results[1].value.insert.mock.calls[0][0];
      expect(insertCall.income_group).toBe('high');
    });

    it('이미 온보딩한 유저는 ConflictException을 던진다', async () => {
      const checkQuery = createQueryBuilderMock({
        data: { id: 'existing' },
        error: null,
      });

      supabaseService.getClient.mockReturnValue({
        from: jest.fn().mockReturnValue(checkQuery),
      });

      await expect(
        service.onboard('user-1', baseDto),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─────────────────────────────────────────────
  // 프로필 조회
  // ─────────────────────────────────────────────

  describe('getProfile', () => {
    it('프로필이 있으면 반환한다', async () => {
      const mockProfile = { id: 'p-1', nickname: '테스터', income_group: 'middle' };
      const queryBuilder = createQueryBuilderMock({
        data: mockProfile,
        error: null,
      });

      supabaseService.getClient.mockReturnValue({
        from: jest.fn().mockReturnValue(queryBuilder),
      });

      const result = await service.getProfile('user-1');
      expect(result).toEqual(mockProfile);
    });

    it('프로필이 없으면 NotFoundException을 던진다', async () => {
      const queryBuilder = createQueryBuilderMock({ data: null, error: null });

      supabaseService.getClient.mockReturnValue({
        from: jest.fn().mockReturnValue(queryBuilder),
      });

      await expect(service.getProfile('user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────
  // 프로필 수정
  // ─────────────────────────────────────────────

  describe('updateProfile', () => {
    it('연소득 변경 시 소득 그룹도 재계산한다', async () => {
      const fromMock = jest.fn();
      const queryBuilder = createQueryBuilderMock({
        data: { income_group: 'high' },
        error: null,
      });

      fromMock.mockReturnValue(queryBuilder);
      supabaseService.getClient.mockReturnValue({ from: fromMock });

      await service.updateProfile('user-1', { annualIncome: 8000 });

      const updateCall = queryBuilder.update.mock.calls[0][0];
      expect(updateCall.annual_income).toBe(8000);
      expect(updateCall.income_group).toBe('high');
    });

    it('닉네임만 변경하면 소득 그룹은 건드리지 않는다', async () => {
      const fromMock = jest.fn();
      const queryBuilder = createQueryBuilderMock({
        data: { nickname: '새닉네임' },
        error: null,
      });

      fromMock.mockReturnValue(queryBuilder);
      supabaseService.getClient.mockReturnValue({ from: fromMock });

      await service.updateProfile('user-1', { nickname: '새닉네임' });

      const updateCall = queryBuilder.update.mock.calls[0][0];
      expect(updateCall.nickname).toBe('새닉네임');
      expect(updateCall.income_group).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────
  // 예산 설정
  // ─────────────────────────────────────────────

  describe('setBudget', () => {
    it('월 예산, 주간 예산, 일 예산을 자동 계산한다', async () => {
      const fromMock = jest.fn();
      const queryBuilder = createQueryBuilderMock({
        data: {
          monthly_budget: 1200000,
          weekly_budget: 300000,
          daily_budget: 42857,
        },
        error: null,
      });

      fromMock.mockReturnValue(queryBuilder);
      supabaseService.getClient.mockReturnValue({ from: fromMock });

      await service.setBudget('user-1', {
        monthlyIncome: 2500000,
        fixedExpenses: 800000,
        savingsGoal: 500000,
      });

      // 월 예산 = 2,500,000 - 800,000 - 500,000 = 1,200,000
      // 주간 예산 = 1,200,000 / 4 = 300,000
      // 일 예산 = 300,000 / 7 = 42,857
      const upsertCall = queryBuilder.upsert.mock.calls[0][0];
      expect(upsertCall.monthly_budget).toBe(1200000);
      expect(upsertCall.weekly_budget).toBe(300000);
      expect(upsertCall.daily_budget).toBe(42857);
    });

    it('소득이 고정비+저축보다 적으면 음수 예산이 된다', async () => {
      const fromMock = jest.fn();
      const queryBuilder = createQueryBuilderMock({
        data: { monthly_budget: -300000 },
        error: null,
      });

      fromMock.mockReturnValue(queryBuilder);
      supabaseService.getClient.mockReturnValue({ from: fromMock });

      await service.setBudget('user-1', {
        monthlyIncome: 1000000,
        fixedExpenses: 800000,
        savingsGoal: 500000,
      });

      const upsertCall = queryBuilder.upsert.mock.calls[0][0];
      // 1,000,000 - 800,000 - 500,000 = -300,000
      expect(upsertCall.monthly_budget).toBe(-300000);
    });
  });

  // ─────────────────────────────────────────────
  // 예산 조회
  // ─────────────────────────────────────────────

  describe('getBudget', () => {
    it('예산이 있으면 반환한다', async () => {
      const mockBudget = { daily_budget: 42857, weekly_budget: 300000 };
      const queryBuilder = createQueryBuilderMock({
        data: mockBudget,
        error: null,
      });

      supabaseService.getClient.mockReturnValue({
        from: jest.fn().mockReturnValue(queryBuilder),
      });

      const result = await service.getBudget('user-1');
      expect(result).toEqual(mockBudget);
    });

    it('예산이 없으면 NotFoundException을 던진다', async () => {
      const queryBuilder = createQueryBuilderMock({ data: null, error: null });

      supabaseService.getClient.mockReturnValue({
        from: jest.fn().mockReturnValue(queryBuilder),
      });

      await expect(service.getBudget('user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
