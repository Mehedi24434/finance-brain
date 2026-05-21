import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { runSyncCron } from "@/lib/cron-jobs";

export const runtime = "nodejs";
// Gmail sync (10 messages, parallel triage) + Calendar sync ~15-25s.
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runSyncCron();
    // Inserts new inbox_items + meeting_notes — flush the relevant
    // route caches so the dashboard and inbox pick up fresh rows
    // without a manual reload.
    if (!result.skipped) {
      revalidatePath("/");
      revalidatePath("/inbox");
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync cron failed" },
      { status: 500 },
    );
  }
}

export const POST = GET;
