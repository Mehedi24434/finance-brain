import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

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
const STATUSES = [
  "not_started",
  "in_progress",
  "waiting",
  "blocked",
  "completed",
  "cancelled",
] as const;

const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).nullish(),
  category: z.enum(CATEGORIES).nullish(),
  priority: z.enum(PRIORITIES).nullish(),
  status: z.enum(STATUSES).nullish(),
  deadline: z.string().datetime().nullish(),
  assigned_to: z.string().max(200).nullish(),
  tags: z.array(z.string()).nullish(),
  amount_usd: z.number().nullish(),
  source: z.string().max(50).nullish(),
  source_ref: z.string().max(500).nullish(),
});

export async function GET() {
  const auth = await createServerSupabaseClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServiceRoleClient();
  const { data, error } = await db
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ tasks: data ?? [] });
}

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

  const parsed = createTaskSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid task payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const db = createServiceRoleClient();
  const { data, error } = await db
    .from("tasks")
    .insert({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      // tasks.category is NOT NULL with default 'other'. Passing null
      // overrides the column default, so we always supply a value.
      // 'operations' is the right fallback for Luke's quick-captures —
      // voice notes, manual jots — they're almost always operational.
      category: parsed.data.category ?? "operations",
      priority: parsed.data.priority ?? "medium",
      status: parsed.data.status ?? "not_started",
      deadline: parsed.data.deadline ?? null,
      assigned_to: parsed.data.assigned_to ?? null,
      tags: parsed.data.tags ?? null,
      amount_usd: parsed.data.amount_usd ?? null,
      source: parsed.data.source ?? "manual",
      source_ref: parsed.data.source_ref ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Invalidate any route that renders tasks server-side. router.refresh()
  // on the client only flushes the page the user is currently on; if
  // they captured from the topbar on /settings and then navigate to /
  // the dashboard would otherwise serve a stale RSC payload.
  revalidatePath("/");
  revalidatePath("/tasks");

  return NextResponse.json({ task: data }, { status: 201 });
}
