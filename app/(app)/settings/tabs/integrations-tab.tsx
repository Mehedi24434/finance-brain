"use client";

import TelegramCard, { type TelegramCardState } from "./telegram-card";
import SlackCard, { type SlackCardState } from "./slack-card";
import GoogleCard, { type GoogleCardState } from "./google-card";
import StaticCard from "./static-card";

export type IntegrationsState = {
  telegram: TelegramCardState;
  slack: SlackCardState;
  google: GoogleCardState;
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
        description="LLM provider key for Claude calls. Connected via environment."
      />
      <SlackCard state={initial.slack} />
      <GoogleCard state={initial.google} />
    </div>
  );
}
