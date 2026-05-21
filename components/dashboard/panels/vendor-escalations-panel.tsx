import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  OPEN_TASK_STATUSES,
  OPEN_CONCERN_STATUSES,
  severityForPriority,
  type Severity,
} from "@/lib/panels";
import ItemCard from "../item-card";
import ItemActions from "../item-actions";
import EmptyState from "../empty-state";
import PanelShell from "../panel-shell";

type Row =
  | {
      kind: "task";
      id: string;
      title: string;
      category: string | null;
      priority: string | null;
      deadline: string | null;
      amount: number | null;
      assigned_to: string | null;
      source: string | null;
    }
  | {
      kind: "concern";
      id: string;
      title: string;
      status: string;
      financial_impact_usd: number | null;
      stakeholders: string[] | null;
      next_review: string | null;
    };

export default async function VendorEscalationsPanel() {
  const db = createServiceRoleClient();

  const [tasksRes, concernsRes] = await Promise.all([
    db
      .from("tasks")
      .select(
        "id, title, category, priority, deadline, amount_usd, assigned_to, source",
      )
      .eq("category", "vendor")
      .in("status", OPEN_TASK_STATUSES as unknown as string[])
      .order("deadline", { ascending: true, nullsFirst: false })
      .limit(6),
    db
      .from("ongoing_concerns")
      .select(
        "id, title, status, financial_impact_usd, stakeholders, next_review, category",
      )
      .in("category", ["vendor", "procurement"])
      .in("status", OPEN_CONCERN_STATUSES as unknown as string[])
      .order("next_review", { ascending: true, nullsFirst: false })
      .limit(6),
  ]);

  const rows: Row[] = [
    ...(tasksRes.data ?? []).map((t) => ({
      kind: "task" as const,
      id: t.id,
      title: t.title,
      category: t.category,
      priority: t.priority,
      deadline: t.deadline,
      amount: t.amount_usd,
      assigned_to: t.assigned_to,
      source: t.source,
    })),
    ...(concernsRes.data ?? []).map((c) => ({
      kind: "concern" as const,
      id: c.id,
      title: c.title,
      status: c.status,
      financial_impact_usd: c.financial_impact_usd,
      stakeholders: c.stakeholders,
      next_review: c.next_review,
    })),
  ];

  return (
    <PanelShell
      title="Vendor escalations"
      counter={rows.length ? `${rows.length} active` : null}
    >
      {rows.length === 0 ? (
        <EmptyState title="No vendor escalations" hint="Vendor risks and concerns show here." />
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) =>
            r.kind === "task" ? (
              <li key={`t-${r.id}`}>
                <ItemCard
                  severity={severityForPriority(r.priority)}
                  title={r.title}
                  href={`/tasks/${r.id}`}
                  category={r.category}
                  amount={r.amount}
                  deadline={r.deadline}
                  source={r.source as never}
                  secondary={r.assigned_to ?? null}
                >
                  <ItemActions id={r.id} variant="task" />
                </ItemCard>
              </li>
            ) : (
              <li key={`c-${r.id}`}>
                <ItemCard
                  severity={
                    (r.status === "escalated" ? "urgent" : "warning") as Severity
                  }
                  title={r.title}
                  amount={r.financial_impact_usd}
                  deadline={r.next_review}
                  secondary={r.stakeholders?.slice(0, 3).join(", ") ?? null}
                  tag={{ label: "ongoing", tone: "warning" }}
                />
              </li>
            ),
          )}
        </ul>
      )}
    </PanelShell>
  );
}
