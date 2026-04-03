import { IsString, IsOptional } from 'class-validator';

export class GenerateReportDto {
  @IsString()
  @IsOptional()
  paymentToken?: string;
}
