export type EmployeeCategory = "dg_dga" | "director" | "chef_department" | "other_cadre" | "agent";

/**
 * RÈGLE 1 — Missions ≤ 15 jours
 * tier1 : durée totale ≤ 5 jours
 * tier2 : durée totale 6–10 jours
 * tier3 : durée totale 11–15 jours
 */
const RATES: Record<EmployeeCategory, { tier1: number; tier2: number; tier3: number }> = {
  dg_dga:          { tier1: 2500, tier2: 2500, tier3: 2500 },
  director:        { tier1: 3000, tier2: 1500, tier3: 900  },
  chef_department: { tier1: 2000, tier2: 1000, tier3: 600  },
  other_cadre:     { tier1: 1500, tier2: 750,  tier3: 450  },
  agent:           { tier1: 1000, tier2: 500,  tier3: 300  },
};

/**
 * RÈGLE 2 — Missions > 15 jours (travaux, projets, intérim…)
 * Forfait hébergement + nourriture inclus.
 * Cadres (toutes catégories) : 850 MRU/jour
 * Agents                     : 500 MRU/jour
 */
const LONG_MISSION_RATES: Record<EmployeeCategory, number> = {
  dg_dga:          850,
  director:        850,
  chef_department: 850,
  other_cadre:     850,
  agent:           500,
};

export function getDailyRate(category: EmployeeCategory, durationDays: number): number {
  // Règle 2 : durée > 15 jours → forfait longue mission
  if (durationDays > 15) {
    return LONG_MISSION_RATES[category] ?? 500;
  }
  // Règle 1 : durée ≤ 15 jours → grille par tranche
  const rates = RATES[category] ?? RATES.agent;
  if (durationDays <= 5)  return rates.tier1;
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
  const end   = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, days);
}
