export type MissionStatus =
  | "draft"
  | "pending_director"
  | "pending_central_director"
  | "pending_technical_control"
  | "pending_dga"
  | "pending_dmg"
  | "en_vigueur"
  | "pending_cad_payment"
  | "pending_financial_control"
  | "approved"
  | "rejected";

export type UserRole =
  | "admin"
  | "employee"
  | "director"
  | "central_director"
  | "technical_control"
  | "dga"
  | "dmg"
  | "cad_edition"
  | "cad_payment"
  | "financial_control";

const WORKFLOW_NEXT: Record<string, MissionStatus> = {
  pending_director: "pending_central_director",
  pending_central_director: "pending_technical_control",
  pending_technical_control: "pending_dga",
  pending_dga: "pending_dmg",
  pending_dmg: "en_vigueur",
  en_vigueur: "pending_cad_payment",
  pending_cad_payment: "pending_financial_control",
  pending_financial_control: "approved",
};

const STATUS_TO_ROLE: Record<string, UserRole> = {
  pending_director: "director",
  pending_central_director: "central_director",
  pending_technical_control: "technical_control",
  pending_dga: "dga",
  pending_dmg: "dmg",
  en_vigueur: "cad_edition",
  pending_cad_payment: "cad_payment",
  pending_financial_control: "financial_control",
};

export function getNextStatus(current: MissionStatus): MissionStatus {
  return WORKFLOW_NEXT[current] ?? "approved";
}

export function getRequiredRoleForStatus(status: MissionStatus): UserRole | null {
  return STATUS_TO_ROLE[status] ?? null;
}

export function canUserValidate(userRole: UserRole, missionStatus: MissionStatus): boolean {
  if (userRole === "admin") return true;
  const required = getRequiredRoleForStatus(missionStatus);
  return required === userRole;
}

export function getInitialStatus(creatorRole: UserRole): MissionStatus {
  if (creatorRole === "central_director") {
    return "pending_technical_control";
  }
  if (creatorRole === "director") {
    return "pending_central_director";
  }
  return "pending_director";
}
