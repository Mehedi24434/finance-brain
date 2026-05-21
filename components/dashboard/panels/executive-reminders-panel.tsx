import { Bell, MessageCircle, Mail } from "lucide-react";
import { createServiceRoleClient } from "@/lib/supabase/server";
import EmptyState from "../empty-state";
import PanelShell from "../panel-shell";
import { severityForPriority, timeLabel, type Severity } from "@/lib/panels";
import { daysFromNowIso } from "@/lib/time";
import { cn } from "@/lib/utils";

const CHANNEL_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  telegram: MessageCircle,
  email: Mail,
  in_app: Bell,
};

const STRIPE_BG: Record<Severity, string> = {
  urgent: "bg-urgent",
  warning: "bg-warning",
  ok: "bg-ok",
  info: "bg-info",
  muted: "bg-text-tertiary/40",
};

export default async function ExecutiveRemindersPanel() {
  const db = createServiceRoleClient();
  const inDay = daysFromNowIso(1);
  const { data } = await db
    .from("reminders")
    .select("id, title, notes, priority, remind_at, channel, category")
    .eq("status", "scheduled")
    .lte("remind_at", inDay)
    .order("remind_at", { ascending: true })
    .limit(10);

  const rows = data ?? [];

  return (
    <PanelShell
      title="Executive reminders"
      counter={rows.length ? `${rows.length} in 24h` : null}
    >
      {rows.length === 0 ? (
        <EmptyState title="No reminders firing in the next 24 hours" />
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => {
            const ChannelIcon = CHANNEL_ICON[r.channel ?? "in_app"] ?? Bell;
            const severity = severityForPriority(r.priority);
            const when = timeLabel(r.remind_at) ?? r.remind_at;
            return (
              <li key={r.id} className="relative px-4 py-2.5 hover:bg-hover/40">
                <span
                  className={cn(
                    "absolute left-0 top-2 bottom-2 w-[3px] rounded-full",
                    STRIPE_BG[severity],
                    severity === "urgent" && "urgent-stripe",
                  )}
                />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <div className="text-[13px] text-text-primary truncate">
                      {r.title}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-text-secondary">
                      <ChannelIcon className="size-3" />
                      <span className="font-mono">{when}</span>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PanelShell>
  );
}
