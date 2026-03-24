import { Global, Module } from '@nestjs/common';
import { AiService } from './ai.service.js';

/**
 * AI 글로벌 모듈.
 * 페이스메이커, 마이북 등 여러 모듈에서 주입받아 사용한다.
 */
@Global()
@Module({
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
