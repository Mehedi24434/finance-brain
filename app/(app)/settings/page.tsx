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

  const integrations = {
    telegram: {
      linked: Boolean(profile?.telegram_user_id),
      envConfigured: Boolean(
        process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_USER_ID,
      ),
    },
  };

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-lg font-semibold mb-4">Settings</h1>
      <SettingsTabs initialProfile={profile} integrations={integrations} />
    </div>
  );
}
