import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsIn, MaxLength } from 'class-validator';

/**
 * 금융기관 연결 요청 DTO.
 * 유저가 은행/카드사를 마이데이터에 연결할 때 사용한다.
 */
export class ConnectInstitutionDto {
  @ApiProperty({
    description: '금융기관 코드 (코드에프 기관코드)',
    example: '0004',
  })
  @IsString()
  @MaxLength(10)
  organizationCode!: string;

  @ApiProperty({
    description: '금융기관 유형 (bank: 은행, card: 카드사)',
    example: 'bank',
    enum: ['bank', 'card'],
  })
  @IsIn(['bank', 'card'])
  institutionType!: 'bank' | 'card';

  @ApiProperty({
    description: '금융기관 로그인 ID',
    example: 'testuser',
  })
  @IsString()
  @MaxLength(100)
  loginId!: string;

  @ApiProperty({
    description: '금융기관 로그인 비밀번호',
    example: 'testpass',
  })
  @IsString()
  @MaxLength(200)
  loginPassword!: string;
}
