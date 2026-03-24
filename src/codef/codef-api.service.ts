import { Injectable, Inject } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

/** 코드에프 API 응답 공통 구조 */
interface CodefResponse {
  result: {
    code: string;
    extraMessage: string;
    message: string;
    transactionId: string;
  };
  data: unknown;
}

/** 코드에프 토큰 응답 */
interface CodefTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * 코드에프 API와 직접 통신하는 저수준 서비스.
 * 토큰 관리, connectedId 생성/추가, 계좌/카드/거래 조회를 담당한다.
 */
@Injectable()
export class CodefApiService {
  /** 캐싱된 액세스 토큰 */
  private accessToken: string | null = null;
  /** 토큰 만료 시각 (밀리초) */
  private tokenExpiresAt = 0;

  private readonly apiUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(
    private readonly configService: ConfigService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {
    this.apiUrl = this.configService.getOrThrow<string>('CODEF_API_URL');
    this.clientId = this.configService.getOrThrow<string>('CODEF_CLIENT_ID');
    this.clientSecret = this.configService.getOrThrow<string>(
      'CODEF_CLIENT_SECRET',
    );
  }

  /**
   * 코드에프 OAuth 액세스 토큰을 발급받는다.
   * 캐싱된 토큰이 유효하면 재사용, 만료되었으면 재발급한다.
   * @returns 액세스 토큰
   */
  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    this.logger.log('코드에프 액세스 토큰 발급 요청', 'CodefApiService');

    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`,
    ).toString('base64');

    const response = await fetch('https://oauth.codef.io/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: 'grant_type=client_credentials&scope=read',
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(
        `코드에프 토큰 발급 실패: ${response.status} ${errorText}`,
        undefined,
        'CodefApiService',
      );
      throw new Error(`코드에프 토큰 발급 실패: ${response.status}`);
    }

    const data = (await response.json()) as CodefTokenResponse;
    this.accessToken = data.access_token;
    // 만료 5분 전에 갱신하도록 여유 시간 설정
    this.tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;

    this.logger.log('코드에프 액세스 토큰 발급 완료', 'CodefApiService');
    return this.accessToken;
  }

  /**
   * 코드에프 API를 호출한다.
   * @param endpoint - API 엔드포인트 경로
   * @param body - 요청 바디
   * @returns 코드에프 응답 데이터
   */
  private async callApi(
    endpoint: string,
    body: Record<string, unknown>,
  ): Promise<CodefResponse> {
    const token = await this.getAccessToken();

    const response = await fetch(`${this.apiUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(
        `코드에프 API 호출 실패: ${endpoint} ${response.status} ${errorText}`,
        undefined,
        'CodefApiService',
      );
      throw new Error(
        `코드에프 API 호출 실패: ${endpoint} (${response.status})`,
      );
    }

    const result = (await response.json()) as CodefResponse;

    // 코드에프 응답 코드 확인 (CF-00000이 성공)
    if (result.result.code !== 'CF-00000') {
      this.logger.error(
        `코드에프 API 에러: ${endpoint} [${result.result.code}] ${result.result.message}`,
        undefined,
        'CodefApiService',
      );
      throw new Error(
        `코드에프 에러: [${result.result.code}] ${result.result.message}`,
      );
    }

    return result;
  }

  /**
   * 새로운 커넥티드ID를 생성한다. (최초 금융기관 연결 시)
   * @param organizationCode - 금융기관 코드
   * @param loginId - 로그인 ID
   * @param loginPassword - 로그인 비밀번호
   * @returns 생성된 connectedId
   */
  async createConnectedId(
    organizationCode: string,
    loginId: string,
    loginPassword: string,
  ): Promise<string> {
    this.logger.log(
      `커넥티드ID 생성 요청: 기관코드=${organizationCode}`,
      'CodefApiService',
    );

    const encodedPassword = Buffer.from(loginPassword).toString('base64');

    const result = await this.callApi('/v1/account/create', {
      accountList: [
        {
          countryCode: 'KR',
          businessType: 'BK',
          clientType: 'P',
          organization: organizationCode,
          loginType: '1',
          id: loginId,
          password: encodedPassword,
        },
      ],
    });

    const data = result.data as { connectedId: string };
    this.logger.log(
      `커넥티드ID 생성 완료: ${data.connectedId}`,
      'CodefApiService',
    );
    return data.connectedId;
  }

