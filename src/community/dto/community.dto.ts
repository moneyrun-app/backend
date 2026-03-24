import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  MaxLength,
  MinLength,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * 게시글 작성 DTO
 */
export class CreatePostDto {
  @ApiProperty({ description: '게시글 내용', example: '이번 달 커피값 절약 성공!' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}

/**
 * 게시글 수정 DTO
 */
export class UpdatePostDto {
  @ApiProperty({ description: '수정할 게시글 내용' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}

/**
 * 댓글 작성 DTO
 */
export class CreateCommentDto {
  @ApiProperty({ description: '댓글 내용', example: '대단해요!' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  content!: string;
}

/**
 * 게시글 목록 조회 쿼리 DTO
 */
export class GetPostsDto {
  @ApiProperty({
    description: '소득 그룹 필터',
    example: 'middle',
    required: false,
    enum: ['basic', 'middle', 'high'],
  })
  @IsOptional()
  @IsIn(['basic', 'middle', 'high'])
  incomeGroup?: string;

  @ApiProperty({
    description: '신호등 등급 필터',
    example: 'green',
    required: false,
    enum: ['red', 'yellow', 'green'],
  })
  @IsOptional()
  @IsIn(['red', 'yellow', 'green'])
  signalGrade?: string;

  @ApiProperty({ description: '페이지 번호', example: 1, required: false })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ description: '페이지당 항목 수', example: 20, required: false })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
