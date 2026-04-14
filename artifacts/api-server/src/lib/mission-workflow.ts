export type MissionStatus =
  | "draft"
  | "pending_director"
  | "pending_central_director"
  | "pending_technical_control"
  | "pending_dga"
  | "pending_dmg"
  | "pending_cad"
  | "pending_financial_control"
  | "pending_drh"
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
  | "cad"
  | "financial_control"
  | "drh";

const WORKFLOW_NEXT: Record<string, MissionStatus> = {
  pending_director: "pending_central_director",
  pending_central_director: "pending_technical_control",
  pending_technical_control: "pending_dga",
  pending_dga: "pending_dmg",
  pending_dmg: "pending_cad",
  pending_cad: "pending_financial_control",
  pending_financial_control: "pending_drh",
  pending_drh: "approved",
};

const STATUS_TO_ROLE: Record<string, UserRole> = {
  pending_director: "director",
  pending_central_director: "central_director",
  pending_technical_control: "technical_control",
  pending_dga: "dga",
  pending_dmg: "dmg",
  pending_cad: "cad",
  pending_financial_control: "financial_control",
  pending_drh: "drh",
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
  if (creatorRole === "director" || creatorRole === "central_director") {
    return "pending_central_director";
  }
  return "pending_director";
}
