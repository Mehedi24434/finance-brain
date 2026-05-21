import { createServiceRoleClient } from "@/lib/supabase/server";
import { severityForPriority, daysUntil } from "@/lib/panels";
import ItemCard from "../item-card";
import ItemActions from "../item-actions";
import EmptyState from "../empty-state";
import PanelShell from "../panel-shell";

export default async function ProcurementFollowupsPanel() {
  const db = createServiceRoleClient();
  const { data: followups } = await db
    .from("followups")
    .select(
      "id, subject, contact_name, contact_email, category, priority, status, due_date, last_contacted, next_action_at",
    )
    .in("status", ["open", "awaiting_response"])
    .in("category", ["procurement", "vendor"])
    .order("last_contacted", { ascending: true, nullsFirst: true })
    .limit(8);

  const rows = followups ?? [];
  const aging = rows.filter((f) => {
    const days = daysUntil(f.last_contacted);
    return days !== null && days < -3;
  }).length;

  const counter =
    rows.length === 0
      ? null
      : aging > 0
        ? `${rows.length} open · ${aging} aging`
        : `${rows.length} open`;

  return (
    <PanelShell title="Procurement followups" counter={counter}>
      {rows.length === 0 ? (
        <EmptyState
          title="No open followups"
          hint="Vendor and procurement threads waiting on a response land here."
        />
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((f) => {
            const secondary = [f.contact_name, f.subject].filter(Boolean).join(" · ");
            return (
              <li key={f.id}>
                <ItemCard
                  severity={severityForPriority(f.priority)}
                  title={f.subject}
                  category={f.category}
                  deadline={f.due_date}
                  secondary={secondary || null}
                  tag={
                    f.status === "awaiting_response"
                      ? { label: "awaiting", tone: "warning" }
                      : null
                  }
                >
                  <ItemActions id={f.id} variant="followup" />
                </ItemCard>
              </li>
            );
          })}
        </ul>
      )}
    </PanelShell>
  );
}
