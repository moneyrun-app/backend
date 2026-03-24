import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase 클라이언트를 관리하는 서비스.
 * Service Role Key를 사용하므로 RLS를 우회할 수 있다.
 * 유저 데이터 접근 시 반드시 user_id 조건을 쿼리에 포함해야 한다.
 */
@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.getOrThrow<string>('SUPABASE_URL');
    const supabaseKey = this.configService.getOrThrow<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    this.client = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Supabase 클라이언트 인스턴스를 반환한다.
   * @returns Supabase 클라이언트
   */
  getClient(): SupabaseClient {
    return this.client;
  }
}
