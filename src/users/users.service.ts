import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly supabase: SupabaseService) {}

  async findById(userId: string) {
    const { data, error } = await this.supabase.db
      .from('users')
      .select('id, nickname, email, marketing_consent, has_completed_onboarding, role, created_at')
      .eq('id', userId)
      .single();

    if (error || !data) {
      throw new NotFoundException('유저를 찾을 수 없습니다.');
    }

    return {
      id: data.id,
      nickname: data.nickname,
      email: data.email,
      marketingConsent: data.marketing_consent,
      hasCompletedOnboarding: data.has_completed_onboarding,
      role: data.role,
      createdAt: data.created_at,
    };
  }

  async update(userId: string, dto: UpdateUserDto) {
    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    if (dto.nickname !== undefined) updateData.nickname = dto.nickname;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.marketingConsent !== undefined) updateData.marketing_consent = dto.marketingConsent;

    const { error } = await this.supabase.db
      .from('users')
      .update(updateData)
      .eq('id', userId);

    if (error) {
      throw new Error(`유저 업데이트 실패: ${error.message}`);
    }

    return this.findById(userId);
  }

  async delete(userId: string) {
    const { error } = await this.supabase.db
      .from('users')
      .delete()
      .eq('id', userId);

    if (error) {
      throw new Error(`유저 삭제 실패: ${error.message}`);
    }
  }
}
