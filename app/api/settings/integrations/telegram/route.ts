import { NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";

async function requireUser() {
  const auth = await createServerSupabaseClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  return user;
}

export async function POST() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const envUserId = process.env.TELEGRAM_USER_ID;
  if (!envUserId) {
    return NextResponse.json(
      { error: "TELEGRAM_USER_ID is not set on the server" },
      { status: 400 },
    );
  }
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json(
      { error: "TELEGRAM_BOT_TOKEN is not set on the server" },
      { status: 400 },
    );
  }

  const db = createServiceRoleClient();
  const { data: profile, error: readError } = await db
    .from("executive_profile")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json(
      { error: "executive_profile row not found" },
      { status: 404 },
    );
  }

  const { data, error } = await db
    .from("executive_profile")
    .update({ telegram_user_id: envUserId })
    .eq("id", profile.id)
    .select("telegram_user_id")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await db.from("audit_log").insert({
    event_type: "integration.linked",
    entity_table: "executive_profile",
    entity_id: profile.id,
    payload: { service: "telegram", actor: user.email ?? user.id },
  });

  return NextResponse.json({ telegram_user_id: data.telegram_user_id });
}

export async function DELETE() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServiceRoleClient();
  const { data: profile } = await db
    .from("executive_profile")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json(
      { error: "executive_profile row not found" },
      { status: 404 },
    );
  }

  const { error } = await db
    .from("executive_profile")
    .update({ telegram_user_id: null })
    .eq("id", profile.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await db.from("audit_log").insert({
    event_type: "integration.unlinked",
    entity_table: "executive_profile",
    entity_id: profile.id,
    payload: { service: "telegram", actor: user.email ?? user.id },
  });

  return NextResponse.json({ telegram_user_id: null });
}
