import { NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { triageInboxItem } from "@/lib/triage";

const BATCH_LIMIT = 10;

export async function POST() {
  const auth = await createServerSupabaseClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServiceRoleClient();
  const { data: untriaged, error } = await db
    .from("inbox_items")
    .select("id")
    .eq("status", "unread")
    .is("classification", null)
    .order("received_at", { ascending: false })
    .limit(BATCH_LIMIT);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = (untriaged ?? []).map((r) => r.id);
  if (!ids.length) {
    return NextResponse.json({ triaged: 0, failed: 0 });
  }

  const results = await Promise.allSettled(ids.map((id) => triageInboxItem(id)));

  const triaged = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - triaged;

  await db.from("audit_log").insert({
    event_type: "inbox.triage_all",
    payload: { actor: user.email ?? user.id, triaged, failed, attempted: ids.length },
  });

  return NextResponse.json({ triaged, failed, attempted: ids.length });
}
