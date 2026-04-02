import { Module } from '@nestjs/common';
import { PacemakerController } from './pacemaker.controller';
import { PacemakerService } from './pacemaker.service';
import { MessageGenerator } from './message.generator';
import { FinanceModule } from '../finance/finance.module';
import { ConstantsModule } from '../constants/constants.module';

@Module({
  imports: [FinanceModule, ConstantsModule],
  controllers: [PacemakerController],
  providers: [PacemakerService, MessageGenerator],
})
export class PacemakerModule {}
