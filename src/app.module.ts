import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { createWinstonConfig } from './common/logger/winston.config.js';
import { SupabaseModule } from './common/supabase/supabase.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    // 환경변수 로드 (글로벌)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Winston 로거 (글로벌)
    WinstonModule.forRoot(
      createWinstonConfig(process.env.NODE_ENV ?? 'development'),
    ),

    // Supabase 클라이언트 (글로벌)
    SupabaseModule,

    // 기능 모듈
    AuthModule,
    UsersModule,
  ],
})
export class AppModule {}
