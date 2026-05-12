export const MISSION_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  pending_director: "En attente Directeur",
  pending_central_director: "En attente Dir. Central",
  pending_technical_control: "En attente Contrôle Technique",
  pending_dga: "En attente DGA",
  pending_dmg: "En attente DMG",
  en_vigueur: "En Vigueur",
  pending_cad_payment: "En attente CAD Paiement",
  pending_financial_control: "En attente Contrôle Financier",
  approved: "Validée",
  rejected: "Rejetée",
};

export const MISSION_STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  pending_director: "default",
  pending_central_director: "default",
  pending_technical_control: "default",
  pending_dga: "default",
  pending_dmg: "default",
  en_vigueur: "outline",
  pending_cad_payment: "default",
  pending_financial_control: "default",
  approved: "outline",
  rejected: "destructive",
};

export const EMPLOYEE_CATEGORY_LABELS: Record<string, string> = {
  dg_dga: "DG/DGA",
  director: "Directeur",
  chef_department: "Chef de Dépt/Service",
  other_cadre: "Autre Cadre",
  agent: "Agent",
};

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrateur",
  employee: "Utilisateur Simple",
  director: "Directeur",
  central_director: "Directeur Central",
  technical_control: "Contrôle Technique",
  dga: "DGA",
  dmg: "DMG",
  cad_edition: "CAD - Édition",
  cad_payment: "CAD - Paiement",
  financial_control: "Contrôle Financier",
};
