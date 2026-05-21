import "server-only";
import { google } from "googleapis";
import { getGoogleClient } from "@/lib/google-oauth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { callClaude } from "@/lib/claude";

type SyncResult = {
  fetched: number;
  upserted: number;
};

const FINANCE_TITLE_KEYWORDS = [
  "board",
  "audit",
  "close",
  "budget",
  "forecast",
  "capex",
  "treasury",
  "vendor",
  "procurement",
  "investor",
  "tax",
  "compliance",
  "review",
  "1:1",
  "1-1",
];

// Returns a finance_category enum value. meeting_notes.category is NOT NULL
// (default 'other'), so we always return a concrete string — passing null
// would override the column default and fail the not-null constraint.
function guessCategory(title: string | null): string {
  if (!title) return "other";
  const lower = title.toLowerCase();
  if (/\bboard\b/.test(lower)) return "board";
  if (/\baudit\b/.test(lower)) return "audit";
  if (/\bclose\b/.test(lower)) return "close";
  if (/\bbudget|forecast\b/.test(lower)) return "forecasting";
  if (/\bcapex\b/.test(lower)) return "capex";
  if (/\btreasury|cash\b/.test(lower)) return "treasury";
  if (/\bvendor|procurement\b/.test(lower)) return "procurement";
  if (/\binvestor|ir\b/.test(lower)) return "investor_relations";
  if (/\btax\b/.test(lower)) return "tax";
  if (/\bcompliance|sox\b/.test(lower)) return "compliance";
  if (/\boperation|ops\b/.test(lower)) return "operations";
  return "other";
}

export async function syncUpcoming(daysAhead = 7): Promise<SyncResult> {
  const auth = await getGoogleClient();
  const cal = google.calendar({ version: "v3", auth });

  const now = new Date();
  const horizon = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const list = await cal.events.list({
    calendarId: "primary",
    timeMin: now.toISOString(),
    timeMax: horizon.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 50,
  });

  const events = list.data.items ?? [];
  if (events.length === 0) {
    return { fetched: 0, upserted: 0 };
  }

  const db = createServiceRoleClient();

  // Pre-fetch existing rows by calendar_event_id so we can route each
  // incoming event to an insert or an update. The unique index on
  // meeting_notes(calendar_event_id) is partial
  // (WHERE calendar_event_id IS NOT NULL), so PostgREST's `onConflict`
  // can't target it directly.
  const incomingIds = events
    .map((ev) => ev.id)
    .filter((id): id is string => Boolean(id));

  const existingById = new Map<string, string>();
  if (incomingIds.length) {
    const { data: existing } = await db
      .from("meeting_notes")
      .select("id, calendar_event_id")
      .in("calendar_event_id", incomingIds);
    for (const row of existing ?? []) {
      if (row.calendar_event_id) existingById.set(row.calendar_event_id, row.id);
    }
  }

  let upserted = 0;

  await Promise.all(
    events.map(async (ev) => {
      if (!ev.id) return;
      const start = ev.start?.dateTime ?? ev.start?.date;
      if (!start) return;
      const startIso = new Date(start).toISOString();
      const endIso = ev.end?.dateTime ?? ev.end?.date ?? null;
      const durationMin =
        endIso
          ? Math.max(
              1,
              Math.round(
                (new Date(endIso).getTime() - new Date(start).getTime()) / 60000,
              ),
            )
          : null;
      const attendees =
        ev.attendees
          ?.filter((a) => !a.self)
          .map((a) => a.email ?? a.displayName ?? "")
          .filter((s) => s.length > 0) ?? [];
      const title = ev.summary ?? "(no title)";
      const category = guessCategory(title);

      const row = {
        calendar_event_id: ev.id,
        title,
        meeting_date: startIso,
        duration_min: durationMin,
        attendees,
        category,
        agenda: ev.description ?? null,
      };

      const existingId = existingById.get(ev.id);
      if (existingId) {
        const { error } = await db
          .from("meeting_notes")
          .update(row)
          .eq("id", existingId);
        if (error) {
          console.error(
            "calendar update failed",
            ev.id,
            error.code,
            error.message,
            error.details,
          );
        } else {
          upserted += 1;
        }
        return;
      }

      const { error } = await db.from("meeting_notes").insert(row);
      if (error) {
        // 23505 = unique_violation. A concurrent run inserted between
        // our pre-check and our insert; treat as success.
        if (error.code === "23505") {
          upserted += 1;
        } else {
          console.error(
            "calendar insert failed",
            ev.id,
            error.code,
            error.message,
            error.details,
          );
        }
      } else {
        upserted += 1;
      }
    }),
  );

  await db.from("audit_log").insert({
    event_type: "calendar.sync",
    payload: { fetched: events.length, upserted, days_ahead: daysAhead },
  });

  return { fetched: events.length, upserted };
}

