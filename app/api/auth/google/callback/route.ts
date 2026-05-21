import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { exchangeCodeAndStore, verifyState } from "@/lib/google-oauth";

function settingsRedirect(request: Request, params: Record<string, string>) {
  const base = new URL(request.url);
  base.pathname = "/settings";
  base.search = "";
  for (const [k, v] of Object.entries(params)) base.searchParams.set(k, v);
  return NextResponse.redirect(base);
}

export async function GET(request: Request) {
  const auth = await createServerSupabaseClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    return settingsRedirect(request, { google_error: errorParam });
  }
  if (!code || !state) {
    return settingsRedirect(request, { google_error: "missing_code" });
  }

  const verified = verifyState(state);
  if (!verified.ok) {
    return settingsRedirect(request, { google_error: `state:${verified.reason}` });
  }
  if (verified.userId !== user.id) {
    return settingsRedirect(request, { google_error: "state:mismatch" });
  }

  try {
    await exchangeCodeAndStore(code);
  } catch (err) {
    return settingsRedirect(request, {
      google_error: encodeURIComponent(
        err instanceof Error ? err.message : "exchange_failed",
      ),
    });
  }

  return settingsRedirect(request, { google: "connected" });
}
