import { IsString, IsNotEmpty, IsInt, Min, IsOptional } from 'class-validator';

export class CreateGoodSpendingDto {
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

export class UpdateGoodSpendingDto {
  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  label?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  amount?: number;
}
