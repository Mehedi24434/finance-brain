import { notFound } from "next/navigation";
import { format } from "date-fns";
import Link from "next/link";
import {
  ChevronLeft,
  Mail,
  MessageSquare,
  MessageCircle,
  PenLine,
  Inbox as InboxIcon,
  Calendar,
} from "lucide-react";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  dueLabel,
  formatUsd,
  severityForPriority,
  type Severity,
} from "@/lib/panels";
import { cn } from "@/lib/utils";
import TaskDetailRail from "./detail-rail";
import LinkedInboxItem from "./linked-inbox-item";

export const dynamic = "force-dynamic";

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

const SOURCE_ICON: Record<
  string,
  { Icon: React.ComponentType<{ className?: string }>; label: string }
> = {
  email: { Icon: Mail, label: "Gmail" },
  slack: { Icon: MessageSquare, label: "Slack" },
  telegram: { Icon: MessageCircle, label: "Telegram" },
  manual: { Icon: PenLine, label: "Manual" },
  briefing: { Icon: InboxIcon, label: "Briefing" },
  calendar: { Icon: Calendar, label: "Calendar" },
};

const STRIPE_BG: Record<Severity, string> = {
  urgent: "bg-urgent",
  warning: "bg-warning",
  ok: "bg-ok",
  info: "bg-info",
  muted: "bg-text-tertiary/40",
};

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createServiceRoleClient();

  const { data: task } = await db
    .from("tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!task) notFound();

  const [{ data: inboxItem }, { data: auditEntries }, { data: linkedFollowups }] =
    await Promise.all([
      db
        .from("inbox_items")
        .select(
          "id, sender, subject, preview, body, source, received_at, classification",
        )
        .eq("related_task_id", id)
        .order("received_at", { ascending: false })
        .maybeSingle(),
      db
        .from("audit_log")
        .select("id, event_type, payload, created_at")
        .eq("entity_table", "tasks")
        .eq("entity_id", id)
        .order("created_at", { ascending: false })
        .limit(25),
      db
        .from("followups")
        .select("id, subject, contact_name, status, last_contacted, created_at")
        .eq("related_task_id", id)
        .order("created_at", { ascending: false }),
    ]);

  const severity = severityForPriority(task.priority);
  const due = dueLabel(task.deadline);
  const amountLabel = formatUsd(task.amount_usd);
  const sourceMeta =
    task.source && SOURCE_ICON[task.source as keyof typeof SOURCE_ICON];

  return (
    <div className="p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4">
      <div className="lg:col-span-8 space-y-4">
        <div>
          <Link
            href="/tasks"
            className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary text-xs"
          >
            <ChevronLeft className="size-3.5" />
            All tasks
          </Link>
        </div>

        <header className="relative bg-surface border border-border rounded-lg p-4 pl-5">
          <span
            className={cn(
              "absolute left-0 top-4 bottom-4 w-[3px] rounded-full",
              STRIPE_BG[severity],
              severity === "urgent" && "urgent-stripe",
            )}
          />
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2 min-w-0">
              <h1 className="text-lg font-semibold text-text-primary leading-tight">
                {task.title}
              </h1>
              <div className="flex flex-wrap items-center gap-1.5">
                {task.category && (
                  <Badge
                    variant="outline"
                    className="text-[10px] uppercase tracking-wider h-5 px-1.5 text-text-secondary"
                  >
                    {task.category.replace(/_/g, " ")}
                  </Badge>
                )}
                {task.priority && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] uppercase tracking-wider h-5 px-1.5",
                      task.priority === "urgent" && "border-urgent/40 text-urgent",
                      task.priority === "high" && "border-warning/40 text-warning",
                      task.priority === "medium" && "border-info/40 text-info",
                    )}
                  >
                    {task.priority}
                  </Badge>
                )}
                <span
                  className={cn(
                    "text-[11px]",
                    STATUS_TONE[task.status ?? ""],
                  )}
                >
                  {STATUS_LABEL[task.status ?? ""] ?? task.status}
                </span>
                {due && (
                  <>
                    <span className="text-text-tertiary text-[11px]">·</span>
                    <span
                      className={cn(
                        "text-[11px] text-text-secondary",
                        due.startsWith("Overdue") && "text-urgent",
                      )}
                    >
                      {due}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          {amountLabel && (
            <div className="mt-3 font-mono text-2xl text-text-primary">
              {amountLabel}
            </div>
          )}
        </header>

        {task.description && (
          <section className="bg-surface border border-border rounded-lg p-4 text-[13px] text-text-primary leading-relaxed whitespace-pre-wrap">
            {task.description}
          </section>
        )}

        {sourceMeta && (
          <section className="bg-surface border border-border rounded-lg p-3 flex items-center gap-2 text-[12px] text-text-secondary">
            <sourceMeta.Icon className="size-3.5" />
            <span>From {sourceMeta.label}</span>
            {task.source_ref && (
              <>
                <span className="text-text-tertiary">·</span>
                <span className="font-mono text-text-tertiary truncate">
                  {task.source_ref}
                </span>
              </>
            )}
          </section>
        )}

        {inboxItem && <LinkedInboxItem item={inboxItem} />}

        <section className="bg-surface border border-border rounded-lg">
          <header className="h-10 px-3 flex items-center border-b border-border">
            <h2 className="text-[13px] font-semibold tracking-tight">Activity</h2>
          </header>
          {!auditEntries?.length ? (
            <div className="px-3 py-6 text-center text-xs text-text-tertiary">
              No activity logged yet.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {auditEntries.map((e) => (
                <li
                  key={e.id}
                  className="px-3 py-2 text-[12px] flex items-center justify-between gap-3"
                >
                  <div className="text-text-primary">{e.event_type}</div>
                  <div className="font-mono text-text-tertiary text-[11px]">
                    {format(new Date(e.created_at), "MMM d, HH:mm")}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {linkedFollowups && linkedFollowups.length > 0 && (
          <section className="bg-surface border border-border rounded-lg">
            <header className="h-10 px-3 flex items-center border-b border-border">
              <h2 className="text-[13px] font-semibold tracking-tight">Followups</h2>
            </header>
            <ul className="divide-y divide-border">
              {linkedFollowups.map((f) => (
                <li key={f.id} className="px-3 py-2 text-[12px]">
                  <div className="text-text-primary">{f.subject}</div>
                  <div className="text-text-tertiary text-[11px]">
                    {f.contact_name ?? "—"} · {f.status}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="lg:col-span-4">
        <TaskDetailRail
          taskId={task.id}
          taskTitle={task.title}
          status={task.status}
        />
      </div>
    </div>
  );
}
