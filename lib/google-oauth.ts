import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { google } from "googleapis";
import { createServiceRoleClient } from "@/lib/supabase/server";

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.readonly",
];

const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

function stateSecret(): string {
  const v = process.env.GOOGLE_STATE_SECRET;
  if (!v) throw new Error("GOOGLE_STATE_SECRET is not set");
  return v;
}

export function signState(userId: string): string {
  const nonce = randomBytes(8).toString("hex");
  const ts = Date.now().toString();
  const payload = `${userId}.${nonce}.${ts}`;
  const sig = createHmac("sha256", stateSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export function verifyState(
  raw: string,
): { ok: true; userId: string } | { ok: false; reason: string } {
  let decoded: string;
  try {
    decoded = Buffer.from(raw, "base64url").toString("utf8");
  } catch {
    return { ok: false, reason: "invalid encoding" };
  }
  const parts = decoded.split(".");
  if (parts.length !== 4) return { ok: false, reason: "malformed" };
  const [userId, nonce, ts, sig] = parts;
  const payload = `${userId}.${nonce}.${ts}`;
  const expected = createHmac("sha256", stateSecret()).update(payload).digest("hex");
  if (expected.length !== sig.length) return { ok: false, reason: "bad sig" };
  try {
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) {
      return { ok: false, reason: "bad sig" };
    }
  } catch {
    return { ok: false, reason: "bad sig" };
  }
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return { ok: false, reason: "bad timestamp" };
  if (Math.abs(Date.now() - tsNum) > STATE_MAX_AGE_MS) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, userId };
}

function newOauthClient(): OAuth2Client {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  const redirect = process.env.GOOGLE_REDIRECT_URI;
  if (!id || !secret || !redirect) {
    throw new Error(
      "Google OAuth env vars (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI) not set",
    );
  }
  return new google.auth.OAuth2(id, secret, redirect);
}

export function consentUrl(state: string): string {
  const client = newOauthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_SCOPES,
    include_granted_scopes: true,
    state,
  });
}

export type GoogleConfig = {
  refresh_token?: string | null;
  access_token?: string | null;
  expiry_date?: number | null;
  scope?: string | null;
  email?: string | null;
  gmail_query?: string | null;
};

export async function loadGoogleConfig(): Promise<GoogleConfig | null> {
  const db = createServiceRoleClient();
  const { data } = await db
    .from("integrations")
    .select("config")
    .eq("service", "google")
    .maybeSingle();
  return (data?.config as GoogleConfig | null) ?? null;
}

async function saveGoogleConfig(
  patch: GoogleConfig,
  options: { connected?: boolean } = {},
): Promise<void> {
  const db = createServiceRoleClient();
  const current = (await loadGoogleConfig()) ?? {};
  const merged: GoogleConfig = { ...current, ...patch };
  const update: Record<string, unknown> = {
    service: "google",
    config: merged,
    updated_at: new Date().toISOString(),
  };
  if (options.connected !== undefined) {
    update.status = options.connected ? "connected" : "disconnected";
    if (options.connected) update.error_message = null;
  }
  const { error } = await db
    .from("integrations")
    .upsert(update, { onConflict: "service" });
  if (error) throw new Error(error.message);
}

export async function setGmailQuery(query: string | null): Promise<void> {
  await saveGoogleConfig({ gmail_query: query });
}

/**
 * Exchanges an auth code for tokens and persists them. Returns the
 * connected account's email (best-effort, from id_token if present).
 */
export async function exchangeCodeAndStore(code: string): Promise<{
  email: string | null;
}> {
  const client = newOauthClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      "Google did not return a refresh_token. Revoke the app from your Google account and retry the consent flow.",
    );
  }

  let email: string | null = null;
  if (tokens.id_token) {
    try {
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      email = ticket.getPayload()?.email ?? null;
    } catch {
      // best-effort
    }
  }

  await saveGoogleConfig(
    {
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token ?? null,
      expiry_date: tokens.expiry_date ?? null,
      scope: tokens.scope ?? null,
      email,
    },
    { connected: true },
  );

  return { email };
}

export async function disconnectGoogle(): Promise<void> {
  await saveGoogleConfig({
    refresh_token: null,
    access_token: null,
    expiry_date: null,
    scope: null,
    email: null,
  }, { connected: false });
}

/**
 * Returns a ready-to-use OAuth2 client with the saved refresh token.
 * Throws if Google is not connected.
 */
export async function getGoogleClient(): Promise<OAuth2Client> {
  const config = await loadGoogleConfig();
  if (!config?.refresh_token) {
    throw new Error("Google is not connected");
  }
  const client = newOauthClient();
  client.setCredentials({
    refresh_token: config.refresh_token,
    access_token: config.access_token ?? undefined,
    expiry_date: config.expiry_date ?? undefined,
  });

  // Persist any refreshed access tokens so subsequent runs don't keep
  // hitting Google for new ones.
  client.on("tokens", (tokens) => {
    void saveGoogleConfig({
      access_token: tokens.access_token ?? null,
      expiry_date: tokens.expiry_date ?? null,
      ...(tokens.refresh_token
        ? { refresh_token: tokens.refresh_token }
        : null),
    }).catch((err) => {
      console.error("persist refreshed google tokens failed", err);
    });
  });

  return client;
}

export async function updateLastSync(): Promise<void> {
  const db = createServiceRoleClient();
  await db
    .from("integrations")
    .upsert(
      {
        service: "google",
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "service" },
    );
}
