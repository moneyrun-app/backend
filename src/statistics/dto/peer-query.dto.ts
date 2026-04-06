import { IsInt, IsPositive, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PeerQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(18)
  age: number;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  monthlyIncome: number;
}
