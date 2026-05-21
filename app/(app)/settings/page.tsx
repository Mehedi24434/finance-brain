import { createServiceRoleClient } from "@/lib/supabase/server";
import SettingsTabs from "./settings-tabs";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = createServiceRoleClient();
  const { data: profile } = await supabase
    .from("executive_profile")
    .select(
      "full_name, role, company, industry, timezone, briefing_time, telegram_user_id",
    )
    .limit(1)
    .maybeSingle();

  const [{ data: slackRow }, { data: googleRow }] = await Promise.all([
    supabase
      .from("integrations")
      .select("status, config, last_sync_at, error_message, updated_at")
      .eq("service", "slack")
      .maybeSingle(),
    supabase
      .from("integrations")
      .select("status, config, last_sync_at, error_message, updated_at")
      .eq("service", "google")
      .maybeSingle(),
  ]);

  const googleConfig = (googleRow?.config ?? {}) as {
    refresh_token?: string | null;
    email?: string | null;
    gmail_query?: string | null;
  };

  const integrations = {
    telegram: {
      linked: Boolean(profile?.telegram_user_id),
      envConfigured: Boolean(
        process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_USER_ID,
      ),
    },
    slack: {
      status: (slackRow?.status ?? "disconnected") as
        | "connected"
        | "disconnected"
        | "error",
      envConfigured: Boolean(
        process.env.SLACK_BOT_TOKEN && process.env.SLACK_SIGNING_SECRET,
      ),
      selectedChannels:
        (slackRow?.config as { slack_channels?: string[] } | null)
          ?.slack_channels ?? [],
      lastSyncAt: slackRow?.last_sync_at ?? null,
      errorMessage: slackRow?.error_message ?? null,
    },
    google: {
      connected: Boolean(googleConfig.refresh_token),
      envConfigured: Boolean(
        process.env.GOOGLE_CLIENT_ID &&
          process.env.GOOGLE_CLIENT_SECRET &&
          process.env.GOOGLE_REDIRECT_URI &&
          process.env.GOOGLE_STATE_SECRET,
      ),
      email: googleConfig.email ?? null,
      gmailQuery: googleConfig.gmail_query ?? null,
      lastSyncAt: googleRow?.last_sync_at ?? null,
      errorMessage: googleRow?.error_message ?? null,
    },
    anthropic: {
      envConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    },
  };

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-lg font-semibold mb-4">Settings</h1>
      <SettingsTabs initialProfile={profile} integrations={integrations} />
    </div>
  );
}
