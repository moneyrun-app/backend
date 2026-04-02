import { IsInt, IsPositive, IsOptional } from 'class-validator';

export class UpdateProfileDto {
  @IsInt()
  @IsPositive()
  @IsOptional()
  age?: number;

  @IsInt()
  @IsPositive()
  @IsOptional()
  monthlyIncome?: number;
}
