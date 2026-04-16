import { IsInt, IsPositive, IsString, IsIn, Min } from 'class-validator';

export class PreOnboardingDto {
  @IsString()
  nickname: string;

  @IsString()
  @IsIn(['연금', '주식', '부동산', '세금_연말정산', '소비_저축'])
  category: string;

  @IsInt()
  @IsPositive()
  age: number;

  @IsInt()
  @IsPositive()
  monthlyIncome: number;

  @IsInt()
  @Min(0)
  monthlyInvestment: number;

  @IsInt()
  @Min(0)
  monthlyFixedCost: number; // 투자금 포함

  @IsInt()
  @Min(0)
  monthlyVariableCost: number;

  @IsInt()
  @IsPositive()
  retirementAge: number;

  @IsInt()
  @IsPositive()
  pensionStartAge: number;
}
