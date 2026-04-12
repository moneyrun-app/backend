import { Module } from '@nestjs/common';
import { MoneyBookController } from './money-book.controller';
import { MoneyBookService } from './money-book.service';
import { AdminMoneyBookController } from './admin-money-book.controller';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [FinanceModule],
  controllers: [MoneyBookController, AdminMoneyBookController],
  providers: [MoneyBookService],
  exports: [MoneyBookService],
})
export class MoneyBookModule {}
