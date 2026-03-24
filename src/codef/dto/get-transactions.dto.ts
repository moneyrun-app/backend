import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsNumber,
  IsIn,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * 거래 내역 조회 쿼리 DTO.
 * 기간, 카테고리, 유형 필터 + 페이지네이션을 지원한다.
 */
export class GetTransactionsDto {
  @ApiProperty({
    description: '조회 시작일 (YYYY-MM-DD)',
    example: '2026-03-01',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: '조회 종료일 (YYYY-MM-DD)',
    example: '2026-03-31',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    description: '거래 유형 필터 (income/expense/transfer)',
    example: 'expense',
    required: false,
    enum: ['income', 'expense', 'transfer'],
  })
  @IsOptional()
  @IsIn(['income', 'expense', 'transfer'])
  transactionType?: 'income' | 'expense' | 'transfer';

  @ApiProperty({
    description: '카테고리 필터',
    example: '외식',
    required: false,
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({
    description: '투자 내역만 조회',
    example: 'true',
    required: false,
    enum: ['true', 'false'],
  })
  @IsOptional()
  @IsIn(['true', 'false'])
  investmentOnly?: string;

  @ApiProperty({
    description: '페이지 번호 (1부터 시작)',
    example: 1,
    required: false,
    default: 1,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: '페이지당 항목 수',
    example: 20,
    required: false,
    default: 20,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
