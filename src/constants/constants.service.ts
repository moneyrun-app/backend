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
}
