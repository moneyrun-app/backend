import { IsUUID, IsString, IsIn, IsOptional } from 'class-validator';

export class FeedbackDto {
  @IsUUID()
  messageId: string;

  @IsString()
  @IsIn(['inaccurate', 'offensive', 'other'])
  type: string;

  @IsString()
  @IsOptional()
  content?: string;
}
