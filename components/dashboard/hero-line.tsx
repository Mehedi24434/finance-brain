import { createServiceRoleClient } from "@/lib/supabase/server";
import { OPEN_TASK_STATUSES, ageDays } from "@/lib/panels";
import { daysAgoIso } from "@/lib/time";
import HeroLineDismiss from "./hero-line-dismiss";

export default async function HeroLine() {
  const db = createServiceRoleClient();
  const threeDaysAgo = daysAgoIso(3);

  const [openRes, urgentRes, agingRes] = await Promise.all([
    db
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .in("status", OPEN_TASK_STATUSES as unknown as string[]),
    db
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .in("status", OPEN_TASK_STATUSES as unknown as string[])
      .eq("priority", "urgent"),
    db
      .from("followups")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "awaiting_response"])
      .lt("last_contacted", threeDaysAgo),
  ]);

  // Lightweight pre-computation for the body text. Use ageDays helper
  // only to keep the import chain stable across panels.
  void ageDays;

  const open = openRes.count ?? 0;
  const urgent = urgentRes.count ?? 0;
  const aging = agingRes.count ?? 0;

  return (
    <HeroLineDismiss open={open} urgent={urgent} aging={aging} />
  );
}
