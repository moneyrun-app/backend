import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';

@Injectable()
export class ConstantsService {
  constructor(private readonly supabase: SupabaseService) {}

  async getAll() {
    const { data } = await this.supabase.db
      .from('system_config')
      .select('key, value, updated_at');

    const configMap: Record<string, string> = {};
    let latestUpdate = '';

    for (const row of data || []) {
      configMap[row.key] = row.value;
      if (row.updated_at > latestUpdate) latestUpdate = row.updated_at;
    }

    return {
      exchangeRate: parseInt(configMap['exchange_rate'] || '0'),
      oilPrice: parseFloat(configMap['oil_price'] || '0'),
      inflationRate: parseFloat(configMap['inflation_rate'] || '0'),
      minPensionGoal: parseInt(configMap['min_pension_goal'] || '1300000'),
      seoulAverageRent: parseInt(configMap['seoul_avg_rent'] || '0'),
      categoryAverages: {
        food: parseInt(configMap['avg_food'] || '0'),
        transport: parseInt(configMap['avg_transport'] || '0'),
        subscription: parseInt(configMap['avg_subscription'] || '0'),
        shopping: parseInt(configMap['avg_shopping'] || '0'),
        leisure: parseInt(configMap['avg_leisure'] || '0'),
        etc: parseInt(configMap['avg_etc'] || '0'),
      },
      updatedAt: latestUpdate,
    };
  }

  async getConfigMap(): Promise<Record<string, string>> {
    const { data } = await this.supabase.db
      .from('system_config')
      .select('key, value');

    const map: Record<string, string> = {};
    for (const row of data || []) {
      map[row.key] = row.value;
    }
    return map;
  }

  /** JSON 값을 파싱해서 반환. 나이대별/국가별 데이터 조회용 */
  getJsonConfig(configMap: Record<string, string>, key: string): any {
    const raw = configMap[key];
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  /** 나이대별 또래 데이터를 한번에 가져오기 */
  getPeerData(configMap: Record<string, string>, age: number) {
    const ageGroup = age < 30 ? '20s' : age < 40 ? '30s' : age < 50 ? '40s' : '50s';
    const ageGroupLabel = age < 30 ? '20대' : age < 40 ? '30대' : age < 50 ? '40대' : '50대';

    const get = (key: string) => {
      const data = this.getJsonConfig(configMap, key);
      return data?.[ageGroup] ?? 0;
    };

    return {
      ageGroup,
      ageGroupLabel,
      avgIncome: get('peer_avg_income'),
      avgSavingsRate: get('peer_avg_savings_rate'),
      avgExpenseRatio: get('peer_avg_expense_ratio'),
      avgFixedRatio: get('peer_avg_fixed_ratio'),
      avgVariableRatio: get('peer_avg_variable_ratio'),
      avgSurplusRatio: get('peer_avg_surplus_ratio'),
    };
  }
}
