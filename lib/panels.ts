export const OPEN_TASK_STATUSES = [
  "not_started",
  "in_progress",
  "waiting",
  "blocked",
] as const;

export const OPEN_FOLLOWUP_STATUSES = [
  "open",
  "awaiting_response",
  "responded",
] as const;

export const OPEN_CONCERN_STATUSES = ["active", "escalated"] as const;

export const PRIORITY_BASE: Record<string, number> = {
  urgent: 100,
  high: 70,
  medium: 40,
  low: 20,
};

export type Severity = "urgent" | "warning" | "ok" | "info" | "muted";

export function severityForPriority(priority: string | null | undefined): Severity {
  switch (priority) {
    case "urgent":
      return "urgent";
    case "high":
      return "warning";
    case "medium":
      return "info";
    case "low":
      return "muted";
    default:
      return "muted";
  }
}

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.ceil((then - Date.now()) / (24 * 60 * 60 * 1000));
}

export function dueLabel(deadline: string | null | undefined): string | null {
  const d = daysUntil(deadline);
  if (d === null) return null;
  if (d < 0) return `Overdue ${Math.abs(d)}d`;
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  return `Due in ${d}d`;
}

export function formatUsd(n: number | null | undefined): string | null {
  if (n === null || n === undefined) return null;
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

export function ageDays(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000)));
}

/**
 * Operational Priority Queue score:
 *   base_priority + age_capped*2 + escalation*15 + urgency_score
 *
 * `escalation` is interpreted as priority='urgent' OR status='blocked'
 * (the two signals that something is jammed and needs the exec's attention).
 * `urgency_score` is 0 unless the source row is an inbox_item.
 */
export function operationalScore(input: {
  priority: string | null | undefined;
  createdAt: string | null | undefined;
  status: string | null | undefined;
  urgencyScore?: number | null;
}): number {
  const base = PRIORITY_BASE[input.priority ?? ""] ?? 0;
  const ageCapped = Math.min(ageDays(input.createdAt), 30);
  const escalation =
    input.priority === "urgent" || input.status === "blocked" ? 1 : 0;
  const urgency = input.urgencyScore ?? 0;
  return base + ageCapped * 2 + escalation * 15 + urgency;
}
