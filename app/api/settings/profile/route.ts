import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

const profileSchema = z.object({
  full_name: z.string().max(200).nullish(),
  role: z.string().max(200).nullish(),
  company: z.string().max(200).nullish(),
  industry: z.string().max(200).nullish(),
  timezone: z.string().max(100).nullish(),
  briefing_time: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Expected HH:MM")
    .nullish(),
  telegram_user_id: z.string().max(100).nullish(),
});

export async function PATCH(request: Request) {
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

  const parsed = profileSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid profile payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const db = createServiceRoleClient();
  const { data: existing, error: readError } = await db
    .from("executive_profile")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json(
      { error: "executive_profile row not found" },
      { status: 404 },
    );
  }

  const { data, error } = await db
    .from("executive_profile")
    .update(parsed.data)
    .eq("id", existing.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ profile: data });
}
