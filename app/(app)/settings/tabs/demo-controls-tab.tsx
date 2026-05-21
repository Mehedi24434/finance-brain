"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

type Control = {
  key: string;
  label: string;
  note: string;
  endpoint: string;
  method?: "POST";
  disabled?: boolean;
  disabledNote?: string;
  confirm?: string;
};

const CONTROLS: Control[] = [
  {
    key: "briefing",
    label: "Run briefing cron now",
    note: "Generates today's briefing (if missing) and pushes it to Telegram.",
    endpoint: "/api/admin/run-cron/briefing",
  },
  {
    key: "reminders",
    label: "Run reminders cron now",
    note: "Fires every scheduled reminder whose remind_at is in the past.",
    endpoint: "/api/admin/run-cron/reminders",
  },
  {
    key: "sync",
    label: "Run Gmail + Calendar sync now",
    note: "Pulls up to 10 new emails (auto-triaged) and the next 7 days of meetings.",
    endpoint: "/api/admin/run-cron/sync",
  },
  {
    key: "triage-all",
    label: "Pre-triage every untriaged inbox item",
    note: "Runs Claude triage over up to 10 unread items without a classification.",
    endpoint: "/api/inbox/triage-all",
  },
  {
    key: "reseed",
    label: "Reseed demo data",
    note: "Wipe all seed-tagged rows and reinsert the original 124-row demo dataset. Briefings cleared.",
    endpoint: "/api/admin/reseed",
    confirm:
      "Reseed wipes every seed-tagged row across 8 tables and reinserts the original snapshot. Continue?",
  },
];

export default function DemoControlsTab() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(control: Control) {
    if (control.disabled || busy) return;
    if (control.confirm && !window.confirm(control.confirm)) return;
    setBusy(control.key);
    const toastId = toast.loading(`${control.label}…`);
    try {
      const res = await fetch(control.endpoint, {
        method: control.method ?? "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed (${res.status})`);
      }
      const data = await res.json().catch(() => ({}));
      toast.success(summary(control.key, data), { id: toastId });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed", {
        id: toastId,
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="bg-surface border-border">
      <CardContent className="space-y-3 pt-6">
        {CONTROLS.map((c) => (
          <div
            key={c.key}
            className="flex items-center justify-between gap-4 py-2 border-b border-border last:border-b-0"
          >
            <div className="min-w-0">
              <div className="text-sm">{c.label}</div>
              <div className="text-xs text-text-secondary">
                {c.disabled ? c.disabledNote : c.note}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={c.disabled || busy === c.key}
              onClick={() => run(c)}
            >
              {busy === c.key ? "Running…" : "Run"}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function summary(key: string, data: unknown): string {
  if (!data || typeof data !== "object") return "Done";
  const obj = data as Record<string, unknown>;
  const r = (obj.result ?? obj) as Record<string, unknown>;

  if (key === "briefing") {
    if (r.skipped === "already_exists") return "Briefing already existed";
    const delivered = r.delivered ? "delivered" : "not delivered";
    return `Briefing generated · ${delivered}`;
  }
  if (key === "reminders") {
    return `Fired ${r.fired ?? 0} reminder${r.fired === 1 ? "" : "s"}`;
  }
  if (key === "sync") {
    if (r.skipped === "google_not_connected") return "Google not connected";
    const gmail = r.gmail as { inserted?: number } | undefined;
    const cal = r.calendar as { upserted?: number } | undefined;
    return `Gmail ${gmail?.inserted ?? 0} new · Calendar ${cal?.upserted ?? 0} events`;
  }
  if (key === "triage-all") {
    return `Triaged ${obj.triaged ?? 0} item${obj.triaged === 1 ? "" : "s"}`;
  }
  if (key === "reseed") {
    const inserted = (obj.inserted ?? {}) as Record<string, number>;
    const total = Object.values(inserted).reduce((s, n) => s + (n || 0), 0);
    return `Reseeded ${total} rows · briefings cleared`;
  }
  return "Done";
}
