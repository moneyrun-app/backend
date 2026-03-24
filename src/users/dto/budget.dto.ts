import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

/**
 * 예산 설정 요청 DTO.
 * 월 소득, 고정비, 저축 목표를 받아서 주간/일 예산을 자동 계산한다.
 */
export class SetBudgetDto {
  @ApiProperty({ description: '월 소득 (원)', example: 2500000 })
  @IsNumber()
  @Min(0)
  monthlyIncome!: number;

  @ApiProperty({ description: '월 고정비 (원)', example: 800000 })
  @IsNumber()
  @Min(0)
  fixedExpenses!: number;

  @ApiProperty({ description: '월 저축 목표 (원)', example: 500000 })
  @IsNumber()
  @Min(0)
  savingsGoal!: number;
}
