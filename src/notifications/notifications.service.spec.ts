import { Test, TestingModule } from '@nestjs/testing';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { NotificationsService } from './notifications.service.js';
import { SupabaseService } from '../common/supabase/supabase.service.js';

/** Supabase 쿼리 빌더 mock */
function createQueryBuilderMock(
  resolvedValue: { data: unknown; error: unknown; count?: number },
) {
  const builder: Record<string, jest.Mock> = {};
  const chainMethods = [
    'select', 'insert', 'update', 'delete',
    'eq', 'neq', 'gte', 'lte', 'order', 'range',
    'limit', 'single', 'maybeSingle',
  ];

  for (const method of chainMethods) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }

  builder['single']!.mockResolvedValue(resolvedValue);
  builder['maybeSingle']!.mockResolvedValue(resolvedValue);
  builder['range']!.mockResolvedValue(resolvedValue);

  // insert는 마지막에 바로 resolve
  const insertBuilder = { ...builder };
  builder['insert']!.mockReturnValue(insertBuilder);

  return builder;
}

describe('NotificationsService', () => {
  let service: NotificationsService;
  let supabaseService: { getClient: jest.Mock };

  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  };

  beforeEach(async () => {
    supabaseService = { getClient: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: SupabaseService, useValue: supabaseService },
        { provide: WINSTON_MODULE_NEST_PROVIDER, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('알림을 DB에 저장한다', async () => {
      const queryBuilder = createQueryBuilderMock({ data: null, error: null });
      const fromMock = jest.fn().mockReturnValue(queryBuilder);
      supabaseService.getClient.mockReturnValue({ from: fromMock });

      await service.create('user-1', 'expense_alert', '제목', '내용');

      expect(fromMock).toHaveBeenCalledWith('notifications');
      expect(queryBuilder.insert).toHaveBeenCalled();
    });

    it('DB 에러가 발생해도 예외를 던지지 않는다 (알림 실패는 메인 로직에 영향 없음)', async () => {
      const queryBuilder = createQueryBuilderMock({
        data: null,
        error: { message: 'DB 에러' },
      });
      supabaseService.getClient.mockReturnValue({
        from: jest.fn().mockReturnValue(queryBuilder),
      });

      await expect(
        service.create('user-1', 'system', '제목', '내용'),
      ).resolves.toBeUndefined();
    });
  });

  describe('notifyExpenseAlert', () => {
    it('지출 초과 알림을 생성한다', async () => {
      const queryBuilder = createQueryBuilderMock({ data: null, error: null });
      supabaseService.getClient.mockReturnValue({
        from: jest.fn().mockReturnValue(queryBuilder),
      });

      await service.notifyExpenseAlert('user-1', 50000, 42857);

      const insertCall = queryBuilder.insert.mock.calls[0][0];
      expect(insertCall.type).toBe('expense_alert');
      expect(insertCall.title).toBe('일 예산 초과');
      expect(insertCall.body).toContain('50,000');
      expect(insertCall.body).toContain('42,857');
    });
  });

  describe('notifyGradeChanged', () => {
    it('등급 변화 알림을 생성한다', async () => {
      const queryBuilder = createQueryBuilderMock({ data: null, error: null });
      supabaseService.getClient.mockReturnValue({
        from: jest.fn().mockReturnValue(queryBuilder),
      });

      await service.notifyGradeChanged('user-1', 'red', 'yellow');

      const insertCall = queryBuilder.insert.mock.calls[0][0];
      expect(insertCall.type).toBe('grade_changed');
      expect(insertCall.body).toContain('빨강');
      expect(insertCall.body).toContain('노랑');
    });
  });

  describe('notifyBadgeEarned', () => {
    it('뱃지 획득 알림을 생성한다', async () => {
      const queryBuilder = createQueryBuilderMock({ data: null, error: null });
      supabaseService.getClient.mockReturnValue({
        from: jest.fn().mockReturnValue(queryBuilder),
      });

      await service.notifyBadgeEarned('user-1', '절약왕');

      const insertCall = queryBuilder.insert.mock.calls[0][0];
      expect(insertCall.type).toBe('badge_earned');
      expect(insertCall.body).toContain('절약왕');
    });
  });
});
