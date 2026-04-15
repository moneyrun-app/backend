import { IsObject, IsOptional, IsString, IsInt, IsPositive, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class FinanceDataDto {
  @IsString()
  nickname: string;

  @IsInt()
  @IsPositive()
  age: number;

  @IsInt()
  @IsPositive()
  retirementAge: number;

  @IsInt()
  @IsOptional()
  pensionStartAge?: number;

  @IsInt()
  @IsPositive()
  monthlyIncome: number;

  @IsInt()
  @Min(0)
  monthlyInvestment: number;

  @IsInt()
  @Min(0)
  monthlyFixedCost: number;

  @IsInt()
  @Min(0)
  monthlyVariableCost: number;
}

export class SubmitFinanceDataDto {
  @ValidateNested()
  @Type(() => FinanceDataDto)
  financeData: FinanceDataDto;

  @IsObject()
  @IsOptional()
  courseExtraData?: Record<string, any>;
}
