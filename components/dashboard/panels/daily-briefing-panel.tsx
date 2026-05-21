import { format } from "date-fns";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { OPEN_TASK_STATUSES, formatUsd } from "@/lib/panels";
import { daysAgoIso, nowMs } from "@/lib/time";
import PanelShell from "../panel-shell";
import EmptyState from "../empty-state";
import AiTag from "../ai-tag";
import {
  GenerateBriefingButton,
  RegenerateBriefingIcon,
} from "../briefing-actions";

function todayKey(date = new Date()) {
  return format(date, "yyyy-MM-dd");
}

function generatedAgo(iso: string | null): string {
  if (!iso) return "—";
  const minutes = Math.max(
    0,
    Math.round((nowMs() - new Date(iso).getTime()) / 60_000),
  );
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export default async function DailyBriefingPanel() {
  const db = createServiceRoleClient();
  const today = todayKey();
  const dayStart = new Date(`${today}T00:00:00Z`).toISOString();
  const dayEnd = new Date(`${today}T23:59:59Z`).toISOString();
  const threeDaysAgo = daysAgoIso(3);

  const [briefingRes, openUrgent, approvals, aging, meetings] = await Promise.all([
    db
      .from("briefings")
      .select("id, briefing_date, sections, executive_summary, generated_at, delivered")
      .eq("briefing_date", today)
      .maybeSingle(),
    db
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .in("status", OPEN_TASK_STATUSES as unknown as string[])
      .eq("priority", "urgent"),
    db
      .from("tasks")
      .select("amount_usd", { count: "exact" })
      .in("status", OPEN_TASK_STATUSES as unknown as string[])
      .in("category", ["procurement", "capex"])
      .not("amount_usd", "is", null),
    db
      .from("followups")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "awaiting_response"])
      .lt("last_contacted", threeDaysAgo),
    db
      .from("meeting_notes")
      .select("id", { count: "exact", head: true })
      .gte("meeting_date", dayStart)
      .lte("meeting_date", dayEnd),
  ]);

  const briefing = briefingRes.data;
  const approvalsTotal = (approvals.data ?? []).reduce(
    (sum, row) => sum + (Number(row.amount_usd) || 0),
    0,
  );

  const stats = [
    { label: "Urgent open", value: openUrgent.count ?? 0 },
    {
      label: "Approvals waiting",
      value:
        approvals.count !== null && approvals.count !== undefined
          ? approvals.count
          : 0,
      hint: approvalsTotal > 0 ? `${formatUsd(approvalsTotal)} total` : undefined,
    },
    { label: "Aging followups", value: aging.count ?? 0 },
    { label: "Meetings today", value: meetings.count ?? 0 },
  ];

  return (
    <PanelShell
      title={`Daily briefing · ${format(new Date(), "EEE MMM d")}`}
      counter={briefing ? (briefing.delivered ? "Delivered" : "Ready") : "Pending"}
      headerExtras={
        briefing ? (
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider font-mono text-text-tertiary">
              {generatedAgo(briefing.generated_at)}
            </span>
            <RegenerateBriefingIcon />
          </div>
        ) : null
      }
    >
      {!briefing ? (
        <EmptyState
          title="No briefing generated yet today"
          hint="Pulls the dashboard signals together into a one-screen exec summary."
          action={<GenerateBriefingButton />}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4">
          <div className="lg:col-span-4 grid grid-cols-2 gap-3">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-md border border-border bg-raised/40 p-3"
              >
                <div className="text-[10px] uppercase tracking-wider text-text-tertiary">
                  {s.label}
                </div>
                <div className="text-2xl font-mono text-text-primary leading-tight mt-1">
                  {s.value}
                </div>
                {s.hint && (
                  <div className="text-[10px] text-text-secondary mt-0.5 font-mono">
                    {s.hint}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="lg:col-span-8 relative pr-7">
            <AiTag />
            <div className="text-[13px] text-text-primary leading-relaxed whitespace-pre-wrap">
              {briefing.executive_summary ?? (
                <span className="text-text-tertiary">
                  Briefing exists but executive_summary is empty.
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </PanelShell>
  );
}
