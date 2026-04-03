import { IsInt, IsPositive, IsNumber, IsOptional, Min } from 'class-validator';

export class OnboardingDto {
  @IsInt()
  @IsPositive()
  age: number;

  @IsInt()
  @IsPositive()
  monthlyIncome: number;

  @IsInt()
  @Min(0)
  monthlyFixedCost: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  monthlyInvestment?: number;

  @IsNumber()
  @IsOptional()
  expectedReturn?: number;

  @IsInt()
  @IsOptional()
  investmentYears?: number;
}
