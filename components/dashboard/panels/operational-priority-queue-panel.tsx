import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  OPEN_TASK_STATUSES,
  operationalScore,
  severityForPriority,
  type Severity,
} from "@/lib/panels";
import ItemCard from "../item-card";
import ItemActions from "../item-actions";
import EmptyState from "../empty-state";
import PanelShell from "../panel-shell";

type QueueRow = {
  kind: "task" | "inbox";
  id: string;
  title: string;
  category: string | null;
  priority: string | null;
  status: string | null;
  source: string | null;
  amount: number | null;
  deadline: string | null;
  secondary: string | null;
  score: number;
};

function severityForInboxClassification(c: string | null): Severity {
  switch (c) {
    case "urgent":
      return "urgent";
    case "approval":
      return "warning";
    case "request":
      return "info";
    default:
      return "muted";
  }
}

export default async function OperationalPriorityQueuePanel() {
  const db = createServiceRoleClient();

  const [tasksRes, inboxRes] = await Promise.all([
    db
      .from("tasks")
      .select(
        "id, title, category, priority, status, deadline, amount_usd, assigned_to, source, created_at",
      )
      .in("status", OPEN_TASK_STATUSES as unknown as string[]),
    db
      .from("inbox_items")
      .select(
        "id, sender, subject, source, category, classification, urgency_score, received_at, status, preview",
      )
      .in("status", ["unread", "read"])
      .not("classification", "is", null),
  ]);

  const tasks = (tasksRes.data ?? []).map<QueueRow>((t) => ({
    kind: "task",
    id: t.id,
    title: t.title,
    category: t.category,
    priority: t.priority,
    status: t.status,
    source: t.source,
    amount: t.amount_usd,
    deadline: t.deadline,
    secondary: t.assigned_to ?? null,
    score: operationalScore({
      priority: t.priority,
      createdAt: t.created_at,
      status: t.status,
    }),
  }));

  const inbox = (inboxRes.data ?? []).map<QueueRow>((i) => ({
    kind: "inbox",
    id: i.id,
    title: i.subject ?? "(no subject)",
    category: i.category,
    priority: i.classification === "urgent" ? "urgent" : null,
    status: i.status,
    source: i.source,
    amount: null,
    deadline: null,
    secondary: i.sender ?? i.preview?.slice(0, 80) ?? null,
    score: operationalScore({
      priority: i.classification === "urgent" ? "urgent" : "medium",
      createdAt: i.received_at,
      status: i.status,
      urgencyScore: i.urgency_score,
    }),
  }));

  const queue = [...tasks, ...inbox]
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  return (
    <PanelShell
      title="Operational priority queue"
      counter={queue.length ? `top ${queue.length}` : null}
    >
      {queue.length === 0 ? (
        <EmptyState title="Queue is clear" hint="The ranked feed of tasks + flagged inbox items." />
      ) : (
        <ul className="divide-y divide-border">
          {queue.map((r, idx) => {
            const severity: Severity =
              r.kind === "task"
                ? severityForPriority(r.priority)
                : severityForInboxClassification(
                    r.priority === "urgent" ? "urgent" : "approval",
                  );
            return (
              <li key={`${r.kind}-${r.id}`}>
                <ItemCard
                  rank={idx + 1}
                  severity={severity}
                  title={r.title}
                  href={r.kind === "task" ? `/tasks/${r.id}` : "/inbox"}
                  category={r.category}
                  amount={r.amount}
                  deadline={r.deadline}
                  source={r.source as never}
                  secondary={r.secondary}
                  tag={{
                    label: String(Math.round(r.score)),
                    tone: r.score >= 100 ? "urgent" : "warning",
                  }}
                >
                  {r.kind === "task" && (
                    <ItemActions id={r.id} variant="task" showOpen={false} />
                  )}
                </ItemCard>
              </li>
            );
          })}
        </ul>
      )}
    </PanelShell>
  );
}
