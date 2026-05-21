import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { disconnectGoogle, setGmailQuery } from "@/lib/google-oauth";

async function requireUser() {
  const auth = await createServerSupabaseClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  return user;
}

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = createServiceRoleClient();
  const { data } = await db
    .from("integrations")
    .select("status, config, last_sync_at, error_message, updated_at")
    .eq("service", "google")
    .maybeSingle();

  const config = (data?.config ?? {}) as {
    refresh_token?: string | null;
    email?: string | null;
    gmail_query?: string | null;
  };

  return NextResponse.json({
    status: data?.status ?? "disconnected",
    connected: Boolean(config.refresh_token),
    email: config.email ?? null,
    gmail_query: config.gmail_query ?? null,
    last_sync_at: data?.last_sync_at ?? null,
    error_message: data?.error_message ?? null,
  });
}

const patchSchema = z.object({
  gmail_query: z.string().max(500).nullable().optional(),
});

export async function PATCH(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  if (parsed.data.gmail_query !== undefined) {
    await setGmailQuery(parsed.data.gmail_query?.trim() || null);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await disconnectGoogle();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Disconnect failed" },
      { status: 500 },
    );
  }
}
