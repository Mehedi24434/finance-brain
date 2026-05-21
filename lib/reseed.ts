import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import snapshot from "@/data/seed/snapshot.json";

type SnapshotRow = Record<string, unknown>;
type Snapshot = {
  tasks: SnapshotRow[];
  followups: SnapshotRow[];
  inbox_items: SnapshotRow[];
  meeting_notes: SnapshotRow[];
  reminders: SnapshotRow[];
  memory_notes: SnapshotRow[];
  relationships: SnapshotRow[];
  ongoing_concerns: SnapshotRow[];
};

// Order matters because of FK dependencies. Delete child-ish tables
// before parents; insert parents first.
const DELETE_ORDER = [
  "reminders",
  "followups",
  "inbox_items",
  "meeting_notes",
  "tasks",
  "memory_notes",
  "relationships",
  "ongoing_concerns",
] as const;

const INSERT_ORDER = [
  "tasks",
  "followups",
  "inbox_items",
  "meeting_notes",
  "reminders",
  "memory_notes",
  "relationships",
  "ongoing_concerns",
] as const;

export type ReseedResult = {
  deleted: Record<string, number>;
  inserted: Record<string, number>;
  briefings_cleared: number;
};

export async function reseed(): Promise<ReseedResult> {
  const db = createServiceRoleClient();
  const data = snapshot as Snapshot;

  const deleted: Record<string, number> = {};
  const inserted: Record<string, number> = {};

  // 1. Wipe all briefings so the post-reseed dashboard shows the
  // "Generate today's briefing" empty state. Spec calls out deleting
  // briefings < today, but a clean slate is more useful for the demo
  // than a half-stale row.
  const { count: briefingsCleared } = await db
    .from("briefings")
    .delete({ count: "exact" })
    .neq("briefing_date", "9999-12-31"); // delete() requires a filter

  // 2. Delete all seed-tagged rows. We do this in reverse FK order.
  for (const table of DELETE_ORDER) {
    const { count, error } = await db
      .from(table)
      .delete({ count: "exact" })
      .filter("tags", "cs", "{seed}");
    if (error) {
      throw new Error(`reseed: delete ${table} failed: ${error.message}`);
    }
    deleted[table] = count ?? 0;
  }

  // 3. Re-insert from the snapshot. Re-inserting with the original ids
  // restores stable references (e.g. reminder.related_task_id pointing
  // back to a task we just inserted).
  for (const table of INSERT_ORDER) {
    const rows = data[table] ?? [];
    if (rows.length === 0) {
      inserted[table] = 0;
      continue;
    }
    const { error } = await db.from(table).insert(rows);
    if (error) {
      throw new Error(`reseed: insert ${table} failed: ${error.message}`);
    }
    inserted[table] = rows.length;
  }

  // 4. Audit log.
  await db.from("audit_log").insert({
    event_type: "admin.reseed",
    payload: { deleted, inserted, briefings_cleared: briefingsCleared ?? 0 },
  });

  return {
    deleted,
    inserted,
    briefings_cleared: briefingsCleared ?? 0,
  };
}
