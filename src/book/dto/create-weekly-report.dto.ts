import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

class WeekStatusDto {
  @IsString()
  @IsIn(['good', 'okay', 'tight', 'bad'])
  overallFeeling: string;

  @IsString()
  @IsOptional()
  memo?: string;
}

export class CreateWeeklyReportDto {
  @ValidateNested()
  @Type(() => WeekStatusDto)
  weekStatus: WeekStatusDto;
}
