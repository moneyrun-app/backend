import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * 소비 블록 조회 쿼리 DTO.
 * 연도와 월을 지정하여 일별/주별/월별 블록을 조회한다.
 */
export class GetBlocksDto {
  @ApiProperty({ description: '조회 연도', example: 2026 })
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsNumber()
  @Min(2020)
  year!: number;

  @ApiProperty({ description: '조회 월 (1~12)', example: 3 })
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsNumber()
  @Min(1)
  @Max(12)
  month!: number;
}
