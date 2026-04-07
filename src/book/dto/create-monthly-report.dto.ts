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
