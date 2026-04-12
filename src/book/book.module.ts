import { Module } from '@nestjs/common';
import { BookController } from './book.controller';
import { BookService } from './book.service';
import { ReportGenerator } from './report.generator';
import { ReportCalculator } from './report-calculator';
import { ScraperService } from './scraper.service';
import { FinanceModule } from '../finance/finance.module';
import { ConstantsModule } from '../constants/constants.module';

@Module({
  imports: [FinanceModule, ConstantsModule],
  controllers: [BookController],
  providers: [
    BookService,
    ReportGenerator,
    ReportCalculator,
    ScraperService,
  ],
  exports: [BookService],
})
export class BookModule {}
