import { IsString, IsOptional, IsBoolean, IsObject, IsArray } from 'class-validator';

export class CreateMoneyBookDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @IsOptional()
  @IsObject()
  requiredFields?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateMoneyBookDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @IsOptional()
  @IsObject()
  requiredFields?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class CreateChapterDto {
  @IsString()
  title: string;

  @IsString()
  promptTemplate: string;

  @IsOptional()
  chapterOrder?: number;
}

export class UpdateChapterDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  promptTemplate?: string;

  @IsOptional()
  chapterOrder?: number;
}
