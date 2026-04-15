import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';

@Injectable()
export class UsersService {
  constructor(private readonly supabase: SupabaseService) {}

  async findById(userId: string) {
    const { data, error } = await this.supabase.db
      .from('users')
      .select('id, nickname, email, marketing_consent, has_completed_onboarding, role, onboarding_version, created_at')
      .eq('id', userId)
      .single();

    if (error || !data) {
      throw new NotFoundException('유저를 찾을 수 없습니다.');
    }

    // 활성 코스 조회
    const { data: activeCourse } = await this.supabase.db
      .from('user_courses')
      .select('course_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    return {
      id: data.id,
      nickname: data.nickname,
      email: data.email,
      marketingConsent: data.marketing_consent,
      hasCompletedOnboarding: data.has_completed_onboarding,
      role: data.role,
      onboardingVersion: data.onboarding_version || 2,
      activeCourseId: activeCourse?.course_id || null,
      createdAt: data.created_at,
    };
  }
}
