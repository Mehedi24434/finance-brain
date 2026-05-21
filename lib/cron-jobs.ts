import "server-only";
import { format } from "date-fns";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { generateBriefing } from "@/lib/briefing-service";
import { sendMessage } from "@/lib/telegram";
import { syncRecent } from "@/lib/gmail";
import { syncUpcoming } from "@/lib/calendar";
import { updateLastSync, loadGoogleConfig } from "@/lib/google-oauth";

// ---------------------------------------------------------------------
// Single-user note: every job iterates once over "the user". The
// executive_profile table has one row and we have one Telegram chat,
// one Google integration, etc. We keep the function shape generic so
// growing to multi-user later doesn't require a rewrite.
// ---------------------------------------------------------------------

export type BriefingCronResult = {
  generated: boolean;
  delivered: boolean;
  skipped?: "already_exists" | "telegram_not_linked";
  briefing_date?: string;
  error?: string;
};

export async function runBriefingCron(): Promise<BriefingCronResult> {
  const db = createServiceRoleClient();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: existing } = await db
    .from("briefings")
    .select("id, executive_summary, delivered")
    .eq("briefing_date", today)
    .maybeSingle();

  let briefing = existing;
  if (!briefing) {
    try {
      const generated = await generateBriefing();
      briefing = {
        id: generated.id,
        executive_summary: generated.executive_summary,
        delivered: generated.delivered,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Briefing failed";
      await db.from("audit_log").insert({
        event_type: "cron.briefing",
        payload: { ok: false, error: message },
      });
      return { generated: false, delivered: false, error: message };
    }
  }

  // Deliver to Telegram if linked.
  let delivered = briefing.delivered;
  if (!delivered) {
    try {
      await sendMessage(
        `Briefing — ${today}\n\n${briefing.executive_summary}`,
      );
      // sendMessage no-ops if Telegram isn't linked, so flip the flag
      // only when we actually have a link.
      const { data: profile } = await db
        .from("executive_profile")
        .select("telegram_user_id")
        .limit(1)
        .maybeSingle();
      if (profile?.telegram_user_id) {
        await db.from("briefings").update({ delivered: true }).eq("id", briefing.id);
        delivered = true;
      }
    } catch (err) {
      console.error("cron.briefing telegram delivery failed", err);
    }
  }

  await db.from("audit_log").insert({
    event_type: "cron.briefing",
    payload: { ok: true, briefing_date: today, delivered },
  });

  return {
    generated: !existing,
    delivered,
    briefing_date: today,
    skipped: existing ? "already_exists" : undefined,
  };
}

// ---------------------------------------------------------------------

const REMINDER_BATCH = 50;

export type RemindersCronResult = {
  fired: number;
  failed: number;
  by_channel: Record<string, number>;
};

export async function runRemindersCron(): Promise<RemindersCronResult> {
  const db = createServiceRoleClient();
  const nowIso = new Date().toISOString();

  const { data: due, error } = await db
    .from("reminders")
    .select(
      "id, title, notes, channel, priority, remind_at, related_task_id, related_followup_id, related_meeting_id",
    )
    .eq("status", "scheduled")
    .lte("remind_at", nowIso)
    .order("remind_at", { ascending: true })
    .limit(REMINDER_BATCH);
  if (error) {
    await db.from("audit_log").insert({
      event_type: "cron.reminders",
      payload: { ok: false, error: error.message },
    });
    return { fired: 0, failed: 0, by_channel: {} };
  }

  const rows = due ?? [];
  if (rows.length === 0) {
    return { fired: 0, failed: 0, by_channel: {} };
  }

  // Resolve linked entity titles so the reminder message has context.
  const taskIds = rows.map((r) => r.related_task_id).filter(Boolean) as string[];
  const followupIds = rows
    .map((r) => r.related_followup_id)
    .filter(Boolean) as string[];
  const meetingIds = rows
    .map((r) => r.related_meeting_id)
    .filter(Boolean) as string[];

  const [tasksRes, followupsRes, meetingsRes] = await Promise.all([
    taskIds.length
      ? db.from("tasks").select("id, title").in("id", taskIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    followupIds.length
      ? db.from("followups").select("id, subject").in("id", followupIds)
      : Promise.resolve({ data: [] as { id: string; subject: string }[] }),
    meetingIds.length
      ? db.from("meeting_notes").select("id, title").in("id", meetingIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ]);

  const taskTitle = new Map((tasksRes.data ?? []).map((r) => [r.id, r.title]));
  const followupTitle = new Map(
    (followupsRes.data ?? []).map((r) => [r.id, r.subject]),
  );
  const meetingTitle = new Map(
    (meetingsRes.data ?? []).map((r) => [r.id, r.title]),
  );

  let fired = 0;
  let failed = 0;
  const byChannel: Record<string, number> = {};

  for (const r of rows) {
    const linked =
      (r.related_task_id && taskTitle.get(r.related_task_id)) ||
      (r.related_followup_id && followupTitle.get(r.related_followup_id)) ||
      (r.related_meeting_id && meetingTitle.get(r.related_meeting_id)) ||
      null;
    const channel = r.channel ?? "in_app";

    try {
      if (channel === "telegram") {
        await sendMessage(
          linked ? `Reminder: ${r.title} — ${linked}` : `Reminder: ${r.title}`,
        );
      } else if (channel === "email") {
        // Skipped for the demo. Gmail send works but adds friction.
      } else {
        // 'in_app' — nothing to push; the dashboard's ExecutiveReminders
        // panel already shows scheduled reminders. Marking sent is enough.
      }

      const sentAt = new Date().toISOString();
      const { error: updateError } = await db
        .from("reminders")
        .update({ status: "sent", sent_at: sentAt })
        .eq("id", r.id);
      if (updateError) throw new Error(updateError.message);

      fired += 1;
      byChannel[channel] = (byChannel[channel] ?? 0) + 1;
    } catch (err) {
      failed += 1;
      console.error("cron.reminders fire failed", r.id, err);
    }
  }

  await db.from("audit_log").insert({
    event_type: "cron.reminders",
    payload: { ok: true, fired, failed, by_channel: byChannel },
  });

  return { fired, failed, by_channel: byChannel };
}

// ---------------------------------------------------------------------

export type SyncCronResult = {
  skipped?: "google_not_connected";
  gmail?: Awaited<ReturnType<typeof syncRecent>> | { error: string };
  calendar?: Awaited<ReturnType<typeof syncUpcoming>> | { error: string };
};

export async function runSyncCron(): Promise<SyncCronResult> {
  const db = createServiceRoleClient();

  // Skip silently when Google isn't connected — keeps the every-10-min
  // cron quiet during development.
  const config = await loadGoogleConfig();
  if (!config?.refresh_token) {
    return { skipped: "google_not_connected" };
  }

  const [gmail, calendar] = await Promise.allSettled([
    syncRecent(),
    syncUpcoming(),
  ]);
  await updateLastSync();

  const result: SyncCronResult = {
    gmail:
      gmail.status === "fulfilled"
        ? gmail.value
        : { error: gmail.reason instanceof Error ? gmail.reason.message : "failed" },
    calendar:
      calendar.status === "fulfilled"
        ? calendar.value
        : {
            error:
              calendar.reason instanceof Error
                ? calendar.reason.message
                : "failed",
          },
  };

  await db.from("audit_log").insert({
    event_type: "cron.sync",
    payload: {
      gmail: result.gmail,
      calendar: result.calendar,
    },
  });

  return result;
}
