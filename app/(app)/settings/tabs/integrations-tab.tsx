"use client";

import TelegramCard, { type TelegramCardState } from "./telegram-card";
import SlackCard, { type SlackCardState } from "./slack-card";
import GoogleCard, { type GoogleCardState } from "./google-card";
import StaticCard from "./static-card";

export type IntegrationsState = {
  telegram: TelegramCardState;
  slack: SlackCardState;
  google: GoogleCardState;
  anthropic: {
    envConfigured: boolean;
  };
};

export default function IntegrationsTab({
  initial,
}: {
  initial: IntegrationsState;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <TelegramCard state={initial.telegram} />
      <StaticCard
        name="Anthropic"
        description="LLM provider key for Claude calls (briefing, triage, memory extraction, meeting pre-briefs). Connected via environment — no in-app toggle."
        envConfigured={initial.anthropic.envConfigured}
        envHint="Set ANTHROPIC_API_KEY on the server."
      />
      <SlackCard state={initial.slack} />
      <GoogleCard state={initial.google} />
    </div>
  );
}
