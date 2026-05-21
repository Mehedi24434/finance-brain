import "server-only";
import { format } from "date-fns";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { callClaude } from "@/lib/claude";
import { OPEN_TASK_STATUSES, formatUsd } from "@/lib/panels";
import { isAuthorizedTelegramUser } from "@/lib/telegram-auth";
import { generateBriefing } from "@/lib/briefing-service";

// --- Telegram types (only the fields we use) ---------------------------

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
};

type TelegramMessage = {
  message_id: number;
  from?: { id: number; first_name?: string; username?: string };
  chat: { id: number };
  date: number;
  text?: string;
  voice?: TelegramVoice;
};

type TelegramVoice = {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type?: string;
};

// --- sendMessage -------------------------------------------------------

const MAX_CHUNK = 4000;

function chunkText(text: string, max = MAX_CHUNK): string[] {
  if (text.length <= max) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > max) {
    // Try to break on a newline near the boundary.
    let cut = remaining.lastIndexOf("\n", max);
    if (cut < max * 0.6) cut = max;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).replace(/^\n+/, "");
  }
  if (remaining.length) chunks.push(remaining);
  return chunks;
}

async function isTelegramLinked(): Promise<boolean> {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_USER_ID) {
    return false;
  }
  const db = createServiceRoleClient();
  const { data } = await db
    .from("executive_profile")
    .select("telegram_user_id")
    .limit(1)
    .maybeSingle();
  return Boolean(data?.telegram_user_id);
}

/**
 * Send a Telegram DM to Luke. Plain text only — no parse_mode — to avoid
 * Markdown rendering surprises on user-supplied content (vendor names
 * with underscores, dollar figures with parens, etc.).
 *
 * Chunked at 4000 chars so long briefings still go through.
 */
export async function sendMessage(text: string): Promise<void> {
  if (!text.trim()) return;
  const linked = await isTelegramLinked();
  if (!linked) {
    console.warn("telegram.sendMessage skipped: not linked");
    return;
  }
  const chatId = Number(process.env.TELEGRAM_USER_ID);
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const chunks = chunkText(text);
  for (const chunk of chunks) {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: chunk,
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("telegram.sendMessage failed", res.status, body);
      return;
    }
  }
}

// --- Voice transcription via Whisper -----------------------------------

type TranscriptionResult =
  | { success: true; text: string; audioUrl: string }
  | { success: false; audioUrl: string | null; reason: string };

async function transcribeVoice(fileId: string): Promise<TranscriptionResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!token) return { success: false, audioUrl: null, reason: "no telegram token" };

  const fileRes = await fetch(
    `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`,
  );
  if (!fileRes.ok) {
    return { success: false, audioUrl: null, reason: "getFile failed" };
  }
  const fileData = (await fileRes.json()) as {
    ok: boolean;
    result?: { file_path?: string };
  };
  if (!fileData.ok || !fileData.result?.file_path) {
    return { success: false, audioUrl: null, reason: "no file_path" };
  }
  const audioUrl = `https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`;

  if (!openaiKey) {
    return { success: false, audioUrl, reason: "OPENAI_API_KEY not set" };
  }

  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) {
    return { success: false, audioUrl, reason: "audio download failed" };
  }
  const audioBlob = await audioRes.blob();

  const form = new FormData();
  form.append(
    "file",
    new File([audioBlob], "voice.ogg", { type: "audio/ogg" }),
  );
  form.append("model", "whisper-1");
  form.append("language", "en");

  const whisperRes = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: form,
    },
  );
  if (!whisperRes.ok) {
    return { success: false, audioUrl, reason: `whisper ${whisperRes.status}` };
  }
  const whisperData = (await whisperRes.json()) as { text?: string };
  const transcript = whisperData.text?.trim();
  if (!transcript) {
    return { success: false, audioUrl, reason: "empty transcript" };
  }
  return { success: true, text: transcript, audioUrl };
}

// --- Time parsing ------------------------------------------------------

