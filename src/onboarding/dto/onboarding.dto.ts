import {
  IsInt,
  IsPositive,
  IsArray,
  ValidateNested,
  IsString,
  IsNotEmpty,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

class GoodSpendingDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  label: string;

  @IsInt()
  @Min(0)
  amount: number;
}

class FixedExpensesDto {
  @IsInt()
  @Min(0)
  rent: number;

  @IsInt()
  @Min(0)
  utilities: number;

  @IsInt()
  @Min(0)
  phone: number;
}

export class OnboardingDto {
  @IsInt()
  @IsPositive()
  age: number;

  @IsInt()
  @IsPositive()
  monthlyIncome: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GoodSpendingDto)
  goodSpendings: GoodSpendingDto[];

  @ValidateNested()
  @Type(() => FixedExpensesDto)
  fixedExpenses: FixedExpensesDto;
}
