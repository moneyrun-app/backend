import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { SupabaseService } from '../common/supabase/supabase.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly supabase: SupabaseService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: { sub: string }) {
    const { data: user } = await this.supabase.db
      .from('users')
      .select('id, nickname, email, has_completed_onboarding')
      .eq('id', payload.sub)
      .single();

    if (!user) {
      throw new UnauthorizedException('유저를 찾을 수 없습니다.');
    }

    return user;
  }
}
