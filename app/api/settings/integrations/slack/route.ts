import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";

const putSchema = z.object({
  channels: z.array(z.string().min(1).max(100)).max(200),
});

async function requireUser() {
  const auth = await createServerSupabaseClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  return user;
}

export async function PUT(request: Request) {
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
  const parsed = putSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_SIGNING_SECRET) {
    return NextResponse.json(
      { error: "Slack env vars not configured on server" },
      { status: 400 },
    );
  }

  const db = createServiceRoleClient();
  const { data, error } = await db
    .from("integrations")
    .upsert(
      {
        service: "slack",
        status: "connected",
        config: { slack_channels: parsed.data.channels },
        error_message: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "service" },
    )
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await db.from("audit_log").insert({
    event_type: "integration.configured",
    entity_table: "integrations",
    entity_id: data.id,
    payload: {
      service: "slack",
      channels: parsed.data.channels,
      actor: user.email ?? user.id,
    },
  });

  return NextResponse.json({ integration: data });
}

export async function DELETE() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServiceRoleClient();
  const { data, error } = await db
    .from("integrations")
    .upsert(
      {
        service: "slack",
        status: "disconnected",
        config: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "service" },
    )
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await db.from("audit_log").insert({
    event_type: "integration.unlinked",
    entity_table: "integrations",
    entity_id: data.id,
    payload: { service: "slack", actor: user.email ?? user.id },
  });

  return NextResponse.json({ integration: data });
}
