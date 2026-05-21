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
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return "due today";
  if (d === 1) return "due tomorrow";
  return `due in ${d}d`;
}

/**
 * Age in days since a row was created/opened/last contacted.
 * Returns label like "3d open" or "12d aging" — different from dueLabel
 * which counts forward to a deadline.
 *   < 3 days → "{n}d open"
 *   >= 3 days → "{n}d aging"
 */
export function ageLabel(
  iso: string | null | undefined,
  opts: { agingThresholdDays?: number } = {},
): string | null {
  if (!iso) return null;
  const days = ageDays(iso);
  const threshold = opts.agingThresholdDays ?? 3;
  if (days < 1) return "today";
  return days >= threshold ? `${days}d aging` : `${days}d open`;
}

/**
 * Friendly timestamp formatter.
 *   today  → "Today 2:30pm"
 *   yesterday → "Yesterday 9:15am"
 *   tomorrow → "Tomorrow 8:00am"
 *   else → "Tue Jun 3"
 */
export function timeLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const dayDiff = Math.round(
    (target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  );

  const time = dt
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(" ", "")
    .toLowerCase();

  if (dayDiff === 0) return `Today ${time}`;
  if (dayDiff === -1) return `Yesterday ${time}`;
  if (dayDiff === 1) return `Tomorrow ${time}`;

  return dt.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a USD amount for display.
 * - Always uses thousands separators ("$185,000" not "$185000").
 * - Decimals only when the amount is small enough that cents matter
 *   (under $10,000). Above that, whole dollars.
 * - Negative values are wrapped in parens, finance convention.
 */
export function formatUsd(n: number | null | undefined): string | null {
  if (n === null || n === undefined || Number.isNaN(n)) return null;
  const abs = Math.abs(n);
  const decimals = abs < 10_000 ? 2 : 0;
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return n < 0 ? `($${formatted})` : `$${formatted}`;
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
