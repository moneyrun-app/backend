import { Module } from '@nestjs/common';
import { CodefController } from './codef.controller.js';
import { CodefService } from './codef.service.js';
import { CodefApiService } from './codef-api.service.js';

@Module({
  controllers: [CodefController],
  providers: [CodefService, CodefApiService],
  exports: [CodefService],
})
export class CodefModule {}
