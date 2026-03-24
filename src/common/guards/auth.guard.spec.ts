import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { AuthGuard } from './auth.guard.js';

const TEST_SECRET = 'test-jwt-secret-key-for-unit-tests';

/** ExecutionContext mock을 생성하는 헬퍼 */
function createMockContext(authorizationHeader?: string) {
  const request: Record<string, unknown> = {
    headers: {
      authorization: authorizationHeader,
    },
  };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    request,
  };
}

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let configService: ConfigService;

  beforeEach(() => {
    configService = {
      getOrThrow: jest.fn().mockReturnValue(TEST_SECRET),
    } as unknown as ConfigService;
    guard = new AuthGuard(configService);
  });

  it('유효한 JWT 토큰이면 true를 반환하고 request.user에 payload를 저장한다', () => {
    const payload = { sub: 'user-123', email: 'test@test.com' };
    const token = jwt.sign(payload, TEST_SECRET);
    const ctx = createMockContext(`Bearer ${token}`);

    const result = guard.canActivate(ctx as never);

    expect(result).toBe(true);
    expect(
      (ctx.request as Record<string, unknown> & { user: jwt.JwtPayload }).user
        .sub,
    ).toBe('user-123');
  });

  it('Authorization 헤더가 없으면 UnauthorizedException을 던진다', () => {
    const ctx = createMockContext(undefined);

    expect(() => guard.canActivate(ctx as never)).toThrow(
      UnauthorizedException,
    );
    expect(() => guard.canActivate(ctx as never)).toThrow(
      '인증 토큰이 필요합니다.',
    );
  });

  it('Bearer 형식이 아니면 UnauthorizedException을 던진다', () => {
    const ctx = createMockContext('Basic some-token');

    expect(() => guard.canActivate(ctx as never)).toThrow(
      UnauthorizedException,
    );
    expect(() => guard.canActivate(ctx as never)).toThrow(
      '인증 토큰이 필요합니다.',
    );
  });

  it('만료된 토큰이면 UnauthorizedException을 던진다', () => {
    const token = jwt.sign(
      { sub: 'user-123' },
      TEST_SECRET,
      { expiresIn: -10 },
    );
    const ctx = createMockContext(`Bearer ${token}`);

    expect(() => guard.canActivate(ctx as never)).toThrow(
      UnauthorizedException,
    );
    expect(() => guard.canActivate(ctx as never)).toThrow(
      '유효하지 않은 토큰입니다.',
    );
  });

  it('잘못된 시크릿으로 서명된 토큰이면 UnauthorizedException을 던진다', () => {
    const token = jwt.sign({ sub: 'user-123' }, 'wrong-secret');
    const ctx = createMockContext(`Bearer ${token}`);

    expect(() => guard.canActivate(ctx as never)).toThrow(
      UnauthorizedException,
    );
    expect(() => guard.canActivate(ctx as never)).toThrow(
      '유효하지 않은 토큰입니다.',
    );
  });

  it('형식이 깨진 토큰이면 UnauthorizedException을 던진다', () => {
    const ctx = createMockContext('Bearer not-a-valid-jwt');

    expect(() => guard.canActivate(ctx as never)).toThrow(
      UnauthorizedException,
    );
  });
});
