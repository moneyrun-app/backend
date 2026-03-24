import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { WinstonModule } from 'nest-winston';
import { createWinstonConfig } from './common/logger/winston.config.js';
import { SupabaseModule } from './common/supabase/supabase.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { CodefModule } from './codef/codef.module.js';
import { BlocksModule } from './blocks/blocks.module.js';
import { SignalModule } from './signal/signal.module.js';
import { CommunityModule } from './community/community.module.js';
import { AiModule } from './ai/ai.module.js';
import { PacemakerModule } from './pacemaker/pacemaker.module.js';

@Module({
  imports: [
    // 환경변수 로드 (글로벌)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // 크론 작업 스케줄러 (글로벌)
    ScheduleModule.forRoot(),

    // Winston 로거 (글로벌)
    WinstonModule.forRoot(
      createWinstonConfig(process.env.NODE_ENV ?? 'development'),
    ),

    // Supabase 클라이언트 (글로벌)
    SupabaseModule,

    // 기능 모듈
    AuthModule,
    UsersModule,
    CodefModule,
    BlocksModule,
    SignalModule,
    CommunityModule,
    AiModule,
    PacemakerModule,
  ],
})
export class AppModule {}
