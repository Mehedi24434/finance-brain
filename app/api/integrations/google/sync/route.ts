import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { syncRecent } from "@/lib/gmail";
import { syncUpcoming } from "@/lib/calendar";
import { updateLastSync } from "@/lib/google-oauth";

export async function POST() {
  const auth = await createServerSupabaseClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [gmail, calendar] = await Promise.allSettled([
      syncRecent(),
      syncUpcoming(),
    ]);
    await updateLastSync();

    // The sync was triggered from /settings. router.refresh() on the client
    // only invalidates the current route — without these the dashboard /
    // and /inbox keep serving their pre-sync Router Cache payload until
    // a hard reload.
    revalidatePath("/");
    revalidatePath("/inbox");

    return NextResponse.json({
      gmail:
        gmail.status === "fulfilled"
          ? gmail.value
          : { error: gmail.reason instanceof Error ? gmail.reason.message : "failed" },
      calendar:
        calendar.status === "fulfilled"
          ? calendar.value
          : {
              error:
                calendar.reason instanceof Error
                  ? calendar.reason.message
                  : "failed",
            },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 502 },
    );
  }
}
