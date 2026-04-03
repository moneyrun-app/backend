import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { KakaoLoginDto } from './dto/kakao-login.dto';
import { OnboardingDto } from './dto/onboarding.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('kakao')
  async kakaoLogin(@Body() dto: KakaoLoginDto) {
    return this.authService.kakaoLogin(dto.accessToken);
  }

  @Post('onboarding')
  @UseGuards(JwtAuthGuard)
  async onboarding(
    @CurrentUser('id') userId: string,
    @Body() dto: OnboardingDto,
  ) {
    return this.authService.completeOnboarding(userId, dto);
  }
}
