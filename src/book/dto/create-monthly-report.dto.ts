import { IsString, IsOptional, IsIn, IsArray, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ProposalCheckDto {
  @IsString()
  proposalId: string;

  @IsBoolean()
  checked: boolean;
}

export class CreateMonthlyReportDto {
  @IsString()
  @IsOptional()
  month?: string;  // '2026-03' — 미입력 시 현재 월

  @IsString()
  @IsIn(['good', 'okay', 'tight', 'bad'])
  overallFeeling: string;

  @IsString()
  @IsOptional()
  memo?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProposalCheckDto)
  @IsOptional()
  proposalChecks?: ProposalCheckDto[];
}
