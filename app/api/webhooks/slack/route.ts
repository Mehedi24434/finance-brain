import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { processEvent, verifySignature } from "@/lib/slack";
import { triageInboxItem } from "@/lib/triage";

export const runtime = "nodejs";

type UrlVerification = { type: "url_verification"; challenge: string };
type EventCallback = {
  type: "event_callback";
  event: import("@/lib/slack").SlackMessageEvent;
};

export async function POST(request: Request) {
  const rawBody = await request.text();

  if (!verifySignature(rawBody, request.headers)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: UrlVerification | EventCallback;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.type === "url_verification") {
    return NextResponse.json({ challenge: payload.challenge });
  }

  if (payload.type !== "event_callback") {
    return new Response("ok", { status: 200 });
  }

  // Slack requires a 200 within 3s. Do the Supabase insert inline (fast),
  // then schedule the slow Claude triage via waitUntil.
  let result: Awaited<ReturnType<typeof processEvent>>;
  try {
    result = await processEvent(payload.event);
  } catch (err) {
    console.error("processEvent failed", err);
    return new Response("ok", { status: 200 });
  }

  if (result.inboxItemId) {
    waitUntil(
      triageInboxItem(result.inboxItemId).catch((err) => {
        console.error(
          "slack triageInboxItem failed",
          result.inboxItemId,
          err,
        );
      }),
    );
  }

  return new Response("ok", { status: 200 });
}
