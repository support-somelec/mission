import { sql } from "drizzle-orm";
import { missionsTable } from "@workspace/db";

export function missionNumberFilter(value?: string) {
  const query = value?.trim();
  if (!query) return undefined;
  const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
  return sql`(
    ${missionsTable.orderNumber} ILIKE ${pattern}
    OR CAST(${missionsTable.id} AS text) ILIKE ${pattern}
    OR ('#' || LPAD(CAST(${missionsTable.id} AS text),
      GREATEST(4, LENGTH(CAST(${missionsTable.id} AS text))), '0')) ILIKE ${pattern}
  )`;
}
