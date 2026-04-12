import { Module } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';
import { MyBookController } from './my-book.controller';
import { MyBookService } from './my-book.service';

@Module({
  imports: [FinanceModule],
  controllers: [MyBookController],
  providers: [MyBookService],
  exports: [MyBookService],
})
export class MyBookModule {}
