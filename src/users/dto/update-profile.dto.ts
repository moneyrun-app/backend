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
 * 프로필 수정 요청 DTO.
 * 모든 필드가 선택적이다 — 보내진 필드만 업데이트한다.
 */
export class UpdateProfileDto {
  @ApiProperty({ description: '닉네임', required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  nickname?: string;

  @ApiProperty({ description: '거주지', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  residence?: string;

  @ApiProperty({ description: '연소득 (만원 단위)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  annualIncome?: number;

  @ApiProperty({ description: '중소기업 재직 여부', required: false })
  @IsOptional()
  @IsBoolean()
  isSme?: boolean;

  @ApiProperty({ description: '장기 목표 이름', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  goalName?: string;

  @ApiProperty({ description: '장기 목표 금액 (만원 단위)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  goalAmount?: number;
}
