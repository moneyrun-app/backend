import { Module, forwardRef } from '@nestjs/common';
import { BookController } from './book.controller';
import { BookService } from './book.service';
import { ReportGenerator } from './report.generator';
import { FinanceModule } from '../finance/finance.module';
import { ConstantsModule } from '../constants/constants.module';

@Module({
  imports: [forwardRef(() => FinanceModule), ConstantsModule],
  controllers: [BookController],
  providers: [BookService, ReportGenerator],
  exports: [BookService],
})
export class BookModule {}
