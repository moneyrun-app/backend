import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { CodefService } from './codef.service.js';
import { CodefApiService } from './codef-api.service.js';
import { SupabaseService } from '../common/supabase/supabase.service.js';

/**
 * Supabase 쿼리 빌더를 체이닝 형태로 mock하는 헬퍼.
 * 마지막에 호출되는 메서드(maybeSingle, single, select 등)의 반환값을 설정한다.
 */
function createQueryBuilderMock(
  resolvedValue: { data: unknown; error: unknown; count?: number },
) {
  const builder: Record<string, jest.Mock> = {};
  const chainMethods = [
    'select',
    'insert',
    'update',
    'upsert',
    'delete',
    'eq',
    'neq',
    'gte',
    'lte',
    'order',
    'range',
    'limit',
    'single',
    'maybeSingle',
  ];

  for (const method of chainMethods) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }

  // 터미널 메서드들은 Promise로 resolve
  builder['single']!.mockResolvedValue(resolvedValue);
  builder['maybeSingle']!.mockResolvedValue(resolvedValue);
  // select가 마지막일 때 (count 쿼리 등)
  builder['range']!.mockResolvedValue(resolvedValue);
  // 필터 체이닝 끝에 await 하면 resolve
  builder['then'] = jest.fn((resolve: (val: unknown) => void) =>
    resolve(resolvedValue),
  );

  return builder;
}

