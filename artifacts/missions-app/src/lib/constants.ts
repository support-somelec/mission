export const MISSION_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  pending_director: "En attente Directeur",
  pending_central_director: "En attente Dir. Central",
  pending_technical_control: "En attente Contrôle Technique",
  pending_dga: "En attente DGA",
  pending_dmg: "En attente DMG",
  pending_cad: "En attente CAD",
  pending_financial_control: "En attente Contrôle Financier",
  pending_drh: "En attente DRH",
  approved: "Approuvée",
  rejected: "Rejetée",
};

export const MISSION_STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  pending_director: "default",
  pending_central_director: "default",
  pending_technical_control: "default",
  pending_dga: "default",
  pending_dmg: "default",
  pending_cad: "default",
  pending_financial_control: "default",
  pending_drh: "default",
  approved: "outline", // Using outline or a custom success variant
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
  employee: "Employé",
  director: "Directeur",
  central_director: "Directeur Central",
  technical_control: "Contrôle Technique",
  dga: "DGA",
  dmg: "DMG",
  cad: "CAD",
  financial_control: "Contrôle Financier",
  drh: "DRH",
};
