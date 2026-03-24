import { Module } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard.js';

/**
 * 인증 모듈.
 * JWT 검증 가드만 제공한다. 로그인/토큰 발급은 프론트에서 Supabase SDK로 처리.
 */
@Module({
  providers: [AuthGuard],
  exports: [AuthGuard],
})
export class AuthModule {}
