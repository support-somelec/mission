import { Badge } from "@/components/ui/badge";
import { MISSION_STATUS_LABELS, MISSION_STATUS_COLORS } from "@/lib/constants";

export function StatusBadge({ status }: { status: string }) {
  const label = MISSION_STATUS_LABELS[status] || status;
  const variant = MISSION_STATUS_COLORS[status] || "default";

  // Provide custom coloring for pending and approved
  let colorClass = "";
  if (status.startsWith("pending_")) {
    colorClass = "bg-amber-500 hover:bg-amber-600 text-white border-transparent";
  } else if (status === "approved") {
    colorClass = "bg-emerald-500 hover:bg-emerald-600 text-white border-transparent";
  }

  if (colorClass) {
    return <Badge variant="default" className={colorClass}>{label}</Badge>;
  }

  return <Badge variant={variant}>{label}</Badge>;
}
