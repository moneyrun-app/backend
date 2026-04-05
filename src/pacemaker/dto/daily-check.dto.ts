import { IsDateString, IsString, IsIn, IsInt, Min, IsOptional } from 'class-validator';

export class CreateDailyCheckDto {
  @IsDateString()
  date: string; // YYYY-MM-DD

  @IsString()
  @IsIn(['green', 'yellow', 'red'])
  status: 'green' | 'yellow' | 'red';

  @IsInt()
  @Min(0)
  @IsOptional()
  amount?: number; // 천원 단위, 기본 0
}
