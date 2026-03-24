import { Module } from '@nestjs/common';
import { SignalController } from './signal.controller.js';
import { SignalService } from './signal.service.js';

@Module({
  controllers: [SignalController],
  providers: [SignalService],
  exports: [SignalService],
})
export class SignalModule {}
