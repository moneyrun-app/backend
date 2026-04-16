import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { KakaoLoginDto } from './dto/kakao-login.dto';
import { OnboardingDto } from './dto/onboarding.dto';
import { PreOnboardingDto } from './dto/pre-onboarding.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** 로그인 전 온보딩 미리보기 (JWT 불필요) */
  @Post('pre-onboarding')
  async preOnboarding(@Body() dto: PreOnboardingDto) {
    return this.authService.calculatePreOnboardingPreview(dto);
  }

  /** 카카오 로그인 (+ pre-onboarding 데이터 연동) */
  @Post('kakao')
  async kakaoLogin(@Body() dto: KakaoLoginDto) {
    return this.authService.kakaoLoginWithPreOnboarding(
      dto.accessToken,
      dto.preOnboardingData,
    );
  }

  /** v2 레거시 온보딩 */
  @Post('onboarding')
  @UseGuards(JwtAuthGuard)
  async onboarding(
    @CurrentUser('id') userId: string,
    @Body() dto: OnboardingDto,
  ) {
    return this.authService.completeOnboarding(userId, dto);
  }
}
