"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

const CONTROLS = [
  { label: "Reseed", note: "Restore the seed dataset. Wired in Session 8." },
  { label: "Pre-generate briefing", note: "Run the daily briefing now. Wired in Session 8." },
  { label: "Pre-triage inbox", note: "Run Claude triage over the inbox. Wired in Session 8." },
];

export default function DemoControlsTab() {
  return (
    <Card className="bg-surface border-border">
      <CardContent className="space-y-3 pt-6">
        {CONTROLS.map((c) => (
          <div
            key={c.label}
            className="flex items-center justify-between gap-4 py-2 border-b border-border last:border-b-0"
          >
            <div>
              <div className="text-sm">{c.label}</div>
              <div className="text-xs text-text-secondary">{c.note}</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.info(`${c.label} is not wired yet.`)}
            >
              Run
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
