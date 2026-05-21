import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { consentUrl, signState } from "@/lib/google-oauth";

export async function GET() {
  const auth = await createServerSupabaseClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const state = signState(user.id);
    const url = consentUrl(state);
    return NextResponse.redirect(url);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to start OAuth" },
      { status: 500 },
    );
  }
}
