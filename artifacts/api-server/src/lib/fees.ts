export type EmployeeCategory = "dg_dga" | "director" | "chef_department" | "other_cadre" | "agent";

const RATES: Record<EmployeeCategory, { tier1: number; tier2: number; tier3: number }> = {
  dg_dga:          { tier1: 2500, tier2: 2500, tier3: 2500 },
  director:        { tier1: 3000, tier2: 1500, tier3: 900  },
  chef_department: { tier1: 2000, tier2: 1000, tier3: 600  },
  other_cadre:     { tier1: 1500, tier2: 750,  tier3: 450  },
  agent:           { tier1: 1000, tier2: 500,  tier3: 300  },
};

export function getDailyRate(category: EmployeeCategory, durationDays: number): number {
  const rates = RATES[category] ?? RATES.agent;
  if (durationDays <= 5) return rates.tier1;
  if (durationDays <= 10) return rates.tier2;
  return rates.tier3;
}

export function calculateFees(category: EmployeeCategory, durationDays: number) {
  const dailyRate = getDailyRate(category, durationDays);
  const totalFee = dailyRate * durationDays;
  const paidAmount = Math.round(totalFee * 0.70 * 100) / 100;
  const remainingAmount = Math.round((totalFee - paidAmount) * 100) / 100;
  return { dailyRate, totalFee, paidAmount, remainingAmount };
}

export function calcDurationDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, days);
}
