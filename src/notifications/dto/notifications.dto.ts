import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

/** 알림 목록 조회 DTO */
export class GetNotificationsDto {
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
