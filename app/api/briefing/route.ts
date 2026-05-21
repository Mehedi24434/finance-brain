import { NextResponse } from "next/server";
import { format } from "date-fns";
import { z } from "zod";

// Sonnet briefing generation runs ~6-10s; bump past Vercel's 10s default.
export const maxDuration = 60;
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { generateBriefing } from "@/lib/briefing-service";
import { sendMessage } from "@/lib/telegram";

const bodySchema = z
  .object({
    deliver: z.boolean().optional(),
  })
  .partial();

export async function GET() {
  const auth = await createServerSupabaseClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServiceRoleClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const { data } = await db
    .from("briefings")
    .select("*")
    .eq("briefing_date", today)
    .maybeSingle();
  return NextResponse.json({ briefing: data });
}

export async function POST(request: Request) {
  const auth = await createServerSupabaseClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed: { deliver?: boolean } = {};
  try {
    const raw = await request.json();
    const result = bodySchema.safeParse(raw);
    if (result.success) parsed = result.data;
  } catch {
    // Empty body is fine.
  }

  let briefing;
  try {
    briefing = await generateBriefing();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Briefing generation failed" },
      { status: 502 },
    );
  }

  if (parsed.deliver) {
    try {
      await sendMessage(
        `*Briefing — ${briefing.briefing_date}*\n\n${briefing.executive_summary}`,
      );
      const db = createServiceRoleClient();
      await db
        .from("briefings")
        .update({ delivered: true })
        .eq("id", briefing.id);
      briefing.delivered = true;
    } catch (err) {
      console.error("briefing telegram delivery failed", err);
    }
  }

  return NextResponse.json({ briefing });
}
