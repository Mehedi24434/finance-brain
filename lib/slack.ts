import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/server";

// --- Slack API types (minimal slices) ---------------------------------

export type SlackMessageEvent = {
  type: string;
  subtype?: string;
  channel?: string;
  user?: string;
  bot_id?: string;
  text?: string;
  ts?: string;
  team?: string;
};

export type SlackEventCallback = {
  type: "event_callback";
  event_id: string;
  team_id?: string;
  event: SlackMessageEvent;
};

export type SlackUrlVerification = {
  type: "url_verification";
  challenge: string;
};

// --- Signature verification -------------------------------------------

const MAX_AGE_MS = 5 * 60 * 1000;

export function verifySignature(rawBody: string, headers: Headers): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) return false;

  const signature = headers.get("x-slack-signature");
  const timestamp = headers.get("x-slack-request-timestamp");
  if (!signature || !timestamp) return false;

  const tsNum = Number(timestamp);
  if (!Number.isFinite(tsNum)) return false;
  if (Math.abs(Date.now() - tsNum * 1000) > MAX_AGE_MS) return false;

  const base = `v0:${timestamp}:${rawBody}`;
  const computed = `v0=${createHmac("sha256", secret).update(base).digest("hex")}`;

  if (computed.length !== signature.length) return false;
  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
  } catch {
    return false;
  }
}

// --- Filter rules -----------------------------------------------------

const KEYWORDS = [
  "approve",
  "urgent",
  "blocked",
  "PO",
  "invoice",
  "vendor",
  "audit",
  "plant",
  "procurement",
  "escalation",
  "waiting",
] as const;

function matchesFilter(text: string): boolean {
  if (text.includes("$")) return true;
  const lower = text.toLowerCase();
  return KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

function shouldProcessEvent(event: SlackMessageEvent): boolean {
  if (event.type !== "message" && event.type !== "app_mention") return false;
  if (event.subtype) return false; // skip message_changed, bot_message, etc.
  if (event.bot_id) return false;
  if (!event.user) return false;
  if (event.user === process.env.SLACK_LUKE_USER_ID) return false;
  if (!event.text || !event.text.trim()) return false;
  if (!event.channel || !event.ts) return false;
  return true;
}

// --- Slack API helpers ------------------------------------------------

async function slackApi<T = unknown>(
  method: string,
  init?: { method?: "GET" | "POST"; body?: Record<string, unknown> },
): Promise<T> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN is not set");

  const httpMethod = init?.method ?? (init?.body ? "POST" : "GET");
  const url = `https://slack.com/api/${method}`;

  let res: Response;
  if (httpMethod === "GET") {
    res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
  } else {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(init?.body ?? {}),
    });
  }
  const body = (await res.json()) as { ok: boolean; error?: string } & T;
  if (!body.ok) {
    throw new Error(`Slack ${method} failed: ${body.error ?? "unknown"}`);
  }
  return body;
}

const userCache = new Map<string, string>();
const channelNameCache = new Map<string, string>();

async function getUsername(userId: string): Promise<string | null> {
  const cached = userCache.get(userId);
  if (cached) return cached;
  try {
    const body = await slackApi<{
      user?: { name?: string; real_name?: string; profile?: { display_name?: string } };
    }>(`users.info?user=${encodeURIComponent(userId)}`);
    const name =
      body.user?.profile?.display_name ||
      body.user?.real_name ||
      body.user?.name ||
      null;
    if (name) userCache.set(userId, name);
    return name;
  } catch {
    return null;
  }
}

async function getChannelName(channelId: string): Promise<string | null> {
  const cached = channelNameCache.get(channelId);
  if (cached) return cached;
  try {
    const body = await slackApi<{
      channel?: { name?: string };
    }>(`conversations.info?channel=${encodeURIComponent(channelId)}`);
    const name = body.channel?.name ?? null;
    if (name) channelNameCache.set(channelId, name);
    return name;
  } catch {
    return null;
  }
}

export async function listChannels(): Promise<
  Array<{ id: string; name: string; is_private: boolean; is_member: boolean }>
> {
  const body = await slackApi<{
    channels?: Array<{
      id: string;
      name: string;
      is_private: boolean;
      is_member: boolean;
    }>;
  }>(
    "conversations.list?exclude_archived=true&types=public_channel,private_channel&limit=200",
  );
  return body.channels ?? [];
}

export async function sendDM(text: string): Promise<void> {
  const luke = process.env.SLACK_LUKE_USER_ID;
  if (!luke) throw new Error("SLACK_LUKE_USER_ID is not set");
  await slackApi("chat.postMessage", {
    body: { channel: luke, text, mrkdwn: true },
  });
}

// --- processEvent ------------------------------------------------------

type ProcessResult =
  | { inboxItemId: string }
  | { inboxItemId: null; reason: string };

async function getMonitoredChannels(): Promise<string[] | null> {
  const db = createServiceRoleClient();
  const { data } = await db
    .from("integrations")
    .select("config")
    .eq("service", "slack")
    .maybeSingle();
  const channels =
    (data?.config as { slack_channels?: string[] } | null)?.slack_channels ??
    null;
  return channels && channels.length ? channels : null;
}

export async function processEvent(
  event: SlackMessageEvent,
): Promise<ProcessResult> {
  if (!shouldProcessEvent(event)) {
    return { inboxItemId: null, reason: "filtered:event_shape" };
  }

  const monitored = await getMonitoredChannels();
  if (monitored && !monitored.includes(event.channel!)) {
    return { inboxItemId: null, reason: "filtered:channel_not_monitored" };
  }

  const text = event.text!;
  if (!matchesFilter(text)) {
    return { inboxItemId: null, reason: "filtered:no_keyword_match" };
  }

  const [username, channelName] = await Promise.all([
    getUsername(event.user!),
    getChannelName(event.channel!),
  ]);

  const externalId = `${event.channel}:${event.ts}`;
  const receivedAt = new Date(
    Math.floor(parseFloat(event.ts!) * 1000),
  ).toISOString();

  const db = createServiceRoleClient();
  const { data: inserted, error } = await db
    .from("inbox_items")
    .upsert(
      {
        source: "slack",
        external_id: externalId,
        sender: username ?? event.user!,
        subject: channelName ? `#${channelName}` : event.channel!,
        preview: text.slice(0, 200),
        body: text,
        status: "unread",
        received_at: receivedAt,
        needs_action: true,
      },
      { onConflict: "source,external_id" },
    )
    .select("id")
    .single();
  if (error) {
    console.error("processEvent insert failed", error);
    return { inboxItemId: null, reason: `db:${error.message}` };
  }

  // Update integration last_sync_at (best-effort).
  await db
    .from("integrations")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("service", "slack");

  return { inboxItemId: inserted.id };
}
