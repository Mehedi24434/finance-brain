/**
 * Registers the production webhook URL with Telegram.
 *
 *   pnpm exec tsx scripts/register-telegram-webhook.ts
 *
 * Requires the following env vars (loaded from .env.local):
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_WEBHOOK_SECRET
 *   NEXT_PUBLIC_APP_URL    — e.g. https://finance-brain.vercel.app
 *
 * Pass --delete to remove the webhook instead.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadDotenv() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^"|"$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadDotenv();

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const remove = process.argv.includes("--delete");

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set");
  }
  if (!remove) {
    if (!secret) throw new Error("TELEGRAM_WEBHOOK_SECRET is not set");
    if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL is not set");
    if (!/^https:\/\//.test(appUrl)) {
      throw new Error(
        `NEXT_PUBLIC_APP_URL must be an https:// URL. Got: ${appUrl}`,
      );
    }
  }

  const base = `https://api.telegram.org/bot${token}`;

  if (remove) {
    const res = await fetch(`${base}/deleteWebhook`, { method: "POST" });
    const body = await res.json();
    if (!res.ok || !body.ok) {
      throw new Error(`deleteWebhook failed: ${JSON.stringify(body)}`);
    }
    console.log("Webhook deleted.");
    return;
  }

  const webhookUrl = `${appUrl!.replace(/\/$/, "")}/api/webhooks/telegram/${secret}`;
  const res = await fetch(`${base}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ["message", "edited_message"],
      drop_pending_updates: true,
    }),
  });
  const body = await res.json();
  if (!res.ok || !body.ok) {
    throw new Error(`setWebhook failed: ${JSON.stringify(body)}`);
  }
  console.log(`Webhook registered: ${webhookUrl}`);

  const info = await (await fetch(`${base}/getWebhookInfo`)).json();
  console.log("getWebhookInfo:", JSON.stringify(info.result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
