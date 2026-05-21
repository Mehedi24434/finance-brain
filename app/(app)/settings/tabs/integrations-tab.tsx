"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const INTEGRATIONS = [
  {
    key: "telegram",
    name: "Telegram",
    description: "Briefings, reminders, and quick-capture from Telegram.",
  },
  {
    key: "slack",
    name: "Slack",
    description: "Triage Slack mentions into the inbox.",
  },
  {
    key: "google",
    name: "Google",
    description: "Calendar + Gmail for meeting prep and email triage.",
  },
  {
    key: "openai",
    name: "Anthropic",
    description: "LLM provider key for Claude calls. Wired in Session 3.",
  },
];

export default function IntegrationsTab() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {INTEGRATIONS.map((it) => (
        <Card key={it.key} className="bg-surface border-border">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">{it.name}</CardTitle>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
              Not configured
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-text-secondary text-xs">{it.description}</p>
            <Button variant="outline" size="sm" disabled>
              Connect
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
