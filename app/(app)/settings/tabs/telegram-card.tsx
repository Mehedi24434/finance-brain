"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export type TelegramCardState = {
  linked: boolean;
  envConfigured: boolean;
};

export default function TelegramCard({ state }: { state: TelegramCardState }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);

  function call(method: "POST" | "DELETE") {
    if (busy) return;
    setBusy(true);
    start(async () => {
      const toastId = toast.loading(method === "POST" ? "Linking…" : "Unlinking…");
      try {
        const res = await fetch("/api/settings/integrations/telegram", {
          method,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Failed (${res.status})`);
        }
        toast.success(method === "POST" ? "Linked" : "Unlinked", { id: toastId });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed", {
          id: toastId,
        });
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <Card className="bg-surface border-border">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-sm">Telegram</CardTitle>
        <Badge
          variant="outline"
          className={
            state.linked
              ? "text-[10px] uppercase tracking-wider border-ok/40 text-ok"
              : state.envConfigured
                ? "text-[10px] uppercase tracking-wider border-warning/40 text-warning"
                : "text-[10px] uppercase tracking-wider"
          }
        >
          {state.linked
            ? "Connected"
            : state.envConfigured
              ? "Not linked"
              : "Not configured"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-text-secondary text-xs">
          Briefings, reminders, and voice quick-capture via Telegram.
        </p>
        {!state.envConfigured ? (
          <p className="text-text-tertiary text-[11px]">
            Set <code className="font-mono">TELEGRAM_BOT_TOKEN</code> and{" "}
            <code className="font-mono">TELEGRAM_USER_ID</code> on the server,
            then register the webhook (see README).
          </p>
        ) : null}
        <div className="flex items-center gap-2">
          {!state.linked ? (
            <Button
              variant="outline"
              size="sm"
              disabled={!state.envConfigured || busy || pending}
              onClick={() => call("POST")}
            >
              {busy || pending ? "Linking…" : "Link Telegram"}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy || pending}
              onClick={() => call("DELETE")}
            >
              Unlink
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