describe('CodefService', () => {
  let service: CodefService;
  let supabaseService: { getClient: jest.Mock };
  let codefApiService: Partial<Record<keyof CodefApiService, jest.Mock>>;

  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    supabaseService = {
      getClient: jest.fn(),
    };

    codefApiService = {
      createConnectedId: jest.fn(),
      addToConnectedId: jest.fn(),
      getAccountList: jest.fn(),
      getCardList: jest.fn(),
      getBankTransactions: jest.fn(),
      getCardTransactions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CodefService,
        { provide: SupabaseService, useValue: supabaseService },
        { provide: CodefApiService, useValue: codefApiService },
        { provide: WINSTON_MODULE_NEST_PROVIDER, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<CodefService>(CodefService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getInstitutions', () => {
    it('유저의 금융기관 목록을 반환한다', async () => {
      const mockInstitutions = [
        {
          id: 'inst-1',
          organization_code: '0004',
          organization_name: 'NH농협은행',
        },
      ];

      const queryBuilder = createQueryBuilderMock({
        data: mockInstitutions,
        error: null,
      });

      supabaseService.getClient.mockReturnValue({
        from: jest.fn().mockReturnValue(queryBuilder),
      });

      const result = await service.getInstitutions('user-123');
      expect(result).toEqual(mockInstitutions);
    });
  });

  describe('getAccounts', () => {
    it('유저의 계좌 목록을 반환한다', async () => {
      const mockAccounts = [
        {
          id: 'acc-1',
          account_number: '123-456',
          bank_name: 'NH농협은행',
          balance: 1000000,
        },
      ];

      const queryBuilder = createQueryBuilderMock({
        data: mockAccounts,
        error: null,
      });

      supabaseService.getClient.mockReturnValue({
        from: jest.fn().mockReturnValue(queryBuilder),
      });

      const result = await service.getAccounts('user-123');
      expect(result).toEqual(mockAccounts);
    });
  });

  describe('getAssetSnapshot', () => {
    it('스냅샷이 없으면 NotFoundException을 던진다', async () => {
      const queryBuilder = createQueryBuilderMock({
        data: null,
        error: null,
      });

      supabaseService.getClient.mockReturnValue({
        from: jest.fn().mockReturnValue(queryBuilder),
      });

      await expect(service.getAssetSnapshot('user-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('syncAllTransactions', () => {
    it('연결된 금융기관이 없으면 NotFoundException을 던진다', async () => {
      const fromMock = jest.fn();

      // sync_logs insert
      const syncLogBuilder = createQueryBuilderMock({
        data: { id: 'log-1' },
        error: null,
      });

      // codef_connected_ids 조회 → null
      const connectedIdBuilder = createQueryBuilderMock({
        data: null,
        error: null,
      });

      let callCount = 0;
      fromMock.mockImplementation((table: string) => {
        if (table === 'sync_logs') return syncLogBuilder;
        if (table === 'codef_connected_ids') return connectedIdBuilder;
        callCount++;
        return createQueryBuilderMock({ data: [], error: null });
      });

      supabaseService.getClient.mockReturnValue({ from: fromMock });

      await expect(
        service.syncAllTransactions('user-123'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('connectInstitution', () => {
    it('최초 연결 시 새 커넥티드ID를 생성한다', async () => {
      const fromMock = jest.fn();

      // codef_connected_ids 조회 → 없음
      const connectedIdQuery = createQueryBuilderMock({
        data: null,
        error: null,
      });

      // codef_connected_ids insert
      const connectedIdInsert = createQueryBuilderMock({
        data: { id: 'conn-ref-1' },
        error: null,
      });

      // codef_institutions insert
      const institutionInsert = createQueryBuilderMock({
        data: { id: 'inst-1' },
        error: null,
      });

      // codef_accounts (계좌 조회 결과)
      const accountsQuery = createQueryBuilderMock({
        data: [],
        error: null,
      });

      // asset_snapshots 조회 → 없음
      const snapshotQuery = createQueryBuilderMock({
        data: null,
        error: null,
      });

      // asset_snapshots insert
      const snapshotInsert = createQueryBuilderMock({
        data: { id: 'snap-1' },
        error: null,
      });

      let connectedIdCallCount = 0;
      let snapshotCallCount = 0;

      fromMock.mockImplementation((table: string) => {
        if (table === 'codef_connected_ids') {
          connectedIdCallCount++;
          return connectedIdCallCount === 1
            ? connectedIdQuery
            : connectedIdInsert;
        }
        if (table === 'codef_institutions') return institutionInsert;
        if (table === 'codef_accounts') return accountsQuery;
        if (table === 'asset_snapshots') {
          snapshotCallCount++;
          return snapshotCallCount === 1 ? snapshotQuery : snapshotInsert;
        }
        return createQueryBuilderMock({ data: [], error: null });
      });

      supabaseService.getClient.mockReturnValue({ from: fromMock });
      codefApiService.createConnectedId!.mockResolvedValue('connected-id-123');
      codefApiService.getAccountList!.mockResolvedValue([]);

      const result = await service.connectInstitution('user-123', {
        organizationCode: '0004',
        institutionType: 'bank',
        loginId: 'testuser',
        loginPassword: 'testpass',
      });

      expect(codefApiService.createConnectedId).toHaveBeenCalledWith(
        '0004',
        'testuser',
        'testpass',
      );
      expect(result.organizationCode).toBe('0004');
      expect(result.institutionType).toBe('bank');
    });

    it('기존 커넥티드ID가 있으면 추가한다', async () => {
      const fromMock = jest.fn();

      // codef_connected_ids 조회 → 있음
      const connectedIdQuery = createQueryBuilderMock({
        data: { id: 'conn-ref-1', connected_id: 'existing-connected-id' },
        error: null,
      });

      // codef_institutions insert
      const institutionInsert = createQueryBuilderMock({
        data: { id: 'inst-1' },
        error: null,
      });

      // codef_cards (카드사 연결)
      const cardsQuery = createQueryBuilderMock({
        data: [],
        error: null,
      });

      fromMock.mockImplementation((table: string) => {
        if (table === 'codef_connected_ids') return connectedIdQuery;
        if (table === 'codef_institutions') return institutionInsert;
        if (table === 'codef_cards') return cardsQuery;
        return createQueryBuilderMock({ data: [], error: null });
      });

      supabaseService.getClient.mockReturnValue({ from: fromMock });
      codefApiService.addToConnectedId!.mockResolvedValue(undefined);
      codefApiService.getCardList!.mockResolvedValue([]);

      const result = await service.connectInstitution('user-123', {
        organizationCode: '0301',
        institutionType: 'card',
        loginId: 'testuser',
        loginPassword: 'testpass',
      });

      expect(codefApiService.addToConnectedId).toHaveBeenCalledWith(
        'existing-connected-id',
        '0301',
        'testuser',
        'testpass',
      );
      expect(codefApiService.createConnectedId).not.toHaveBeenCalled();
      expect(result.organizationCode).toBe('0301');
    });
  });

  describe('updateTransactionCategory', () => {
    it('거래의 카테고리와 태그를 수정한다', async () => {
      const updatedTransaction = {
        id: 'tx-1',
        category: '카페',
        tags: ['선택적 소비'],
        is_investment: false,
        is_fixed_expense: false,
      };

      const queryBuilder = createQueryBuilderMock({
        data: updatedTransaction,
        error: null,
      });

      supabaseService.getClient.mockReturnValue({
        from: jest.fn().mockReturnValue(queryBuilder),
      });

      const result = await service.updateTransactionCategory(
        'user-123',
        'tx-1',
        '카페',
        ['선택적 소비'],
      );

      expect(result).toEqual(updatedTransaction);
    });
  });
});
