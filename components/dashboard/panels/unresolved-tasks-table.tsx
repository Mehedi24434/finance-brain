import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  OPEN_TASK_STATUSES,
  formatUsd,
  severityForPriority,
  type Severity,
  dueLabel,
} from "@/lib/panels";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import ItemActions from "../item-actions";
import EmptyState from "../empty-state";
import PanelShell from "../panel-shell";

const STRIPE_BG: Record<Severity, string> = {
  urgent: "bg-urgent",
  warning: "bg-warning",
  ok: "bg-ok",
  info: "bg-info",
  muted: "bg-text-tertiary/40",
};

const STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  waiting: "Waiting",
  blocked: "Blocked",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_TONE: Record<string, string> = {
  not_started: "text-text-secondary",
  in_progress: "text-info",
  waiting: "text-warning",
  blocked: "text-urgent",
  completed: "text-ok",
  cancelled: "text-text-tertiary",
};

export default async function UnresolvedTasksTable({
  title = "Unresolved tasks",
  filter,
  pageSize = 25,
}: {
  title?: string;
  filter?: {
    status?: string | "all";
    category?: string;
    priority?: string;
  };
  pageSize?: number;
}) {
  const db = createServiceRoleClient();
  let query = db
    .from("tasks")
    .select(
      "id, title, category, priority, status, deadline, amount_usd, assigned_to, source, updated_at",
      { count: "exact" },
    )
    .order("priority", { ascending: false })
    .order("deadline", { ascending: true, nullsFirst: false })
    .limit(pageSize);

  if (!filter?.status || filter.status === "open") {
    query = query.in("status", OPEN_TASK_STATUSES as unknown as string[]);
  } else if (filter.status === "all") {
    // no filter
  } else if (filter.status) {
    query = query.eq("status", filter.status);
  } else {
    query = query.not("status", "in", "(completed,cancelled)");
  }
  if (filter?.category) query = query.eq("category", filter.category);
  if (filter?.priority) query = query.eq("priority", filter.priority);

  const { data, count } = await query;
  const rows = data ?? [];

  return (
    <PanelShell
      title={title}
      counter={
        count !== null && count !== undefined
          ? `${count} total · showing ${rows.length}`
          : null
      }
      bodyClassName="overflow-x-auto"
    >
      {rows.length === 0 ? (
        <EmptyState title="Nothing matches your filters" />
      ) : (
        <table className="w-full text-[12px]">
          <thead className="bg-raised/40">
            <tr className="text-left text-text-tertiary uppercase tracking-wider text-[10px]">
              <th className="py-2 pl-4 pr-2 font-medium">Task</th>
              <th className="py-2 px-2 font-medium">Category</th>
              <th className="py-2 px-2 font-medium">Priority</th>
              <th className="py-2 px-2 font-medium">Status</th>
              <th className="py-2 px-2 font-medium font-mono">Amount</th>
              <th className="py-2 px-2 font-medium">Due</th>
              <th className="py-2 px-2 font-medium">Owner</th>
              <th className="py-2 px-2 font-medium w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((t) => {
              const sev: Severity = severityForPriority(t.priority);
              const due = dueLabel(t.deadline);
              return (
                <tr key={t.id} className="hover:bg-hover/30 group">
                  <td className="py-2 pl-4 pr-2 relative">
                    <span
                      className={cn(
                        "absolute left-0 top-2 bottom-2 w-[3px] rounded-full",
                        STRIPE_BG[sev],
                        sev === "urgent" && "urgent-stripe",
                      )}
                    />
                    <Link
                      href={`/tasks/${t.id}`}
                      className="text-text-primary hover:underline truncate block max-w-[28ch]"
                    >
                      {t.title}
                    </Link>
                  </td>
                  <td className="py-2 px-2">
                    {t.category && (
                      <Badge
                        variant="outline"
                        className="text-[10px] uppercase tracking-wider h-5 px-1.5 text-text-secondary"
                      >
                        {t.category.replace(/_/g, " ")}
                      </Badge>
                    )}
                  </td>
                  <td className="py-2 px-2 text-text-secondary">{t.priority}</td>
                  <td className={cn("py-2 px-2", STATUS_TONE[t.status ?? ""])}>
                    {STATUS_LABEL[t.status ?? ""] ?? t.status}
                  </td>
                  <td className="py-2 px-2 font-mono text-text-primary">
                    {formatUsd(t.amount_usd) ?? "—"}
                  </td>
                  <td
                    className={cn(
                      "py-2 px-2 text-text-secondary",
                      due?.startsWith("Overdue") && "text-urgent",
                    )}
                  >
                    {due ?? "—"}
                  </td>
                  <td className="py-2 px-2 text-text-tertiary truncate max-w-[18ch]">
                    {t.assigned_to ?? "—"}
                  </td>
                  <td className="py-2 px-2">
                    <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      {t.status !== "completed" && t.status !== "cancelled" && (
                        <ItemActions id={t.id} variant="task" />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </PanelShell>
  );
}
