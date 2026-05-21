import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";

const snoozeSchema = z.object({
  until: z.string().datetime().optional(),
});

export async function POST(
  request: Request,
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
  const idParsed = z.string().uuid().safeParse(rawId);
  if (!idParsed.success) {
    return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
  }
  const id = idParsed.data;

  let payload: unknown = {};
  try {
    payload = await request.json();
  } catch {
    // Empty body is fine — default to +24h.
  }
  const parsed = snoozeSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid snooze payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const until =
    parsed.data.until ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const db = createServiceRoleClient();
  const { data: task, error } = await db
    .from("tasks")
    .update({ status: "waiting", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, title, category, priority")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: reminder, error: reminderError } = await db
    .from("reminders")
    .insert({
      title: `Snoozed: ${task.title}`,
      category: task.category,
      priority: task.priority,
      status: "scheduled",
      remind_at: until,
      related_task_id: id,
      channel: "telegram",
    })
    .select()
    .single();
  if (reminderError) {
    return NextResponse.json({ error: reminderError.message }, { status: 500 });
  }

  await db.from("audit_log").insert({
    event_type: "task.snoozed",
    entity_table: "tasks",
    entity_id: id,
    payload: { actor: user.email ?? user.id, remind_at: until, reminder_id: reminder.id },
  });

  return NextResponse.json({ task, reminder });
}
