import { IsString, IsNotEmpty, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PreOnboardingDto } from './pre-onboarding.dto';

export class KakaoLoginDto {
  @IsString()
  @IsNotEmpty()
  accessToken: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PreOnboardingDto)
  preOnboardingData?: PreOnboardingDto;
}
