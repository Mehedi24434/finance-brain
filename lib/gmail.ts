import "server-only";
import { google } from "googleapis";
import type { gmail_v1 } from "googleapis";
import { getGoogleClient, loadGoogleConfig } from "@/lib/google-oauth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { triageInboxItem } from "@/lib/triage";

const DEFAULT_QUERY = "from:(*.com) -in:promotions newer_than:7d";
const SYNC_CAP = 10;

function header(
  payload: gmail_v1.Schema$MessagePart | undefined,
  name: string,
): string | null {
  const lower = name.toLowerCase();
  const found = payload?.headers?.find((h) => h.name?.toLowerCase() === lower);
  return found?.value ?? null;
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
    "utf8",
  );
}

function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";
  // Prefer text/plain; fall back to first body.data we find.
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts?.length) {
    for (const part of payload.parts) {
      const t = extractBody(part);
      if (t) return t;
    }
  }
  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  return "";
}

type SyncResult = {
  fetched: number;
  inserted: number;
  triaged: number;
  failed: number;
};

export async function syncRecent(): Promise<SyncResult> {
  const config = await loadGoogleConfig();
  const auth = await getGoogleClient();
  const gmail = google.gmail({ version: "v1", auth });

  const q = config?.gmail_query?.trim() || DEFAULT_QUERY;

  const list = await gmail.users.messages.list({
    userId: "me",
    q,
    maxResults: SYNC_CAP * 2, // overfetch to allow for already-seen ids
  });
  const messages = list.data.messages ?? [];
  if (messages.length === 0) {
    return { fetched: 0, inserted: 0, triaged: 0, failed: 0 };
  }

  // Filter out messages already in inbox_items.
  const db = createServiceRoleClient();
  const ids = messages.map((m) => m.id!).filter(Boolean);
  const { data: existing } = await db
    .from("inbox_items")
    .select("external_id")
    .eq("source", "email")
    .in("external_id", ids);
  const seen = new Set((existing ?? []).map((r) => r.external_id));

  const newIds = ids.filter((id) => !seen.has(id)).slice(0, SYNC_CAP);
  if (newIds.length === 0) {
    return { fetched: messages.length, inserted: 0, triaged: 0, failed: 0 };
  }

  const insertedIds: string[] = [];

  // Fetch and insert in parallel. We already filtered newIds against the
  // `seen` set above, so this is a plain insert — the unique index on
  // (source, external_id) is partial (WHERE external_id IS NOT NULL),
  // and PostgREST's `onConflict` can't target partial indexes (it has
  // no way to pass the index predicate). The pre-filter makes upsert
  // unnecessary here.
  await Promise.all(
    newIds.map(async (id) => {
      try {
        const full = await gmail.users.messages.get({
          userId: "me",
          id,
          format: "full",
        });
        const payload = full.data.payload;
        const from = header(payload, "From");
        const subject = header(payload, "Subject");
        const dateHdr = header(payload, "Date");
        const body = extractBody(payload).trim();
        const snippet = full.data.snippet ?? body.slice(0, 200);

        const receivedAt = dateHdr
          ? new Date(dateHdr).toISOString()
          : new Date().toISOString();

        const { data: row, error } = await db
          .from("inbox_items")
          .insert({
            source: "email",
            external_id: id,
            sender: from ?? "(unknown)",
            subject: subject ?? "(no subject)",
            preview: snippet?.slice(0, 200) ?? null,
            body: body || null,
            status: "unread",
            received_at: receivedAt,
            needs_action: true,
          })
          .select("id")
          .single();
        if (error) {
          // 23505 = unique_violation. Safe to ignore — the row was
          // inserted by a concurrent run between our seen-set check
          // and this insert.
          if (error.code !== "23505") {
            console.error(
              "gmail insert failed",
              id,
              error.code,
              error.message,
              error.details,
            );
          }
          return;
        }
        if (row?.id) insertedIds.push(row.id);
      } catch (err) {
        console.error("gmail.messages.get failed", id, err);
      }
    }),
  );

  // Triage concurrently. Promise.allSettled so one failure doesn't kill
  // the rest.
  const triageResults = await Promise.allSettled(
    insertedIds.map((id) => triageInboxItem(id)),
  );
  const triaged = triageResults.filter((r) => r.status === "fulfilled").length;
  const failed = triageResults.length - triaged;

  await db.from("audit_log").insert({
    event_type: "gmail.sync",
    payload: {
      fetched: messages.length,
      inserted: insertedIds.length,
      triaged,
      failed,
      query: q,
    },
  });

  return {
    fetched: messages.length,
    inserted: insertedIds.length,
    triaged,
    failed,
  };
}

// --- sendReply ---------------------------------------------------------

function rfc2047EncodeIfNeeded(s: string): string {
  // If the string contains only printable ASCII, no encoding needed.
  // Otherwise, MIME-encode as UTF-8/base64.
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(s)) return s;
  return `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function sendReply(
  inboxItemId: string,
  body: string,
): Promise<{ messageId: string; threadId: string }> {
  if (!body.trim()) throw new Error("Reply body is empty");

  const db = createServiceRoleClient();
  const { data: item, error } = await db
    .from("inbox_items")
    .select("id, source, external_id, sender, subject")
    .eq("id", inboxItemId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!item) throw new Error(`inbox_item ${inboxItemId} not found`);
  if (item.source !== "email" || !item.external_id) {
    throw new Error("Inbox item is not a Gmail message");
  }

  const auth = await getGoogleClient();
  const gmail = google.gmail({ version: "v1", auth });

  // Fetch the original message to grab Message-ID + threadId + From.
  const original = await gmail.users.messages.get({
    userId: "me",
    id: item.external_id,
    format: "metadata",
    metadataHeaders: ["Message-ID", "From", "Subject", "References", "To"],
  });

  const origMessageId = header(original.data.payload, "Message-ID");
  const origFrom = header(original.data.payload, "From") ?? item.sender;
  const origSubject =
    header(original.data.payload, "Subject") ?? item.subject ?? "(no subject)";
  const origReferences = header(original.data.payload, "References") ?? "";

  const threadId = original.data.threadId!;

  const replySubject = /^Re:/i.test(origSubject)
    ? origSubject
    : `Re: ${origSubject}`;

  const references = [origReferences, origMessageId].filter(Boolean).join(" ");

  const headers: string[] = [
    `To: ${origFrom}`,
    `Subject: ${rfc2047EncodeIfNeeded(replySubject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
  ];
  if (origMessageId) headers.push(`In-Reply-To: ${origMessageId}`);
  if (references) headers.push(`References: ${references}`);

  const raw = base64UrlEncode(`${headers.join("\r\n")}\r\n\r\n${body.trim()}\r\n`);

  const sent = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw, threadId },
  });

  // Mark inbox item as actioned + remember which reply we sent.
  await db
    .from("inbox_items")
    .update({
      status: "actioned",
      needs_action: false,
    })
    .eq("id", inboxItemId);

  await db.from("audit_log").insert({
    event_type: "gmail.reply_sent",
    entity_table: "inbox_items",
    entity_id: inboxItemId,
    payload: {
      message_id: sent.data.id,
      thread_id: sent.data.threadId,
      body_chars: body.length,
    },
  });

  return {
    messageId: sent.data.id ?? "",
    threadId: sent.data.threadId ?? threadId,
  };
}
