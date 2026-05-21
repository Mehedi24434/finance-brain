import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";

const idSchema = z.string().uuid();

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
  const parsed = idSchema.safeParse(rawId);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
  }
  const id = parsed.data;

  const db = createServiceRoleClient();
  const completedAt = new Date().toISOString();
  const { data, error } = await db
    .from("tasks")
    .update({
      status: "completed",
      completed_at: completedAt,
      updated_at: completedAt,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await db.from("audit_log").insert({
    event_type: "task.resolved",
    entity_table: "tasks",
    entity_id: id,
    payload: { actor: user.email ?? user.id, completed_at: completedAt },
  });

  return NextResponse.json({ task: data });
}
