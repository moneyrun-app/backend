import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';

/**
 * JWT 검증 가드.
 * Authorization 헤더의 Bearer 토큰을 Supabase JWT Secret으로 검증한다.
 * 검증 성공 시 request.user에 JWT payload를 저장한다.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('인증 토큰이 필요합니다.');
    }

    try {
      const secret = this.configService.getOrThrow<string>(
        'SUPABASE_JWT_SECRET',
      );
      const payload = jwt.verify(token, secret) as jwt.JwtPayload;
      (request as Request & { user: jwt.JwtPayload }).user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }
  }

  /**
   * Authorization 헤더에서 Bearer 토큰을 추출한다.
   * @param request - HTTP 요청 객체
   * @returns 토큰 문자열 또는 undefined
   */
  private extractToken(request: Request): string | undefined {
    const authorization = request.headers.authorization;
    if (!authorization) return undefined;

    const [type, token] = authorization.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
