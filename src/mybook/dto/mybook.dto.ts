import { ApiProperty } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsIn, IsArray, IsUrl,
  MaxLength, Min, Max, IsNumber,
} from 'class-validator';
import { Transform } from 'class-transformer';

/** 스크랩 저장 DTO */
export class CreateScrapDto {
  @ApiProperty({ description: '콘텐츠 URL', example: 'https://youtube.com/watch?v=abc' })
  @IsUrl()
  url!: string;

  @ApiProperty({ description: '유입 방식', enum: ['share', 'copy'] })
  @IsIn(['share', 'copy'])
  sourceMethod!: 'share' | 'copy';
}

/** 스크랩 목록 조회 DTO */
export class GetScrapsDto {
  @ApiProperty({ description: '채널 필터', required: false, enum: ['youtube', 'threads', 'community', 'etc'] })
  @IsOptional()
  @IsIn(['youtube', 'threads', 'community', 'etc'])
  channel?: string;

  @ApiProperty({ description: '검색어 (제목, 요약, 크리에이터)', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiProperty({ description: '페이지 번호', required: false })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ description: '페이지당 항목 수', required: false })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

/** 관심 키워드 설정 DTO */
export class SetKeywordsDto {
  @ApiProperty({ description: '관심 키워드 목록', example: ['투자', '부동산', '청년정책'] })
  @IsArray()
  @IsString({ each: true })
  keywords!: string[];
}