export async function generatePrebrief(meetingId: string): Promise<{
  preBrief: string;
  keyAmounts: string[];
}> {
  const db = createServiceRoleClient();
  const { data: meeting, error } = await db
    .from("meeting_notes")
    .select(
      "id, title, meeting_date, duration_min, attendees, category, agenda, notes",
    )
    .eq("id", meetingId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!meeting) throw new Error(`meeting ${meetingId} not found`);

  const title = meeting.title ?? "";
  const STOPWORDS = new Set(["meeting", "review", "weekly", "with"]);
  const tokens: string[] = title
    .toLowerCase()
    .split(/\W+/)
    .filter((t: string) => t.length >= 4 && !STOPWORDS.has(t))
    .slice(0, 6);

  // Related open tasks — match where ANY token appears in title.
  let relatedTasks: Array<{
    title: string;
    category: string | null;
    priority: string | null;
    amount_usd: number | null;
    deadline: string | null;
    status: string | null;
  }> = [];
  if (tokens.length) {
    const orClauses = tokens.map((t) => `title.ilike.%${t}%`).join(",");
    const { data } = await db
      .from("tasks")
      .select("title, category, priority, amount_usd, deadline, status")
      .not("status", "in", "(completed,cancelled)")
      .or(orClauses)
      .limit(15);
    relatedTasks = data ?? [];
  }

  // Recent inbox items mentioning any attendee handle (email or display).
  const attendees = (meeting.attendees as string[] | null) ?? [];
  let recentInbox: Array<{
    sender: string | null;
    subject: string | null;
    classification: string | null;
    received_at: string;
  }> = [];
  if (attendees.length) {
    const handles = attendees
      .map((a) => {
        const at = a.indexOf("@");
        if (at !== -1) return a.slice(0, at);
        return a.split(/\s+/)[0];
      })
      .filter((h) => h && h.length >= 3)
      .slice(0, 6);
    if (handles.length) {
      const orClauses = handles.map((h) => `sender.ilike.%${h}%`).join(",");
      const { data } = await db
        .from("inbox_items")
        .select("sender, subject, classification, received_at")
        .or(orClauses)
        .gte(
          "received_at",
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        )
        .order("received_at", { ascending: false })
        .limit(10);
      recentInbox = data ?? [];
    }
  }

  const input = {
    meeting: {
      title: meeting.title,
      meeting_date: meeting.meeting_date,
      duration_min: meeting.duration_min,
      attendees,
      category: meeting.category,
      agenda: meeting.agenda,
      notes: meeting.notes,
    },
    related_open_tasks: relatedTasks,
    recent_inbox_from_attendees: recentInbox,
  };

  type PrebriefOutput = { brief: string; key_amounts?: string[] };
  const output = await callClaude<PrebriefOutput>({
    task: "meeting_prebrief",
    input,
  });

  const preBrief = output.brief?.trim() ?? "";
  const keyAmounts = Array.isArray(output.key_amounts) ? output.key_amounts : [];

  await db
    .from("meeting_notes")
    .update({ pre_brief: preBrief })
    .eq("id", meetingId);

  await db.from("audit_log").insert({
    event_type: "calendar.prebrief",
    entity_table: "meeting_notes",
    entity_id: meetingId,
    payload: {
      title: meeting.title,
      related_tasks: relatedTasks.length,
      recent_inbox: recentInbox.length,
      key_amounts: keyAmounts,
    },
  });

  return { preBrief, keyAmounts };
}
