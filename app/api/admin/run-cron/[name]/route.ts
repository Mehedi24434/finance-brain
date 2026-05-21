import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  runBriefingCron,
  runRemindersCron,
  runSyncCron,
} from "@/lib/cron-jobs";

// Dispatches to the same crons — sync is the longest at ~25s.
export const maxDuration = 60;

const HANDLERS = {
  briefing: runBriefingCron,
  reminders: runRemindersCron,
  sync: runSyncCron,
} as const;

type CronName = keyof typeof HANDLERS;

function isCronName(value: string): value is CronName {
  return value in HANDLERS;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const auth = await createServerSupabaseClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name } = await params;
  if (!isCronName(name)) {
    return NextResponse.json(
      { error: `Unknown cron job: ${name}` },
      { status: 400 },
    );
  }

  try {
    const result = await HANDLERS[name]();
    // Briefing inserts/flips delivered; reminders flips status; sync
    // inserts inbox + meetings. Each of these mutates data shown on
    // the dashboard or inbox, so invalidate both segments.
    revalidatePath("/");
    revalidatePath("/inbox");
    return NextResponse.json({ name, result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : `${name} cron failed` },
      { status: 500 },
    );
  }
}
