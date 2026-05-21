import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generatePrebrief } from "@/lib/calendar";

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

  const { id } = await params;
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid meeting id" }, { status: 400 });
  }

  try {
    const result = await generatePrebrief(parsed.data);
    return NextResponse.json({
      pre_brief: result.preBrief,
      key_amounts: result.keyAmounts,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Pre-brief failed" },
      { status: 502 },
    );
  }
}
