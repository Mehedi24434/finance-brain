import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { callClaude } from "@/lib/claude";
import { sendMessage } from "@/lib/telegram";

const PRIORITY_ENUM = ["low", "medium", "high", "urgent"] as const;
type PriorityEnum = (typeof PRIORITY_ENUM)[number];

const CATEGORY_ENUM = [
  "reporting",
  "forecasting",
  "budgeting",
  "close",
  "audit",
  "treasury",
  "tax",
  "fpa",
  "investor_relations",
  "board",
  "compliance",
  "ap_ar",
  "payroll",
  "m_and_a",
  "fundraising",
  "vendor",
  "personal",
  "other",
  "procurement",
  "capex",
  "inventory",
  "operations",
] as const;
type CategoryEnum = (typeof CATEGORY_ENUM)[number];

const CLASSIFICATIONS = ["approval", "urgent", "fyi", "request", "noise"] as const;
type Classification = (typeof CLASSIFICATIONS)[number];

type TriageOutput = {
  classification: Classification;
  urgency_score: number;
  finance_risk: boolean;
  suggested_response: string;
  extracted_tasks: Array<{
    title: string;
    category: CategoryEnum;
    priority: PriorityEnum;
    due_hint?: string | null;
  }>;
};

type MemoryOutput = {
  notes: Array<{
    memory_type: string;
    category: CategoryEnum;
    title: string;
    content: string;
    confidence: "low" | "medium" | "high";
    tags?: string[];
  }>;
};

