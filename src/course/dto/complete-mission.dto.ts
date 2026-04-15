import { IsOptional, IsString } from 'class-validator';

export class CompleteMissionDto {
  @IsString()
  @IsOptional()
  note?: string;
}