function parseWhen(connector: string, phrase: string): string {
  // Best-effort relative + absolute time parser. Falls back to +1h.
  const now = new Date();
  const lower = phrase.trim().toLowerCase();

  // "in N (min|mins|minute|hour|hours|day|days|week|weeks)"
  if (connector.toLowerCase() === "in") {
    const m = lower.match(
      /^(\d+)\s*(min|mins|minute|minutes|hour|hours|hr|hrs|day|days|week|weeks)\b/,
    );
    if (m) {
      const n = Number(m[1]);
      const unit = m[2];
      const ms = unit.startsWith("min")
        ? n * 60_000
        : unit.startsWith("hr") || unit.startsWith("hour")
          ? n * 3_600_000
          : unit.startsWith("day")
            ? n * 86_400_000
            : n * 7 * 86_400_000;
      return new Date(now.getTime() + ms).toISOString();
    }
  }

  // "at 3pm", "at 15:00", "at 3:30 pm", optionally with "tomorrow"
  const dayOffset = /\btomorrow\b/.test(lower)
    ? 1
    : /\btoday\b/.test(lower)
      ? 0
      : 0;
  const timeMatch = lower.match(
    /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/,
  );
  if (timeMatch) {
    let hour = Number(timeMatch[1]);
    const minute = timeMatch[2] ? Number(timeMatch[2]) : 0;
    const meridiem = timeMatch[3];
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
      const target = new Date(now);
      target.setDate(target.getDate() + dayOffset);
      target.setHours(hour, minute, 0, 0);
      // If the time is already in the past today and no explicit "tomorrow",
      // push to tomorrow.
      if (dayOffset === 0 && target.getTime() < now.getTime()) {
        target.setDate(target.getDate() + 1);
      }
      return target.toISOString();
    }
  }

  // Fallback: +1 hour.
  return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
}

// --- Domain helpers ----------------------------------------------------

const ONBOARDING = `Finance Brain — Telegram

I'm Luke's finance ops bot. Commands:

/briefing — generate and send today's exec briefing
/capture <text> — quick-capture a task (no parsing)
/help — this menu

You can also just type or speak. I'll route:
- "what's urgent?" → top 5 urgent items
- "briefing" → today's briefing
- "remind me to X at 3pm" → a reminder
- "task: …" or "add task …" → a task
- anything else → I'll do my best to parse the intent`;

async function createTaskFromTelegram(input: {
  title: string;
  category?: string | null;
  priority?: string | null;
  sourceRef?: string | null;
  notes?: string | null;
}): Promise<string | null> {
  const db = createServiceRoleClient();
  const { data, error } = await db
    .from("tasks")
    .insert({
      title: input.title.slice(0, 500),
      description: input.notes ?? null,
      category: input.category ?? null,
      priority: input.priority ?? "medium",
      status: "not_started",
      source: "telegram",
      source_ref: input.sourceRef ?? null,
    })
    .select("id")
    .single();
  if (error) {
    console.error("createTaskFromTelegram failed", error);
    return null;
  }
  return data.id;
}

async function createReminderFromTelegram(input: {
  title: string;
  remindAt: string;
  notes?: string | null;
  relatedTaskId?: string | null;
}): Promise<string | null> {
  const db = createServiceRoleClient();
  const { data, error } = await db
    .from("reminders")
    .insert({
      title: input.title.slice(0, 500),
      notes: input.notes ?? null,
      status: "scheduled",
      priority: "medium",
      remind_at: input.remindAt,
      channel: "telegram",
      related_task_id: input.relatedTaskId ?? null,
    })
    .select("id")
    .single();
  if (error) {
    console.error("createReminderFromTelegram failed", error);
    return null;
  }
  return data.id;
}

async function sendUrgentList() {
  const db = createServiceRoleClient();
  const { data } = await db
    .from("tasks")
    .select("title, amount_usd, deadline")
    .in("status", OPEN_TASK_STATUSES as unknown as string[])
    .eq("priority", "urgent")
    .order("deadline", { ascending: true, nullsFirst: false })
    .limit(5);
  if (!data?.length) {
    await sendMessage("No urgent items — you're clear.");
    return;
  }
  const lines = data.map((t, i) => {
    const amt = formatUsd(t.amount_usd);
    const due = t.deadline ? ` · due ${format(new Date(t.deadline), "MMM d")}` : "";
    return `${i + 1}. ${t.title}${amt ? ` (${amt})` : ""}${due}`;
  });
  await sendMessage(`Urgent (${data.length}):\n${lines.join("\n")}`);
}

async function sendTodaysBriefing(opts: { generateIfMissing: boolean }) {
  const db = createServiceRoleClient();
  const today = format(new Date(), "yyyy-MM-dd");
  let { data: briefing } = await db
    .from("briefings")
    .select("executive_summary, generated_at")
    .eq("briefing_date", today)
    .maybeSingle();

  if (!briefing && opts.generateIfMissing) {
    await sendMessage("Generating today's briefing…");
    try {
      const generated = await generateBriefing();
      briefing = {
        executive_summary: generated.executive_summary,
        generated_at: generated.generated_at,
      };
    } catch (err) {
      await sendMessage(
        `Briefing generation failed: ${err instanceof Error ? err.message : "unknown error"}`,
      );
      return;
    }
  }

  if (!briefing?.executive_summary) {
    await sendMessage(
      "No briefing for today. Open the dashboard and tap *Generate today's briefing*.",
    );
    return;
  }
  await sendMessage(`Briefing — ${today}\n\n${briefing.executive_summary}`);
}

