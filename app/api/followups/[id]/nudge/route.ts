import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await createServerSupabaseClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: rawId } = await params;
  const parsed = z.string().uuid().safeParse(rawId);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid followup id" }, { status: 400 });
  }
  const id = parsed.data;

  const now = new Date().toISOString();
  const db = createServiceRoleClient();
  const { data, error } = await db
    .from("followups")
    .update({
      status: "awaiting_response",
      last_contacted: now,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await db.from("audit_log").insert({
    event_type: "followup.nudged",
    entity_table: "followups",
    entity_id: id,
    payload: { actor: user.email ?? user.id, last_contacted: now },
  });

  return NextResponse.json({ followup: data });
}
