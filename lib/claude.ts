import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { PROMPTS, type PromptTask } from "@/lib/prompts";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });

type ContextBundle = {
  text: string;
  memoryNotes: Array<{ id: string; reference_count: number | null }>;
};

async function loadPersistentContext(): Promise<ContextBundle> {
  const db = createServiceRoleClient();

  const [
    profileRes,
    notesRes,
    peopleRes,
    concernsRes,
    workflowsRes,
    preferencesRes,
  ] = await Promise.all([
    db
      .from("executive_profile")
      .select(
        "full_name, role, company, industry, company_size, location, timezone, reports_to, direct_reports, company_context, responsibilities, pain_points, operational_priorities, bio",
      )
      .limit(1)
      .maybeSingle(),
    db
      .from("memory_notes")
      .select(
        "id, memory_type, category, title, content, confidence, tags, reference_count, last_referenced",
      )
      .order("last_referenced", { ascending: false, nullsFirst: false })
      .limit(15),
    db
      .from("relationships")
      .select(
        "name, role, organization, relationship, importance, preferred_channel, notes",
      )
      .in("importance", ["high", "urgent"])
      .eq("active", true)
      .order("name"),
    db
      .from("ongoing_concerns")
      .select(
        "title, status, financial_impact_usd, stakeholders, next_review, category",
      )
      .in("status", ["monitoring", "active", "escalated"]),
    db
      .from("recurring_workflows")
      .select("name, cadence, owner, next_occurrence, schedule_detail")
      .eq("active", true),
    db
      .from("preferences")
      .select("preference_key, value, category")
      .eq("active", true),
  ]);

  const profile = profileRes.data;
  const notes = notesRes.data ?? [];
  const people = peopleRes.data ?? [];
  const concerns = concernsRes.data ?? [];
  const workflows = workflowsRes.data ?? [];
  const preferences = preferencesRes.data ?? [];

  const sections: string[] = [];

  if (profile) {
    sections.push(
      [
        "## Executive profile",
        `Name: ${profile.full_name}`,
        `Role: ${profile.role} at ${profile.company} (${profile.industry}, ${profile.company_size})`,
        `Location: ${profile.location} · Timezone: ${profile.timezone}`,
        profile.reports_to ? `Reports to: ${profile.reports_to}` : null,
        profile.direct_reports?.length
          ? `Direct reports: ${(profile.direct_reports as unknown as string[]).join(", ")}`
          : null,
        profile.company_context ? `Context: ${profile.company_context}` : null,
        profile.responsibilities?.length
          ? `Responsibilities: ${(profile.responsibilities as string[]).join("; ")}`
          : null,
        profile.pain_points?.length
          ? `Pain points: ${(profile.pain_points as string[]).join("; ")}`
          : null,
        profile.operational_priorities?.length
          ? `Operational priorities: ${(profile.operational_priorities as string[]).join("; ")}`
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  if (people.length) {
    const lines = people.map(
      (p) =>
        `- ${p.name} — ${p.role ?? "?"}${p.organization ? `, ${p.organization}` : ""} (${p.relationship}, ${p.importance})${p.notes ? ` · ${p.notes}` : ""}`,
    );
    sections.push(`## Key relationships\n${lines.join("\n")}`);
  }

  if (concerns.length) {
    const lines = concerns.map(
      (c) =>
        `- ${c.title} [${c.status}]${c.financial_impact_usd ? ` · $${Number(c.financial_impact_usd).toLocaleString()}` : ""}${c.stakeholders?.length ? ` · ${(c.stakeholders as string[]).join(", ")}` : ""}`,
    );
    sections.push(`## Ongoing concerns\n${lines.join("\n")}`);
  }

  if (workflows.length) {
    const lines = workflows.map(
      (w) =>
        `- ${w.name} (${w.cadence}${w.owner ? `, owner: ${w.owner}` : ""})${w.schedule_detail ? ` — ${w.schedule_detail}` : ""}`,
    );
    sections.push(`## Recurring workflows\n${lines.join("\n")}`);
  }

  if (preferences.length) {
    const lines = preferences.map(
      (p) => `- ${p.preference_key}: ${p.value}`,
    );
    sections.push(`## Preferences\n${lines.join("\n")}`);
  }

  if (notes.length) {
    const lines = notes.map(
      (n) =>
        `- [${n.memory_type}/${n.category}] ${n.title} (${n.confidence}): ${n.content}`,
    );
    sections.push(`## Working memory (top 15 by recency)\n${lines.join("\n")}`);
  }

  const text = sections.length
    ? `# Persistent context about Luke's operations\n\n${sections.join("\n\n")}`
    : "# Persistent context about Luke's operations\n\n(empty)";

  return {
    text,
    memoryNotes: notes.map((n) => ({
      id: n.id,
      reference_count: n.reference_count,
    })),
  };
}

function extractText(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

function stripJsonFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

// Find the outermost { ... } block in the response. Handles models that
// add a sentence of preamble before the JSON.
function extractJsonBlock(text: string): string {
  const cleaned = stripJsonFences(text);
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) return cleaned;
  return cleaned.slice(first, last + 1);
}

function tryParse<T>(raw: string): T | null {
  try {
    return JSON.parse(extractJsonBlock(raw)) as T;
  } catch {
    return null;
  }
}

export async function callClaude<T = unknown>({
  task,
  input,
}: {
  task: PromptTask;
  input: unknown;
}): Promise<T> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const start = Date.now();
  const config = PROMPTS[task];
  const context = await loadPersistentContext();

  const system: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: context.text,
      cache_control: { type: "ephemeral" },
    },
    {
      type: "text",
      text: config.systemPrompt,
    },
  ];

  const userPayload =
    typeof input === "string" ? input : JSON.stringify(input, null, 2);

  const baseMessages: Anthropic.MessageParam[] = [
    { role: "user", content: userPayload },
  ];

  let response = await anthropic.messages.create({
    model: config.model,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    system,
    messages: baseMessages,
  });

  let text = extractText(response);
  let parsed = tryParse<T>(text);

  if (parsed === null) {
    const retry = await anthropic.messages.create({
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: 0,
      system,
      messages: [
        ...baseMessages,
        { role: "assistant", content: text },
        {
          role: "user",
          content:
            "JSON ONLY. Return the same content as a valid JSON object — no markdown fences, no commentary, no leading or trailing text.",
        },
      ],
    });
    response = retry;
    text = extractText(retry);
    parsed = tryParse<T>(text);
    if (parsed === null) {
      throw new Error(
        `Claude returned non-JSON output for task=${task} after one retry`,
      );
    }
  }

  const latencyMs = Date.now() - start;

  const db = createServiceRoleClient();

  // Memory ref-count update (non-blocking from the caller's POV — fire & await,
  // but we're already past the slow Claude calls).
  if (context.memoryNotes.length) {
    const now = new Date().toISOString();
    await db.from("memory_notes").upsert(
      context.memoryNotes.map((n) => ({
        id: n.id,
        last_referenced: now,
        reference_count: (n.reference_count ?? 0) + 1,
      })),
      { onConflict: "id" },
    );
  }

  await db.from("audit_log").insert({
    event_type: "claude_call",
    payload: {
      task,
      model: config.model,
      tokens_in:
        (response.usage?.input_tokens ?? 0) +
        (response.usage?.cache_read_input_tokens ?? 0),
      tokens_out: response.usage?.output_tokens ?? 0,
      cache_read: response.usage?.cache_read_input_tokens ?? 0,
      cache_creation: response.usage?.cache_creation_input_tokens ?? 0,
      latency_ms: latencyMs,
    },
  });

  return parsed;
}
