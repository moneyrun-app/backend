import { IsInt, IsPositive, IsString, IsOptional, Min } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  nickname?: string;

  @IsInt()
  @IsPositive()
  @IsOptional()
  age?: number;

  @IsInt()
  @IsPositive()
  @IsOptional()
  retirementAge?: number;

  @IsInt()
  @IsPositive()
  @IsOptional()
  pensionStartAge?: number;

  @IsInt()
  @IsPositive()
  @IsOptional()
  monthlyIncome?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  monthlyInvestment?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  monthlyFixedCost?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  monthlyVariableCost?: number;
}
