-- 또래 비교 통계 시드 데이터
-- 나이대(20~60대) × 소득대(4구간) = 20개 항목
-- 출처: 통계청 가계동향조사 기반 참고 데이터 (어드민에서 수정 가능)

INSERT INTO system_config (key, value, updated_at)
VALUES ('peer_statistics', '[
  {"ageMin":20,"ageMax":29,"ageLabel":"20대","incomeMin":0,"incomeMax":2000000,"incomeLabel":"~200만원","avgMonthlyIncome":1600000,"avgMonthlyExpense":1300000,"avgFixedCost":700000,"avgVariableCost":600000,"avgSavingsRate":18.8,"avgSurplus":300000},
  {"ageMin":20,"ageMax":29,"ageLabel":"20대","incomeMin":2000000,"incomeMax":4000000,"incomeLabel":"200~400만원","avgMonthlyIncome":2800000,"avgMonthlyExpense":2000000,"avgFixedCost":1100000,"avgVariableCost":900000,"avgSavingsRate":28.6,"avgSurplus":800000},
  {"ageMin":20,"ageMax":29,"ageLabel":"20대","incomeMin":4000000,"incomeMax":6000000,"incomeLabel":"400~600만원","avgMonthlyIncome":4800000,"avgMonthlyExpense":3100000,"avgFixedCost":1700000,"avgVariableCost":1400000,"avgSavingsRate":35.4,"avgSurplus":1700000},
  {"ageMin":20,"ageMax":29,"ageLabel":"20대","incomeMin":6000000,"incomeMax":99999999,"incomeLabel":"600만원~","avgMonthlyIncome":7200000,"avgMonthlyExpense":4200000,"avgFixedCost":2200000,"avgVariableCost":2000000,"avgSavingsRate":41.7,"avgSurplus":3000000},

  {"ageMin":30,"ageMax":39,"ageLabel":"30대","incomeMin":0,"incomeMax":2000000,"incomeLabel":"~200만원","avgMonthlyIncome":1700000,"avgMonthlyExpense":1450000,"avgFixedCost":850000,"avgVariableCost":600000,"avgSavingsRate":14.7,"avgSurplus":250000},
  {"ageMin":30,"ageMax":39,"ageLabel":"30대","incomeMin":2000000,"incomeMax":4000000,"incomeLabel":"200~400만원","avgMonthlyIncome":3200000,"avgMonthlyExpense":2100000,"avgFixedCost":1300000,"avgVariableCost":800000,"avgSavingsRate":34.4,"avgSurplus":1100000},
  {"ageMin":30,"ageMax":39,"ageLabel":"30대","incomeMin":4000000,"incomeMax":6000000,"incomeLabel":"400~600만원","avgMonthlyIncome":5100000,"avgMonthlyExpense":3400000,"avgFixedCost":1900000,"avgVariableCost":1500000,"avgSavingsRate":33.3,"avgSurplus":1700000},
  {"ageMin":30,"ageMax":39,"ageLabel":"30대","incomeMin":6000000,"incomeMax":99999999,"incomeLabel":"600만원~","avgMonthlyIncome":7800000,"avgMonthlyExpense":4800000,"avgFixedCost":2600000,"avgVariableCost":2200000,"avgSavingsRate":38.5,"avgSurplus":3000000},

  {"ageMin":40,"ageMax":49,"ageLabel":"40대","incomeMin":0,"incomeMax":2000000,"incomeLabel":"~200만원","avgMonthlyIncome":1750000,"avgMonthlyExpense":1550000,"avgFixedCost":950000,"avgVariableCost":600000,"avgSavingsRate":11.4,"avgSurplus":200000},
  {"ageMin":40,"ageMax":49,"ageLabel":"40대","incomeMin":2000000,"incomeMax":4000000,"incomeLabel":"200~400만원","avgMonthlyIncome":3400000,"avgMonthlyExpense":2500000,"avgFixedCost":1500000,"avgVariableCost":1000000,"avgSavingsRate":26.5,"avgSurplus":900000},
  {"ageMin":40,"ageMax":49,"ageLabel":"40대","incomeMin":4000000,"incomeMax":6000000,"incomeLabel":"400~600만원","avgMonthlyIncome":5300000,"avgMonthlyExpense":3800000,"avgFixedCost":2100000,"avgVariableCost":1700000,"avgSavingsRate":28.3,"avgSurplus":1500000},
  {"ageMin":40,"ageMax":49,"ageLabel":"40대","incomeMin":6000000,"incomeMax":99999999,"incomeLabel":"600만원~","avgMonthlyIncome":8200000,"avgMonthlyExpense":5500000,"avgFixedCost":3000000,"avgVariableCost":2500000,"avgSavingsRate":32.9,"avgSurplus":2700000},

  {"ageMin":50,"ageMax":59,"ageLabel":"50대","incomeMin":0,"incomeMax":2000000,"incomeLabel":"~200만원","avgMonthlyIncome":1650000,"avgMonthlyExpense":1500000,"avgFixedCost":900000,"avgVariableCost":600000,"avgSavingsRate":9.1,"avgSurplus":150000},
  {"ageMin":50,"ageMax":59,"ageLabel":"50대","incomeMin":2000000,"incomeMax":4000000,"incomeLabel":"200~400만원","avgMonthlyIncome":3300000,"avgMonthlyExpense":2600000,"avgFixedCost":1600000,"avgVariableCost":1000000,"avgSavingsRate":21.2,"avgSurplus":700000},
  {"ageMin":50,"ageMax":59,"ageLabel":"50대","incomeMin":4000000,"incomeMax":6000000,"incomeLabel":"400~600만원","avgMonthlyIncome":5200000,"avgMonthlyExpense":3900000,"avgFixedCost":2200000,"avgVariableCost":1700000,"avgSavingsRate":25.0,"avgSurplus":1300000},
  {"ageMin":50,"ageMax":59,"ageLabel":"50대","incomeMin":6000000,"incomeMax":99999999,"incomeLabel":"600만원~","avgMonthlyIncome":8000000,"avgMonthlyExpense":5600000,"avgFixedCost":3100000,"avgVariableCost":2500000,"avgSavingsRate":30.0,"avgSurplus":2400000},

  {"ageMin":60,"ageMax":69,"ageLabel":"60대","incomeMin":0,"incomeMax":2000000,"incomeLabel":"~200만원","avgMonthlyIncome":1500000,"avgMonthlyExpense":1400000,"avgFixedCost":850000,"avgVariableCost":550000,"avgSavingsRate":6.7,"avgSurplus":100000},
  {"ageMin":60,"ageMax":69,"ageLabel":"60대","incomeMin":2000000,"incomeMax":4000000,"incomeLabel":"200~400만원","avgMonthlyIncome":3000000,"avgMonthlyExpense":2400000,"avgFixedCost":1500000,"avgVariableCost":900000,"avgSavingsRate":20.0,"avgSurplus":600000},
  {"ageMin":60,"ageMax":69,"ageLabel":"60대","incomeMin":4000000,"incomeMax":6000000,"incomeLabel":"400~600만원","avgMonthlyIncome":4900000,"avgMonthlyExpense":3700000,"avgFixedCost":2100000,"avgVariableCost":1600000,"avgSavingsRate":24.5,"avgSurplus":1200000},
  {"ageMin":60,"ageMax":69,"ageLabel":"60대","incomeMin":6000000,"incomeMax":99999999,"incomeLabel":"600만원~","avgMonthlyIncome":7500000,"avgMonthlyExpense":5200000,"avgFixedCost":2900000,"avgVariableCost":2300000,"avgSavingsRate":30.7,"avgSurplus":2300000}
]', NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
