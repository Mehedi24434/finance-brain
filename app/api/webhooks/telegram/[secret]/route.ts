import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { handleUpdate, type TelegramUpdate } from "@/lib/telegram";
import { isAuthorizedTelegramUser } from "@/lib/telegram-auth";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ secret: string }> },
) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) {
    console.error("TELEGRAM_WEBHOOK_SECRET not configured");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  const { secret } = await params;
  if (secret !== expected) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Silently drop drive-by senders so we don't reveal that we received them.
  const msg = update.message ?? update.edited_message;
  if (!msg || !isAuthorizedTelegramUser(msg.from?.id)) {
    return new Response("ok", { status: 200 });
  }

  // Dispatch the work asynchronously. waitUntil keeps the function alive
  // up to the platform's serverless ceiling (~300s on Vercel) while we
  // return 200 to Telegram immediately so it doesn't retry.
  waitUntil(
    handleUpdate(update).catch((err) => {
      console.error("handleUpdate failed", err);
    }),
  );

  return new Response("ok", { status: 200 });
}
