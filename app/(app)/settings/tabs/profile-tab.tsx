"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export type ProfileFormValues = {
  full_name: string | null;
  role: string | null;
  company: string | null;
  industry: string | null;
  timezone: string | null;
  briefing_time: string | null;
  telegram_user_id?: string | null;
};

export default function ProfileTab({
  initial,
}: {
  initial: ProfileFormValues | null;
}) {
  const [values, setValues] = useState<ProfileFormValues>({
    full_name: initial?.full_name ?? "",
    role: initial?.role ?? "",
    company: initial?.company ?? "",
    industry: initial?.industry ?? "",
    timezone: initial?.timezone ?? "",
    briefing_time: initial?.briefing_time ?? "06:30",
  });
  const [saving, setSaving] = useState(false);

  function set<K extends keyof ProfileFormValues>(
    key: K,
    value: ProfileFormValues[K],
  ) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed (${res.status})`);
      }
      toast.success("Profile saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="bg-surface border-border">
      <CardContent className="space-y-4 pt-6">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Full name">
            <Input
              value={values.full_name ?? ""}
              onChange={(e) => set("full_name", e.target.value)}
            />
          </Field>
          <Field label="Role">
            <Input
              value={values.role ?? ""}
              onChange={(e) => set("role", e.target.value)}
            />
          </Field>
          <Field label="Company">
            <Input
              value={values.company ?? ""}
              onChange={(e) => set("company", e.target.value)}
            />
          </Field>
          <Field label="Industry">
            <Input
              value={values.industry ?? ""}
              onChange={(e) => set("industry", e.target.value)}
            />
          </Field>
          <Field label="Timezone">
            <Input
              placeholder="America/Chicago"
              value={values.timezone ?? ""}
              onChange={(e) => set("timezone", e.target.value)}
            />
          </Field>
          <Field label="Briefing time">
            <Input
              type="time"
              value={values.briefing_time ?? ""}
              onChange={(e) => set("briefing_time", e.target.value)}
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-text-secondary text-xs">{label}</Label>
      {children}
    </div>
  );
}
