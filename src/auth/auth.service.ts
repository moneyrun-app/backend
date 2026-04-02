import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SupabaseService } from '../common/supabase/supabase.service';

interface KakaoUserInfo {
  id: number;
  kakao_account?: {
    email?: string;
    profile?: {
      nickname?: string;
    };
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly jwtService: JwtService,
  ) {}

  async kakaoLogin(accessToken: string) {
    // 1. 카카오 API로 유저 정보 확인
    const kakaoUser = await this.getKakaoUserInfo(accessToken);

    // 2. DB에서 유저 조회 또는 생성
    const { user, isNewUser } = await this.findOrCreateUser(kakaoUser);

    // 3. JWT 발급
    const jwt = this.jwtService.sign({ sub: user.id, kakaoId: user.kakao_id });

    return {
      accessToken: jwt,
      user: {
        id: user.id,
        nickname: user.nickname,
        email: user.email,
        isNewUser,
        hasCompletedOnboarding: user.has_completed_onboarding,
      },
    };
  }

  private async getKakaoUserInfo(accessToken: string): Promise<KakaoUserInfo> {
    const response = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new UnauthorizedException('카카오 인증에 실패했습니다.');
    }

    return response.json();
  }

  private async findOrCreateUser(kakaoUser: KakaoUserInfo) {
    const kakaoId = kakaoUser.id;
    const nickname =
      kakaoUser.kakao_account?.profile?.nickname || `user_${kakaoId}`;
    const email = kakaoUser.kakao_account?.email || null;

    // 기존 유저 조회
    const { data: existingUser } = await this.supabase.db
      .from('users')
      .select('*')
      .eq('kakao_id', kakaoId)
      .single();

    if (existingUser) {
      return { user: existingUser, isNewUser: false };
    }

    // 신규 유저 생성
    const { data: newUser, error } = await this.supabase.db
      .from('users')
      .insert({ kakao_id: kakaoId, nickname, email })
      .select()
      .single();

    if (error) {
      throw new Error(`유저 생성 실패: ${error.message}`);
    }

    return { user: newUser, isNewUser: true };
  }
}
