import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";

const CATEGORIES = [
  "reporting",
  "forecasting",
  "budgeting",
  "close",
  "audit",
  "treasury",
  "tax",
  "fpa",
  "investor_relations",
  "board",
  "compliance",
  "ap_ar",
  "payroll",
  "m_and_a",
  "fundraising",
  "vendor",
  "personal",
  "other",
  "procurement",
  "capex",
  "inventory",
  "operations",
] as const;
const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

const createSchema = z.object({
  subject: z.string().min(1).max(500),
  notes: z.string().max(5000).nullish(),
  contact_name: z.string().max(200).nullish(),
  contact_email: z.string().email().nullish(),
  category: z.enum(CATEGORIES).nullish(),
  priority: z.enum(PRIORITIES).nullish(),
  due_date: z.string().datetime().nullish(),
  related_task_id: z.string().uuid().nullish(),
  tags: z.array(z.string()).nullish(),
});

export async function POST(request: Request) {
  const auth = await createServerSupabaseClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid followup payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const db = createServiceRoleClient();
  const { data, error } = await db
    .from("followups")
    .insert({
      subject: parsed.data.subject,
      notes: parsed.data.notes ?? null,
      contact_name: parsed.data.contact_name ?? null,
      contact_email: parsed.data.contact_email ?? null,
      // followups.category is NOT NULL DEFAULT 'other'. Passing null
      // overrides the column default and fails 23502.
      category: parsed.data.category ?? "other",
      priority: parsed.data.priority ?? "medium",
      status: "open",
      due_date: parsed.data.due_date ?? null,
      related_task_id: parsed.data.related_task_id ?? null,
      tags: parsed.data.tags ?? null,
    })
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await db.from("audit_log").insert({
    event_type: "followup.created",
    entity_table: "followups",
    entity_id: data.id,
    payload: { actor: user.email ?? user.id, related_task_id: parsed.data.related_task_id ?? null },
  });

  // ProcurementFollowupsPanel + briefing aging counters pull from
  // followups. Also flush the task detail page if this followup links
  // to one (the detail page lists linked followups).
  revalidatePath("/");
  if (parsed.data.related_task_id) {
    revalidatePath(`/tasks/${parsed.data.related_task_id}`);
  }

  return NextResponse.json({ followup: data }, { status: 201 });
}
