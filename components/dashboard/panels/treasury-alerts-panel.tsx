import { createServiceRoleClient } from "@/lib/supabase/server";
import { OPEN_TASK_STATUSES, severityForPriority } from "@/lib/panels";
import ItemCard from "../item-card";
import ItemActions from "../item-actions";
import EmptyState from "../empty-state";
import PanelShell from "../panel-shell";

export default async function TreasuryAlertsPanel() {
  const db = createServiceRoleClient();
  const { data: tasks } = await db
    .from("tasks")
    .select(
      "id, title, category, priority, status, deadline, amount_usd, assigned_to, source",
    )
    .eq("category", "treasury")
    .in("status", OPEN_TASK_STATUSES as unknown as string[])
    .order("deadline", { ascending: true, nullsFirst: false })
    .limit(6);

  const rows = tasks ?? [];

  return (
    <PanelShell title="Treasury alerts" counter={rows.length ? `${rows.length} open` : null}>
      {rows.length === 0 ? (
        <EmptyState
          title="Cash position looks clean"
          hint="Treasury exceptions and covenant flags surface here."
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
