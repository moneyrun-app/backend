import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';

@Injectable()
export class PaymentService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * 결제 토큰 검증 (PG 연동 후 구현)
   * TODO: 토스페이먼츠 등 PG 연동
   */
  async verifyPayment(paymentToken: string): Promise<boolean> {
    // MVP: 스텁 — 항상 true 반환
    return true;
  }

  /**
   * 결제 이력 저장
   */
  async recordPayment(
    userId: string,
    reportId: string,
    amount: number,
    paymentToken: string,
  ) {
    const { error } = await this.supabase.db
      .from('report_payments')
      .insert({
        user_id: userId,
        report_id: reportId,
        amount,
        status: 'completed',
        payment_token: paymentToken,
      });

    if (error) {
      throw new Error(`결제 이력 저장 실패: ${error.message}`);
    }
  }

  /**
   * 유저 결제 이력 조회
   */
  async getPaymentHistory(userId: string) {
    const { data } = await this.supabase.db
      .from('report_payments')
      .select('id, report_id, amount, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    return data || [];
  }
}
