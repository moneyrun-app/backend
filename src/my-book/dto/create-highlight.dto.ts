import { IsInt, IsString, IsOptional, IsIn, Min } from 'class-validator';

export class CreateHighlightDto {
  @IsInt()
  @Min(0)
  chapterIndex: number;

  @IsString()
  sentenceText: string;

  @IsString()
  @IsIn(['yellow', 'green', 'blue', 'pink', 'orange'])
  color: string;

  @IsOptional()
  @IsString()
  note?: string;
}
