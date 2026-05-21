"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProfileTab, { type ProfileFormValues } from "./tabs/profile-tab";
import IntegrationsTab, {
  type IntegrationsState,
} from "./tabs/integrations-tab";
import DemoControlsTab from "./tabs/demo-controls-tab";

export default function SettingsTabs({
  initialProfile,
  integrations,
}: {
  initialProfile: ProfileFormValues | null;
  integrations: IntegrationsState;
}) {
  return (
    <Tabs defaultValue="profile" className="space-y-4">
      <TabsList>
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="integrations">Integrations</TabsTrigger>
        <TabsTrigger value="demo">Demo controls</TabsTrigger>
      </TabsList>
      <TabsContent value="profile">
        <ProfileTab initial={initialProfile} />
      </TabsContent>
      <TabsContent value="integrations">
        <IntegrationsTab initial={integrations} />
      </TabsContent>
      <TabsContent value="demo">
        <DemoControlsTab />
      </TabsContent>
    </Tabs>
  );
}