function clampInt(value: unknown, lo: number, hi: number, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function asClassification(v: unknown): Classification {
  return CLASSIFICATIONS.includes(v as Classification)
    ? (v as Classification)
    : "fyi";
}

function asCategory(v: unknown): CategoryEnum {
  return CATEGORY_ENUM.includes(v as CategoryEnum)
    ? (v as CategoryEnum)
    : "other";
}

function asPriority(v: unknown): PriorityEnum {
  return PRIORITY_ENUM.includes(v as PriorityEnum)
    ? (v as PriorityEnum)
    : "medium";
}

export async function triageInboxItem(id: string): Promise<{
  inboxItem: unknown;
  taskIds: string[];
  reminderId: string | null;
  memoryNoteIds: string[];
}> {
  const db = createServiceRoleClient();

  const { data: item, error } = await db
    .from("inbox_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!item) throw new Error(`inbox_item ${id} not found`);

  // Prior context from the same sender (last 14 days).
  const fourteenDaysAgo = new Date(
    Date.now() - 14 * 24 * 60 * 60 * 1000,
  ).toISOString();
  let priorContext: Array<{
    subject: string | null;
    preview: string | null;
    received_at: string;
  }> = [];
  if (item.sender) {
    const { data: prior } = await db
      .from("inbox_items")
      .select("subject, preview, received_at")
      .neq("id", id)
      .eq("sender", item.sender)
      .gte("received_at", fourteenDaysAgo)
      .order("received_at", { ascending: false })
      .limit(3);
    priorContext = prior ?? [];
  }

  const body = item.body ?? item.preview ?? "";

  // 1. Claude triage call.
  const raw = await callClaude<Partial<TriageOutput>>({
    task: "triage",
    input: {
      sender: item.sender,
      subject: item.subject,
      source: item.source,
      received_at: item.received_at,
      body,
      recent_thread_context: priorContext,
    },
  });

  const triage: TriageOutput = {
    classification: asClassification(raw.classification),
    urgency_score: clampInt(raw.urgency_score, 0, 100, 50),
    finance_risk: Boolean(raw.finance_risk),
    suggested_response:
      typeof raw.suggested_response === "string" ? raw.suggested_response : "",
    extracted_tasks: Array.isArray(raw.extracted_tasks)
      ? raw.extracted_tasks
          .filter((t) => t && typeof t.title === "string" && t.title.trim())
          .slice(0, 8)
          .map((t) => ({
            title: String(t.title).trim().slice(0, 500),
            category: asCategory(t.category),
            priority: asPriority(t.priority),
            due_hint: typeof t.due_hint === "string" ? t.due_hint : null,
          }))
      : [],
  };

  // 2. Update the inbox_item with triage results.
  const { data: updatedItem } = await db
    .from("inbox_items")
    .update({
      classification: triage.classification,
      urgency_score: triage.urgency_score,
      finance_risk: triage.finance_risk,
      suggested_response: triage.suggested_response || null,
      status: "read",
    })
    .eq("id", id)
    .select()
    .single();

  // 3. Create extracted tasks.
  const taskIds: string[] = [];
  if (triage.extracted_tasks.length) {
    const { data: insertedTasks } = await db
      .from("tasks")
      .insert(
        triage.extracted_tasks.map((t) => ({
          title: t.title,
          category: t.category,
          priority: t.priority,
          status: "not_started",
          source: "email",
          source_ref: item.external_id ?? null,
        })),
      )
      .select("id");
    for (const row of insertedTasks ?? []) taskIds.push(row.id);

    // Link inbox_item to the first new task for the detail-page back-pointer.
    if (taskIds[0]) {
      await db
        .from("inbox_items")
        .update({ related_task_id: taskIds[0] })
        .eq("id", id);
    }
  }

  // 4. If urgent + finance_risk, schedule a 30-min telegram nudge AND
  //    push an immediate Telegram alert.
  let reminderId: string | null = null;
  if (triage.classification === "urgent" && triage.finance_risk) {
    const { data: reminder } = await db
      .from("reminders")
      .insert({
        title: `Urgent: ${item.subject ?? "(no subject)"}`,
        category: triage.extracted_tasks[0]?.category ?? null,
        priority: "urgent",
        status: "scheduled",
        remind_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        channel: "telegram",
        related_task_id: taskIds[0] ?? null,
      })
      .select("id")
      .single();
    reminderId = reminder?.id ?? null;

    try {
      await sendMessage(
        `Urgent finance email from ${item.sender ?? "(unknown sender)"}:\n` +
          `${item.subject ?? "(no subject)"}\n\n` +
          `Needs your eyes in the next 30 min.`,
      );
    } catch (err) {
      console.error("triage telegram alert failed", err);
    }
  }

  // 5. Audit log for the triage event.
  await db.from("audit_log").insert({
    event_type: "inbox.triaged",
    entity_table: "inbox_items",
    entity_id: id,
    payload: {
      classification: triage.classification,
      urgency_score: triage.urgency_score,
      finance_risk: triage.finance_risk,
      task_ids: taskIds,
      reminder_id: reminderId,
    },
  });

  // 6. Extract memory notes from the email body (high confidence only).
  const memoryNoteIds: string[] = [];
  if (body.trim().length > 40) {
    try {
      const memory = await callClaude<Partial<MemoryOutput>>({
        task: "extract_memory",
        input: {
          source: `inbox:${id}`,
          sender: item.sender,
          subject: item.subject,
          body,
        },
      });
      const candidates = (memory.notes ?? [])
        .filter((n) => n && n.confidence === "high" && typeof n.title === "string")
        .slice(0, 4);

      for (const n of candidates) {
        const title = String(n.title).trim();
        if (!title) continue;
        // Dedupe by case-insensitive title.
        const { data: existing } = await db
          .from("memory_notes")
          .select("id")
          .ilike("title", title)
          .limit(1)
          .maybeSingle();
        if (existing) continue;

        const { data: inserted } = await db
          .from("memory_notes")
          .insert({
            memory_type: n.memory_type ?? "context",
            category: asCategory(n.category),
            title,
            content: typeof n.content === "string" ? n.content : "",
            confidence: "high",
            source: `inbox:${id}`,
            tags: Array.isArray(n.tags) ? n.tags : null,
          })
          .select("id")
          .single();
        if (inserted) memoryNoteIds.push(inserted.id);
      }
    } catch (err) {
      // Memory extraction is best-effort, but log so we can see why it fails.
      console.error("extract_memory failed for inbox", id, err);
    }
  }

  return {
    inboxItem: updatedItem,
    taskIds,
    reminderId,
    memoryNoteIds,
  };
}
