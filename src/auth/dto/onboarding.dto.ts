import { IsInt, IsPositive, IsString, IsOptional, Min } from 'class-validator';

export class OnboardingDto {
  @IsString()
  nickname: string;

  @IsInt()
  @IsPositive()
  age: number;

  @IsInt()
  @IsPositive()
  retirementAge: number;

  @IsInt()
  @IsPositive()
  @IsOptional()
  pensionStartAge?: number; // 기본값 65

  @IsInt()
  @IsPositive()
  monthlyIncome: number;

  @IsInt()
  @Min(0)
  monthlyFixedCost: number;

  @IsInt()
  @Min(0)
  monthlyVariableCost: number;
}
