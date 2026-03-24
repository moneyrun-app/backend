import { Module } from '@nestjs/common';
import { MybookController } from './mybook.controller.js';
import { MybookService } from './mybook.service.js';

@Module({
  controllers: [MybookController],
  providers: [MybookService],
  exports: [MybookService],
})
export class MybookModule {}
