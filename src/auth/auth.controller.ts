import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { KakaoLoginDto } from './dto/kakao-login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('kakao')
  async kakaoLogin(@Body() dto: KakaoLoginDto) {
    return this.authService.kakaoLogin(dto.accessToken);
  }
}
