import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service.js';

/**
 * Supabase 글로벌 모듈.
 * 전체 앱에서 SupabaseService를 주입받아 사용할 수 있도록 한다.
 */
@Global()
@Module({
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class SupabaseModule {}
