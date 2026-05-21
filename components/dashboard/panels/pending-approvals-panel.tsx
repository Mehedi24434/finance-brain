import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  OPEN_TASK_STATUSES,
  formatUsd,
  severityForPriority,
} from "@/lib/panels";
import ItemCard from "../item-card";
import ItemActions from "../item-actions";
import EmptyState from "../empty-state";
import PanelShell from "../panel-shell";

export default async function PendingApprovalsPanel() {
  const db = createServiceRoleClient();
  const { data: tasks } = await db
    .from("tasks")
    .select(
      "id, title, category, priority, status, deadline, amount_usd, assigned_to, source",
    )
    .in("status", OPEN_TASK_STATUSES as unknown as string[])
    .in("category", ["procurement", "capex"])
    .not("amount_usd", "is", null)
    .order("deadline", { ascending: true, nullsFirst: false })
    .limit(8);

  const rows = tasks ?? [];
  const total = rows.reduce((sum, t) => sum + (Number(t.amount_usd) || 0), 0);
  const counter =
    rows.length === 0
      ? null
      : total > 0
        ? `${formatUsd(total)} across ${rows.length}`
        : `${rows.length} pending`;

  return (
    <PanelShell title="Pending approvals" counter={counter}>
      {rows.length === 0 ? (
        <EmptyState
          title="No approvals waiting"
          hint="Procurement and capex requests over your threshold show up here."
        />
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((t) => (
            <li key={t.id}>
              <ItemCard
                severity={severityForPriority(t.priority)}
                title={t.title}
                href={`/tasks/${t.id}`}
                category={t.category}
                amount={t.amount_usd}
                deadline={t.deadline}
                source={t.source as never}
                secondary={t.assigned_to ?? null}
              >
                <ItemActions id={t.id} variant="task" />
              </ItemCard>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}
