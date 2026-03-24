import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../common/supabase/supabase.service.js';
import { CodefApiService } from './codef-api.service.js';
import { ConnectInstitutionDto } from './dto/connect-institution.dto.js';
import { GetTransactionsDto } from './dto/get-transactions.dto.js';
import {
  classifyCategory,
  getTagsForCategory,
  isInvestmentCategory,
  isFixedExpenseCategory,
} from './constants/category-rules.js';
import type { Category } from './constants/category-rules.js';

/** 동기화 재시도 최대 횟수 */
const MAX_SYNC_RETRIES = 3;

/**
 * 코드에프 비즈니스 로직 서비스.
 * 금융기관 연결, 거래 동기화, 카테고리 분류, 자산 스냅샷 등을 담당한다.
 */
@Injectable()
export class CodefService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly codefApiService: CodefApiService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  // ─────────────────────────────────────────────
  // 금융기관 연결
  // ─────────────────────────────────────────────

  /**
   * 금융기관을 연결한다.
   * 기존 커넥티드ID가 있으면 추가, 없으면 새로 생성한다.
   * 연결 후 계좌/카드 목록을 자동으로 가져오고, 최초 연결이면 자산 스냅샷을 생성한다.
   * @param userId - 유저 ID
   * @param dto - 금융기관 연결 요청 데이터
   * @returns 연결 결과 (기관 정보 + 계좌/카드 수)
   */
  async connectInstitution(
    userId: string,
    dto: ConnectInstitutionDto,
  ): Promise<Record<string, unknown>> {
    const client = this.supabaseService.getClient();

    // 기존 커넥티드ID 확인
    const { data: existing } = await client
      .from('codef_connected_ids')
      .select('id, connected_id')
      .eq('user_id', userId)
      .maybeSingle();

    let connectedId: string;
    let connectedIdRef: string;

    if (existing) {
      // 기존 커넥티드ID에 기관 추가
      await this.codefApiService.addToConnectedId(
        existing.connected_id as string,
        dto.organizationCode,
        dto.loginId,
        dto.loginPassword,
      );
      connectedId = existing.connected_id as string;
      connectedIdRef = existing.id as string;
    } else {
      // 새 커넥티드ID 생성
      connectedId = await this.codefApiService.createConnectedId(
        dto.organizationCode,
        dto.loginId,
        dto.loginPassword,
      );

      const { data: newConnection, error } = await client
        .from('codef_connected_ids')
        .insert({ user_id: userId, connected_id: connectedId })
        .select('id')
        .single();

      if (error) {
        this.logger.error(
          `커넥티드ID 저장 실패: ${error.message}`,
          undefined,
          'CodefService',
        );
        throw error;
      }
      connectedIdRef = (newConnection as Record<string, unknown>).id as string;
    }

    // 금융기관 정보 저장
    const { data: institution, error: instError } = await client
      .from('codef_institutions')
      .insert({
        user_id: userId,
        connected_id_ref: connectedIdRef,
        organization_code: dto.organizationCode,
        organization_name: this.getOrganizationName(dto.organizationCode),
        institution_type: dto.institutionType,
      })
      .select()
      .single();

    if (instError) {
      this.logger.error(
        `금융기관 정보 저장 실패: ${instError.message}`,
        undefined,
        'CodefService',
      );
      throw instError;
    }

    const institutionId = (institution as Record<string, unknown>).id as string;

    // 계좌/카드 목록 자동 조회 및 저장
    let syncedCount = 0;
    if (dto.institutionType === 'bank') {
      syncedCount = await this.syncAccounts(
        userId,
        connectedId,
        dto.organizationCode,
        institutionId,
      );
    } else {
      syncedCount = await this.syncCards(
        userId,
        connectedId,
        dto.organizationCode,
        institutionId,
      );
    }

    // 최초 연결이면 자산 스냅샷 생성
    if (!existing) {
      await this.createAssetSnapshot(userId);
    }

    this.logger.log(
      `금융기관 연결 완료: 유저=${userId}, 기관=${dto.organizationCode}, 동기화=${syncedCount}건`,
      'CodefService',
    );

    return {
      institutionId,
      organizationCode: dto.organizationCode,
      organizationName: this.getOrganizationName(dto.organizationCode),
      institutionType: dto.institutionType,
      syncedCount,
    };
  }

  /**
   * 연결된 금융기관 목록을 조회한다.
   * @param userId - 유저 ID
   * @returns 금융기관 목록
   */
  async getInstitutions(userId: string): Promise<Record<string, unknown>[]> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('codef_institutions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true });

    if (error) {
      this.logger.error(
        `금융기관 목록 조회 실패: ${error.message}`,
        undefined,
        'CodefService',
      );
      throw error;
    }

    return (data ?? []) as Record<string, unknown>[];
  }

  /**
   * 금융기관 연결을 해제한다 (soft delete).
   * @param userId - 유저 ID
   * @param institutionId - 금융기관 ID
   */
  async disconnectInstitution(
    userId: string,
    institutionId: string,
  ): Promise<void> {
    const client = this.supabaseService.getClient();

    const { error } = await client
      .from('codef_institutions')
      .update({ is_deleted: true })
      .eq('id', institutionId)
      .eq('user_id', userId);

    if (error) {
      this.logger.error(
        `금융기관 연결 해제 실패: ${error.message}`,
        undefined,
        'CodefService',
      );
      throw error;
    }

    this.logger.log(
      `금융기관 연결 해제: 유저=${userId}, 기관=${institutionId}`,
      'CodefService',
    );
  }

  // ─────────────────────────────────────────────
  // 계좌/카드 조회
  // ─────────────────────────────────────────────

  /**
   * 유저의 연결된 계좌 목록을 조회한다.
   * @param userId - 유저 ID
   * @returns 계좌 목록
   */
  async getAccounts(userId: string): Promise<Record<string, unknown>[]> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('codef_accounts')
      .select('*, codef_institutions(organization_name)')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true });

    if (error) {
      this.logger.error(
        `계좌 목록 조회 실패: ${error.message}`,
        undefined,
        'CodefService',
      );
      throw error;
    }

    return (data ?? []) as Record<string, unknown>[];
  }

  /**
   * 유저의 연결된 카드 목록을 조회한다.
   * @param userId - 유저 ID
   * @returns 카드 목록
   */
  async getCards(userId: string): Promise<Record<string, unknown>[]> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('codef_cards')
      .select('*, codef_institutions(organization_name)')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true });

    if (error) {
      this.logger.error(
        `카드 목록 조회 실패: ${error.message}`,
        undefined,
        'CodefService',
      );
      throw error;
    }

    return (data ?? []) as Record<string, unknown>[];
  }

  // ─────────────────────────────────────────────
  // 거래 동기화
  // ─────────────────────────────────────────────

  /**
   * 유저의 모든 계좌/카드 거래를 수동으로 동기화한다.
   * @param userId - 유저 ID
   * @returns 동기화 결과 (동기화된 거래 수)
   */
  async syncAllTransactions(
    userId: string,
  ): Promise<{ syncedCount: number; errors: string[] }> {
    const client = this.supabaseService.getClient();

    // 동기화 로그 시작
    const { data: syncLog } = await client
      .from('sync_logs')
      .insert({
        user_id: userId,
        sync_type: 'full',
        status: 'started',
      })
      .select('id')
      .single();

    const syncLogId = (syncLog as Record<string, unknown>)?.id as string;

    // 커넥티드ID 조회
    const { data: connection } = await client
      .from('codef_connected_ids')
      .select('connected_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!connection) {
      throw new NotFoundException(
        '연결된 금융기관이 없습니다. 먼저 금융기관을 연결해주세요.',
      );
    }

    const connectedId = (connection as Record<string, unknown>)
      .connected_id as string;

    // 동기화 기간 설정: 마지막 동기화 이후 ~ 오늘
    const endDate = this.formatDate(new Date());
    const startDate = await this.getLastSyncDate(userId);

    let totalSynced = 0;
    const errors: string[] = [];

    // 은행 계좌 거래 동기화
    const accounts = await this.getAccounts(userId);
    for (const account of accounts) {
      try {
        const synced = await this.syncBankTransactions(
          userId,
          connectedId,
          account,
          startDate,
          endDate,
        );
        totalSynced += synced;
      } catch (err) {
        const message = `계좌 ${account.account_number as string} 동기화 실패: ${(err as Error).message}`;
        this.logger.error(message, undefined, 'CodefService');
        errors.push(message);
      }
    }

    // 카드 거래 동기화
    const cards = await this.getCards(userId);
    for (const card of cards) {
      try {
        const synced = await this.syncCardTransactions(
          userId,
          connectedId,
          card,
          startDate,
          endDate,
        );
        totalSynced += synced;
      } catch (err) {
        const message = `카드 ${card.card_number as string} 동기화 실패: ${(err as Error).message}`;
        this.logger.error(message, undefined, 'CodefService');
        errors.push(message);
      }
    }

    // 동기화 로그 업데이트
    const status =
      errors.length === 0 ? 'success' : totalSynced > 0 ? 'partial' : 'failed';

    if (syncLogId) {
      await client
        .from('sync_logs')
        .update({
          status,
          synced_count: totalSynced,
          error_message: errors.length > 0 ? errors.join('; ') : null,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLogId);
    }

    this.logger.log(
      `거래 동기화 완료: 유저=${userId}, 동기화=${totalSynced}건, 에러=${errors.length}건`,
      'CodefService',
    );

    return { syncedCount: totalSynced, errors };
  }

  // ─────────────────────────────────────────────
  // 거래 내역 조회
  // ─────────────────────────────────────────────

  /**
   * 거래 내역을 필터 + 페이지네이션으로 조회한다.
   * @param userId - 유저 ID
   * @param dto - 조회 조건
   * @returns 거래 목록 + 전체 건수
   */
  async getTransactions(
    userId: string,
    dto: GetTransactionsDto,
  ): Promise<{ data: Record<string, unknown>[]; total: number }> {
    const client = this.supabaseService.getClient();
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const offset = (page - 1) * limit;

    let query = client
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (dto.startDate) {
      query = query.gte('transaction_date', dto.startDate);
    }
    if (dto.endDate) {
      query = query.lte('transaction_date', dto.endDate);
    }
    if (dto.transactionType) {
      query = query.eq('transaction_type', dto.transactionType);
    }
    if (dto.category) {
      query = query.eq('category', dto.category);
    }
    if (dto.investmentOnly === 'true') {
      query = query.eq('is_investment', true);
    }

    const { data, error, count } = await query;

    if (error) {
      this.logger.error(
        `거래 내역 조회 실패: ${error.message}`,
        undefined,
        'CodefService',
      );
      throw error;
    }

    return {
      data: (data ?? []) as Record<string, unknown>[],
      total: count ?? 0,
    };
  }

  /**
   * 카테고리별 지출 통계를 조회한다.
   * @param userId - 유저 ID
   * @param startDate - 조회 시작일 (YYYY-MM-DD)
   * @param endDate - 조회 종료일 (YYYY-MM-DD)
   * @returns 카테고리별 금액 합계 + 비율
   */
  async getTransactionStats(
    userId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<Record<string, unknown>[]> {
    const client = this.supabaseService.getClient();

    let query = client
      .from('transactions')
      .select('category, amount')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .eq('transaction_type', 'expense');

    if (startDate) {
      query = query.gte('transaction_date', startDate);
    }
    if (endDate) {
      query = query.lte('transaction_date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(
        `거래 통계 조회 실패: ${error.message}`,
        undefined,
        'CodefService',
      );
      throw error;
    }

    // 카테고리별 합산
    const categoryMap = new Map<string, number>();
    let totalExpense = 0;

    for (const row of (data ?? []) as { category: string; amount: number }[]) {
      const absAmount = Math.abs(row.amount);
      categoryMap.set(
        row.category,
        (categoryMap.get(row.category) ?? 0) + absAmount,
      );
      totalExpense += absAmount;
    }

    // 비율 계산 후 금액순 정렬
    const stats = Array.from(categoryMap.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        percentage:
          totalExpense > 0
            ? Math.round((amount / totalExpense) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return stats;
  }

  // ─────────────────────────────────────────────
  // 자산 스냅샷
  // ─────────────────────────────────────────────

  /**
   * 유저의 자산 스냅샷(Day 0)을 조회한다.
   * 현재 총 자산과 머니런 이후 추가 자산도 함께 계산한다.
   * @param userId - 유저 ID
   * @returns 스냅샷 정보 + 현재 자산 + 추가 자산 + 경과 일수
   */
  async getAssetSnapshot(userId: string): Promise<Record<string, unknown>> {
    const client = this.supabaseService.getClient();

    const { data: snapshot } = await client
      .from('asset_snapshots')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!snapshot) {
      throw new NotFoundException(
        '자산 스냅샷이 없습니다. 금융기관을 먼저 연결해주세요.',
      );
    }

    // 현재 총 잔액 계산
    const { data: accounts } = await client
      .from('codef_accounts')
      .select('balance')
      .eq('user_id', userId)
      .eq('is_deleted', false);

    const currentBalance = ((accounts ?? []) as { balance: number }[]).reduce(
      (sum, a) => sum + a.balance,
      0,
    );

    const snapshotData = snapshot as Record<string, unknown>;
    const startBalance = snapshotData.total_balance as number;
    const additionalAsset = currentBalance - startBalance;

    // 경과 일수
    const startDate = new Date(snapshotData.snapshot_date as string);
    const today = new Date();
    const daysPassed = Math.floor(
      (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      snapshotDate: snapshotData.snapshot_date,
      startBalance,
      currentBalance,
      additionalAsset,
      daysPassed,
    };
  }

  // ─────────────────────────────────────────────
  // 거래 카테고리/태그 수동 수정
  // ─────────────────────────────────────────────

  /**
   * 거래의 카테고리와 태그를 수동으로 수정한다.
   * @param userId - 유저 ID
   * @param transactionId - 거래 ID
   * @param category - 새 카테고리
   * @param tags - 새 태그 배열
   * @returns 수정된 거래
   */
  async updateTransactionCategory(
    userId: string,
    transactionId: string,
    category: string,
    tags: string[],
  ): Promise<Record<string, unknown>> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('transactions')
      .update({
        category,
        tags,
        is_investment: isInvestmentCategory(category as Category),
        is_fixed_expense: isFixedExpenseCategory(category as Category),
      })
      .eq('id', transactionId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      this.logger.error(
        `거래 카테고리 수정 실패: ${error.message}`,
        undefined,
        'CodefService',
      );
      throw error;
    }

    return data as Record<string, unknown>;
  }

  // ─────────────────────────────────────────────
  // 크론 작업: 매일 새벽 2시 자동 동기화
  // ─────────────────────────────────────────────

  /**
   * 매일 새벽 2시에 전체 유저의 거래를 자동 동기화한다.
   * 실패 시 최대 3회 재시도한다.
   */
  @Cron('0 2 * * *', { timeZone: 'Asia/Seoul' })
  async handleDailySync(): Promise<void> {
    this.logger.log('일일 자동 거래 동기화 시작', 'CodefService');

    const client = this.supabaseService.getClient();

    // 연결된 유저 목록 조회
    const { data: connections } = await client
      .from('codef_connected_ids')
      .select('user_id');

    if (!connections || connections.length === 0) {
      this.logger.log('동기화할 유저가 없습니다.', 'CodefService');
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const conn of connections as { user_id: string }[]) {
      let retries = 0;
      let success = false;

      while (retries < MAX_SYNC_RETRIES && !success) {
        try {
          await this.syncAllTransactions(conn.user_id);
          success = true;
          successCount++;
        } catch (err) {
          retries++;
          this.logger.error(
            `유저 ${conn.user_id} 동기화 실패 (시도 ${retries}/${MAX_SYNC_RETRIES}): ${(err as Error).message}`,
            undefined,
            'CodefService',
          );

          if (retries >= MAX_SYNC_RETRIES) {
            failCount++;
          }
        }
      }
    }

    this.logger.log(
      `일일 자동 동기화 완료: 성공=${successCount}, 실패=${failCount}`,
      'CodefService',
    );
  }

  // ─────────────────────────────────────────────
  // 내부 헬퍼 메서드
  // ─────────────────────────────────────────────

  /**
   * 은행 계좌 목록을 코드에프에서 조회하여 DB에 저장한다.
   * @returns 동기화된 계좌 수
   */
  private async syncAccounts(
    userId: string,
    connectedId: string,
    organizationCode: string,
    institutionId: string,
  ): Promise<number> {
    const client = this.supabaseService.getClient();

    const accountList = await this.codefApiService.getAccountList(
      connectedId,
      organizationCode,
    );

    const rows = accountList.map((acc) => ({
      user_id: userId,
      institution_id: institutionId,
      account_number: acc.resAccount as string,
      account_name: (acc.resAccountName as string) ?? null,
      bank_code: organizationCode,
      bank_name: this.getOrganizationName(organizationCode),
      balance: parseInt((acc.resAccountBalance as string) ?? '0', 10),
      account_type: (acc.resAccountTypeName as string) ?? null,
    }));

    if (rows.length > 0) {
      const { error } = await client.from('codef_accounts').insert(rows);

      if (error) {
        this.logger.error(
          `계좌 저장 실패: ${error.message}`,
          undefined,
          'CodefService',
        );
        throw error;
      }
    }

    this.logger.log(`계좌 동기화 완료: ${rows.length}건`, 'CodefService');
    return rows.length;
  }

  /**
   * 카드 목록을 코드에프에서 조회하여 DB에 저장한다.
   * @returns 동기화된 카드 수
   */
  private async syncCards(
    userId: string,
    connectedId: string,
    organizationCode: string,
    institutionId: string,
  ): Promise<number> {
    const client = this.supabaseService.getClient();

    const cardList = await this.codefApiService.getCardList(
      connectedId,
      organizationCode,
    );

    const rows = cardList.map((card) => ({
      user_id: userId,
      institution_id: institutionId,
      card_number: card.resCardNo as string,
      card_name: (card.resCardName as string) ?? null,
      card_company_code: organizationCode,
      card_company_name: this.getOrganizationName(organizationCode),
    }));

    if (rows.length > 0) {
      const { error } = await client.from('codef_cards').insert(rows);

      if (error) {
        this.logger.error(
          `카드 저장 실패: ${error.message}`,
          undefined,
          'CodefService',
        );
        throw error;
      }
    }

    this.logger.log(`카드 동기화 완료: ${rows.length}건`, 'CodefService');
    return rows.length;
  }

  /**
   * 은행 거래 내역을 동기화한다.
   * @returns 동기화된 거래 수
   */
  private async syncBankTransactions(
    userId: string,
    connectedId: string,
    account: Record<string, unknown>,
    startDate: string,
    endDate: string,
  ): Promise<number> {
    const client = this.supabaseService.getClient();
    const bankCode = account.bank_code as string;
    const accountNumber = account.account_number as string;
    const accountId = account.id as string;

    const transactions = await this.codefApiService.getBankTransactions(
      connectedId,
      bankCode,
      accountNumber,
      startDate.replace(/-/g, ''),
      endDate.replace(/-/g, ''),
    );

    let syncedCount = 0;

    for (const tx of transactions) {
      const codefTxId = `bank_${accountNumber}_${tx.resAccountTrDate as string}_${tx.resAccountTrTime as string}_${(tx.resAccountOut as string) ?? (tx.resAccountIn as string)}`;

      // 중복 체크
      const { data: existingTx } = await client
        .from('transactions')
        .select('id')
        .eq('codef_transaction_id', codefTxId)
        .maybeSingle();

      if (existingTx) continue;

      const amount =
        parseInt((tx.resAccountIn as string) ?? '0', 10) -
        parseInt((tx.resAccountOut as string) ?? '0', 10);
      const description = (tx.resAccountDesc as string) ?? '';
      const category = classifyCategory(description);
      const tags = getTagsForCategory(category);
      const transactionType =
        amount > 0 ? 'income' : amount < 0 ? 'expense' : 'transfer';

      const { error } = await client.from('transactions').insert({
        user_id: userId,
        account_id: accountId,
        transaction_date: this.parseCodefDate(tx.resAccountTrDate as string),
        transaction_time: (tx.resAccountTrTime as string) ?? null,
        description,
        amount,
        balance_after: parseInt((tx.resAfterTranBalance as string) ?? '0', 10),
        transaction_type: transactionType,
        category,
        tags,
        merchant_name: description,
        is_investment: isInvestmentCategory(category),
        is_fixed_expense: isFixedExpenseCategory(category),
        codef_transaction_id: codefTxId,
      });

      if (error) {
        this.logger.error(
          `거래 저장 실패: ${error.message}`,
          undefined,
          'CodefService',
        );
        continue;
      }

      syncedCount++;
    }

    return syncedCount;
  }

  /**
   * 카드 거래 내역을 동기화한다.
   * @returns 동기화된 거래 수
   */
  private async syncCardTransactions(
    userId: string,
    connectedId: string,
    card: Record<string, unknown>,
    startDate: string,
    endDate: string,
  ): Promise<number> {
    const client = this.supabaseService.getClient();
    const cardCompanyCode = card.card_company_code as string;
    const cardNumber = card.card_number as string;
    const cardId = card.id as string;

    const transactions = await this.codefApiService.getCardTransactions(
      connectedId,
      cardCompanyCode,
      cardNumber,
      startDate.replace(/-/g, ''),
      endDate.replace(/-/g, ''),
    );

    let syncedCount = 0;

    for (const tx of transactions) {
      const codefTxId = `card_${cardNumber}_${tx.resApprovalDate as string}_${tx.resApprovalTime as string}_${tx.resApprovalAmount as string}`;

      // 중복 체크
      const { data: existingTx } = await client
        .from('transactions')
        .select('id')
        .eq('codef_transaction_id', codefTxId)
        .maybeSingle();

      if (existingTx) continue;

      const amount = -Math.abs(
        parseInt((tx.resApprovalAmount as string) ?? '0', 10),
      );
      const description = (tx.resMemberStoreName as string) ?? '';
      const category = classifyCategory(description);
      const tags = getTagsForCategory(category);

      const { error } = await client.from('transactions').insert({
        user_id: userId,
        card_id: cardId,
        transaction_date: this.parseCodefDate(tx.resApprovalDate as string),
        transaction_time: (tx.resApprovalTime as string) ?? null,
        description,
        amount,
        transaction_type: 'expense',
        category,
        tags,
        merchant_name: description,
        is_investment: isInvestmentCategory(category),
        is_fixed_expense: isFixedExpenseCategory(category),
        codef_transaction_id: codefTxId,
      });

      if (error) {
        this.logger.error(
          `카드 거래 저장 실패: ${error.message}`,
          undefined,
          'CodefService',
        );
        continue;
      }

      syncedCount++;
    }

    return syncedCount;
  }

  /**
   * 자산 스냅샷(Day 0)을 생성한다.
   * 현재 모든 계좌의 잔액 합계를 스냅샷으로 저장한다.
   * @param userId - 유저 ID
   */
  private async createAssetSnapshot(userId: string): Promise<void> {
    const client = this.supabaseService.getClient();

    // 이미 스냅샷이 있으면 생성하지 않음
    const { data: existing } = await client
      .from('asset_snapshots')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) return;

    // 현재 총 잔액 계산
    const { data: accounts } = await client
      .from('codef_accounts')
      .select('balance')
      .eq('user_id', userId)
      .eq('is_deleted', false);

    const totalBalance = ((accounts ?? []) as { balance: number }[]).reduce(
      (sum, a) => sum + a.balance,
      0,
    );

    const today = new Date();
    const snapshotDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const { error } = await client.from('asset_snapshots').insert({
      user_id: userId,
      snapshot_date: snapshotDate,
      total_balance: totalBalance,
    });

    if (error) {
      this.logger.error(
        `자산 스냅샷 생성 실패: ${error.message}`,
        undefined,
        'CodefService',
      );
      throw error;
    }

    this.logger.log(
      `자산 스냅샷 생성: 유저=${userId}, 잔액=${totalBalance}원`,
      'CodefService',
    );
  }

  /**
   * 마지막 동기화 날짜를 조회한다.
   * 동기화 이력이 없으면 3개월 전 날짜를 반환한다.
   * @param userId - 유저 ID
   * @returns 날짜 문자열 (YYYY-MM-DD)
   */
  private async getLastSyncDate(userId: string): Promise<string> {
    const client = this.supabaseService.getClient();

    const { data } = await client
      .from('sync_logs')
      .select('completed_at')
      .eq('user_id', userId)
      .eq('status', 'success')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      const completedAt = (data as Record<string, unknown>)
        .completed_at as string;
      return completedAt.split('T')[0];
    }

    // 최초 동기화: 3개월 전부터
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    return this.formatDate(threeMonthsAgo);
  }

  /**
   * Date를 YYYY-MM-DD 형식으로 변환한다.
   * @param date - Date 객체
   * @returns 날짜 문자열
   */
  private formatDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  /**
   * 코드에프 날짜(YYYYMMDD)를 YYYY-MM-DD로 변환한다.
   * @param codefDate - 코드에프 형식 날짜
   * @returns ISO 날짜 문자열
   */
  private parseCodefDate(codefDate: string): string {
    if (codefDate.length !== 8) return codefDate;
    return `${codefDate.slice(0, 4)}-${codefDate.slice(4, 6)}-${codefDate.slice(6, 8)}`;
  }

  /**
   * 금융기관 코드를 기관명으로 변환한다.
   * MVP에서는 주요 기관만 매핑. 추후 확장.
   * @param code - 금융기관 코드
   * @returns 기관명
   */
  private getOrganizationName(code: string): string {
    const names: Record<string, string> = {
      '0001': 'KB국민은행',
      '0002': '산업은행',
      '0003': '기업은행',
      '0004': 'NH농협은행',
      '0007': '수협은행',
      '0011': '신한은행',
      '0020': '우리은행',
      '0023': 'SC제일은행',
      '0027': '한국씨티은행',
      '0031': '대구은행',
      '0032': '부산은행',
      '0034': '광주은행',
      '0035': '제주은행',
      '0037': '전북은행',
      '0039': '경남은행',
      '0045': '새마을금고',
      '0048': '신협',
      '0071': '우체국',
      '0081': 'KEB하나은행',
      '0088': '신한은행',
      '0089': '케이뱅크',
      '0090': '카카오뱅크',
      '0092': '토스뱅크',
      '0301': 'KB국민카드',
      '0302': '현대카드',
      '0303': '삼성카드',
      '0304': 'NH농협카드',
      '0305': '롯데카드',
      '0306': '하나카드',
      '0307': 'BC카드',
      '0309': '신한카드',
      '0311': '씨티카드',
      '0313': '우리카드',
    };

    return names[code] ?? `기관(${code})`;
  }
}
