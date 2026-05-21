import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { runBriefingCron } from "@/lib/cron-jobs";

export const runtime = "nodejs";
// Briefing generation + Telegram delivery ~10s. Pad to 60.
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runBriefingCron();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Briefing cron failed" },
      { status: 500 },
    );
  }
}

export const POST = GET;
