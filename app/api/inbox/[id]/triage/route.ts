import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { triageInboxItem } from "@/lib/triage";

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
    return NextResponse.json({ error: "Invalid inbox id" }, { status: 400 });
  }

  try {
    const result = await triageInboxItem(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Triage failed" },
      { status: 502 },
    );
  }
}