async function handleFreeformText(text: string, audioUrl: string | null) {
  type ExtractResult = {
    intent: "reminder" | "task" | "briefing" | "urgent_query" | "unknown";
    title?: string;
    when?: string | null;
    notes?: string;
  };

  let result: ExtractResult | null = null;
  try {
    result = await callClaude<ExtractResult>({
      task: "extract_tasks",
      input: text,
    });
  } catch (err) {
    console.error("extract_tasks failed", err);
  }

  const intent = result?.intent ?? "unknown";

  if (intent === "briefing") {
    return sendTodaysBriefing({ generateIfMissing: true });
  }
  if (intent === "urgent_query") {
    return sendUrgentList();
  }
  if (intent === "reminder" && result?.title) {
    const remindAt =
      result.when && !Number.isNaN(Date.parse(result.when))
        ? new Date(result.when).toISOString()
        : new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const id = await createReminderFromTelegram({
      title: result.title,
      remindAt,
      notes: result.notes ?? null,
    });
    const when = format(new Date(remindAt), "EEE MMM d · HH:mm");
    await sendMessage(
      id
        ? `Reminder set for ${when}:\n${result.title}`
        : `Failed to save the reminder.`,
    );
    return;
  }
  if (intent === "task" && result?.title) {
    const id = await createTaskFromTelegram({
      title: result.title,
      sourceRef: audioUrl,
      notes: result.notes ?? null,
    });
    await sendMessage(
      id ? `Task captured: ${result.title}` : "Failed to save the task.",
    );
    return;
  }

  // Fallback: capture as a generic task using the raw text.
  const title = result?.title ?? text.slice(0, 200);
  const id = await createTaskFromTelegram({
    title,
    sourceRef: audioUrl,
    notes: result?.notes ?? null,
  });
  await sendMessage(
    id
      ? `Captured as a task: ${title}\n_(unclear intent — adjust on the dashboard if needed)_`
      : "Couldn't capture that — try again.",
  );
}

// --- Top-level dispatcher ---------------------------------------------

export async function handleUpdate(update: TelegramUpdate): Promise<void> {
  const msg = update.message ?? update.edited_message;
  if (!msg) return;
  if (!isAuthorizedTelegramUser(msg.from?.id)) return;

  let text: string | null = msg.text?.trim() ?? null;
  let audioUrl: string | null = null;

  if (msg.voice) {
    const transcription = await transcribeVoice(msg.voice.file_id);
    if (transcription.success) {
      text = transcription.text;
      audioUrl = transcription.audioUrl;
      await sendMessage(`Transcribed: ${text}`);
    } else {
      audioUrl = transcription.audioUrl;
      const taskId = await createTaskFromTelegram({
        title: "[Voice note received — tap to play]",
        sourceRef: audioUrl,
      });
      await sendMessage(
        `Voice note saved as a task${taskId ? "" : " (with errors)"}. ` +
          `Transcription failed: ${transcription.reason}.`,
      );
      return;
    }
  }

  if (!text) return;

  // Command-style routes.
  if (/^\/start\b/.test(text) || /^\/help\b/.test(text)) {
    return sendMessage(ONBOARDING);
  }
  if (/^\/briefing\b/.test(text)) {
    return sendTodaysBriefing({ generateIfMissing: true });
  }
  if (/^\/capture\s+/i.test(text)) {
    const title = text.replace(/^\/capture\s+/i, "").trim();
    if (!title) return sendMessage("Usage: /capture <text>");
    const id = await createTaskFromTelegram({
      title,
      sourceRef: audioUrl,
    });
    return sendMessage(id ? `Captured: ${title}` : "Failed to save.");
  }

  if (/^(what'?s urgent\??|urgent)$/i.test(text)) {
    return sendUrgentList();
  }
  if (/^(show me )?(my )?briefing$/i.test(text)) {
    return sendTodaysBriefing({ generateIfMissing: true });
  }

  const reminderMatch = text.match(/^remind me to (.+?)\s+(at|in)\s+(.+)$/i);
  if (reminderMatch) {
    const subject = reminderMatch[1].trim();
    const connector = reminderMatch[2];
    const phrase = reminderMatch[3].trim();
    const remindAt = parseWhen(connector, phrase);
    const id = await createReminderFromTelegram({
      title: subject,
      remindAt,
    });
    const when = format(new Date(remindAt), "EEE MMM d · HH:mm");
    return sendMessage(
      id
        ? `Reminder set for ${when}:\n${subject}`
        : "Failed to save the reminder.",
    );
  }

  const taskMatch = text.match(/^(?:add task |task:\s*)(.+)$/i);
  if (taskMatch) {
    const title = taskMatch[1].trim();
    const id = await createTaskFromTelegram({
      title,
      sourceRef: audioUrl,
    });
    return sendMessage(id ? `Task captured: ${title}` : "Failed to save.");
  }

  return handleFreeformText(text, audioUrl);
}
