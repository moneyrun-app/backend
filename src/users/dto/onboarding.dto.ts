import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * 온보딩 요청 DTO.
 * 유저가 최초 가입 후 기본 정보를 입력할 때 사용한다.
 */
export class OnboardingDto {
  @ApiProperty({ description: '닉네임', example: '절약러너' })
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  nickname!: string;

  @ApiProperty({ description: '생년 (YYYY)', example: 1998 })
  @IsNumber()
  @Min(1950)
  birthYear!: number;

  @ApiProperty({ description: '거주지', example: '서울' })
  @IsString()
  @MaxLength(50)
  residence!: string;

  @ApiProperty({ description: '연소득 (만원 단위)', example: 3000 })
  @IsNumber()
  @Min(0)
  annualIncome!: number;

  @ApiProperty({ description: '중소기업 재직 여부', example: true })
  @IsBoolean()
  isSme!: boolean;

  @ApiProperty({
    description: '장기 목표 이름',
    example: '경제적 자유',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  goalName?: string;

  @ApiProperty({
    description: '장기 목표 금액 (만원 단위)',
    example: 50000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  goalAmount?: number;
}
