import { IsInt, Min, IsOptional } from 'class-validator';

export class UpdateFixedExpensesDto {
  @IsInt()
  @Min(0)
  @IsOptional()
  rent?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  utilities?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  phone?: number;
}
