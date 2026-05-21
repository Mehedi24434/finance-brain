import "server-only";
import { format } from "date-fns";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { callClaude } from "@/lib/claude";
import { OPEN_TASK_STATUSES } from "@/lib/panels";

export type BriefingOutput = {
  executive_summary: string;
  sections: {
    urgent_risks: string[];
    approvals: string[];
    procurement: string[];
    treasury: string[];
    vendor: string[];
    inbox: string[];
    meetings: string[];
    concerns: string[];
  };
};

export type BriefingRow = {
  id: string;
  briefing_date: string;
  sections: BriefingOutput["sections"];
  executive_summary: string;
  generated_at: string;
  delivered: boolean;
};

const FOCUS_CATEGORIES = [
  "procurement",
  "capex",
  "treasury",
  "vendor",
  "close",
  "audit",
  "compliance",
  "operations",
  "board",
] as const;

export async function generateBriefing(): Promise<BriefingRow> {
  const db = createServiceRoleClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const nowIso = new Date().toISOString();
  const in24hIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const threeDaysAgoIso = new Date(
    Date.now() - 3 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const yesterdayIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const tasksByCategory: Record<
    string,
    Array<{
      title: string;
      priority: string | null;
      status: string | null;
      amount_usd: number | null;
      deadline: string | null;
      assigned_to: string | null;
    }>
  > = {};

  await Promise.all(
    FOCUS_CATEGORIES.map(async (category) => {
      const { data } = await db
        .from("tasks")
        .select("title, priority, status, amount_usd, deadline, assigned_to")
        .eq("category", category)
        .in("status", OPEN_TASK_STATUSES as unknown as string[])
        .order("priority", { ascending: false })
        .order("deadline", { ascending: true, nullsFirst: false })
        .limit(8);
      if (data?.length) tasksByCategory[category] = data;
    }),
  );

  const [
    urgentTasksRes,
    agingFollowupsRes,
    inboxRes,
    meetingsRes,
    remindersRes,
    concernsRes,
  ] = await Promise.all([
    db
      .from("tasks")
      .select(
        "title, category, priority, status, amount_usd, deadline, assigned_to",
      )
      .in("status", OPEN_TASK_STATUSES as unknown as string[])
      .eq("priority", "urgent")
      .order("deadline", { ascending: true, nullsFirst: false })
      .limit(8),
    db
      .from("followups")
      .select(
        "subject, contact_name, category, status, last_contacted, due_date",
      )
      .in("status", ["open", "awaiting_response"])
      .lt("last_contacted", threeDaysAgoIso)
      .order("last_contacted", { ascending: true, nullsFirst: true })
      .limit(8),
    db
      .from("inbox_items")
      .select(
        "sender, subject, classification, urgency_score, received_at, category",
      )
      .eq("status", "unread")
      .in("classification", ["approval", "urgent", "request"])
      .gte("received_at", yesterdayIso)
      .order("urgency_score", { ascending: false, nullsFirst: false })
      .limit(10),
    db
      .from("meeting_notes")
      .select("title, meeting_date, attendees, agenda, category")
      .gte("meeting_date", nowIso)
      .lte("meeting_date", in24hIso)
      .order("meeting_date", { ascending: true })
      .limit(8),
    db
      .from("reminders")
      .select("title, remind_at, channel, priority, category")
      .eq("status", "scheduled")
      .lte("remind_at", in24hIso)
      .order("remind_at", { ascending: true })
      .limit(10),
    db
      .from("ongoing_concerns")
      .select(
        "title, status, financial_impact_usd, stakeholders, next_review, category",
      )
      .in("status", ["active", "escalated"])
      .order("status", { ascending: false })
      .limit(10),
  ]);

  const approvalsTotal = [
    ...(tasksByCategory.procurement ?? []),
    ...(tasksByCategory.capex ?? []),
  ].reduce((sum, t) => sum + (Number(t.amount_usd) || 0), 0);

  const input = {
    today,
    urgent_tasks: urgentTasksRes.data ?? [],
    tasks_by_category: tasksByCategory,
    aging_followups: agingFollowupsRes.data ?? [],
    unread_inbox_24h: inboxRes.data ?? [],
    meetings_24h: meetingsRes.data ?? [],
    reminders_24h: remindersRes.data ?? [],
    active_concerns: concernsRes.data ?? [],
    approvals_total_usd: approvalsTotal,
  };

  const output = await callClaude<BriefingOutput>({
    task: "briefing",
    input,
  });

  const { data: upserted, error } = await db
    .from("briefings")
    .upsert(
      {
        briefing_date: today,
        sections: output.sections,
        executive_summary: output.executive_summary,
        generated_at: new Date().toISOString(),
        delivered: false,
      },
      { onConflict: "briefing_date" },
    )
    .select()
    .single();
  if (error) throw new Error(error.message);

  await db.from("audit_log").insert({
    event_type: "briefing.generated",
    entity_table: "briefings",
    entity_id: upserted.id,
    payload: { date: today },
  });

  return upserted as BriefingRow;
}