  /**
   * 기존 커넥티드ID에 금융기관을 추가한다.
   * @param connectedId - 기존 커넥티드ID
   * @param organizationCode - 금융기관 코드
   * @param loginId - 로그인 ID
   * @param loginPassword - 로그인 비밀번호
   */
  async addToConnectedId(
    connectedId: string,
    organizationCode: string,
    loginId: string,
    loginPassword: string,
  ): Promise<void> {
    this.logger.log(
      `커넥티드ID에 기관 추가: connectedId=${connectedId}, 기관코드=${organizationCode}`,
      'CodefApiService',
    );

    const encodedPassword = Buffer.from(loginPassword).toString('base64');

    await this.callApi('/v1/account/add', {
      connectedId,
      accountList: [
        {
          countryCode: 'KR',
          businessType: 'BK',
          clientType: 'P',
          organization: organizationCode,
          loginType: '1',
          id: loginId,
          password: encodedPassword,
        },
      ],
    });

    this.logger.log(
      `커넥티드ID에 기관 추가 완료: ${organizationCode}`,
      'CodefApiService',
    );
  }

  /**
   * 은행 계좌 목록을 조회한다.
   * @param connectedId - 커넥티드ID
   * @param organizationCode - 은행 코드
   * @returns 계좌 목록 배열
   */
  async getAccountList(
    connectedId: string,
    organizationCode: string,
  ): Promise<Record<string, unknown>[]> {
    this.logger.log(
      `계좌 목록 조회: 기관코드=${organizationCode}`,
      'CodefApiService',
    );

    const result = await this.callApi('/v1/kr/bank/p/account/account-list', {
      connectedId,
      organization: organizationCode,
      birthDate: '',
    });

    const data = result.data as Record<string, unknown>[];
    return Array.isArray(data) ? data : [];
  }

  /**
   * 카드 목록을 조회한다.
   * @param connectedId - 커넥티드ID
   * @param organizationCode - 카드사 코드
   * @returns 카드 목록 배열
   */
  async getCardList(
    connectedId: string,
    organizationCode: string,
  ): Promise<Record<string, unknown>[]> {
    this.logger.log(
      `카드 목록 조회: 기관코드=${organizationCode}`,
      'CodefApiService',
    );

    const result = await this.callApi('/v1/kr/card/p/account/card-list', {
      connectedId,
      organization: organizationCode,
    });

    const data = result.data as Record<string, unknown>[];
    return Array.isArray(data) ? data : [];
  }

  /**
   * 은행 거래 내역을 조회한다.
   * @param connectedId - 커넥티드ID
   * @param organizationCode - 은행 코드
   * @param accountNumber - 계좌번호
   * @param startDate - 조회 시작일 (YYYYMMDD)
   * @param endDate - 조회 종료일 (YYYYMMDD)
   * @returns 거래 내역 배열
   */
  async getBankTransactions(
    connectedId: string,
    organizationCode: string,
    accountNumber: string,
    startDate: string,
    endDate: string,
  ): Promise<Record<string, unknown>[]> {
    this.logger.log(
      `은행 거래 조회: 기관=${organizationCode}, 계좌=${accountNumber}, 기간=${startDate}~${endDate}`,
      'CodefApiService',
    );

    const result = await this.callApi(
      '/v1/kr/bank/p/account/transaction-list',
      {
        connectedId,
        organization: organizationCode,
        account: accountNumber,
        startDate,
        endDate,
        orderBy: '0', // 최신순
      },
    );

    const data = result.data as {
      resTrHistoryList?: Record<string, unknown>[];
    };
    return data.resTrHistoryList ?? [];
  }

  /**
   * 카드 거래 내역(청구 내역)을 조회한다.
   * @param connectedId - 커넥티드ID
   * @param organizationCode - 카드사 코드
   * @param cardNumber - 카드번호
   * @param startDate - 조회 시작일 (YYYYMMDD)
   * @param endDate - 조회 종료일 (YYYYMMDD)
   * @returns 거래 내역 배열
   */
  async getCardTransactions(
    connectedId: string,
    organizationCode: string,
    cardNumber: string,
    startDate: string,
    endDate: string,
  ): Promise<Record<string, unknown>[]> {
    this.logger.log(
      `카드 거래 조회: 기관=${organizationCode}, 카드=${cardNumber}, 기간=${startDate}~${endDate}`,
      'CodefApiService',
    );

    const result = await this.callApi('/v1/kr/card/p/account/approval-list', {
      connectedId,
      organization: organizationCode,
      cardNo: cardNumber,
      startDate,
      endDate,
      orderBy: '0',
    });

    const data = result.data as {
      resApprovalList?: Record<string, unknown>[];
    };
    return data.resApprovalList ?? [];
  }
}
