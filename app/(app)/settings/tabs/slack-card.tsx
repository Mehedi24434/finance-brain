"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { RefreshCw, Send, Slash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type SlackCardState = {
  status: "connected" | "disconnected" | "error";
  envConfigured: boolean;
  selectedChannels: string[];
  lastSyncAt: string | null;
  errorMessage: string | null;
};

type Channel = {
  id: string;
  name: string;
  is_private: boolean;
  is_member: boolean;
};

export default function SlackCard({ state }: { state: SlackCardState }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(
    new Set(state.selectedChannels),
  );

  const badge = state.envConfigured
    ? state.status === "connected"
      ? { label: "Connected", tone: "border-ok/40 text-ok" }
      : state.status === "error"
        ? { label: "Error", tone: "border-urgent/40 text-urgent" }
        : { label: "Not configured", tone: "" }
    : { label: "Env missing", tone: "" };

  async function refreshChannels() {
    setBusy("refresh");
    try {
      const res = await fetch("/api/admin/slack-channels");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed (${res.status})`);
      }
      const { channels: list } = (await res.json()) as { channels: Channel[] };
      setChannels(list);
      toast.success(`Loaded ${list.length} channels`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  function save() {
    if (busy) return;
    setBusy("save");
    start(async () => {
      try {
        const res = await fetch("/api/settings/integrations/slack", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channels: Array.from(selected) }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Failed (${res.status})`);
        }
        toast.success("Slack configured");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      } finally {
        setBusy(null);
      }
    });
  }

  function disconnect() {
    if (busy) return;
    setBusy("disconnect");
    start(async () => {
      try {
        const res = await fetch("/api/settings/integrations/slack", {
          method: "DELETE",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Failed (${res.status})`);
        }
        setSelected(new Set());
        toast.success("Disconnected");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      } finally {
        setBusy(null);
      }
    });
  }

  async function sendTest() {
    setBusy("test");
    try {
      const res = await fetch("/api/admin/slack-test", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed (${res.status})`);
      }
      toast.success("Test DM sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filteredChannels = channels
    ? channels.filter((c) =>
        filter ? c.name.toLowerCase().includes(filter.toLowerCase()) : true,
      )
    : null;

  return (
    <Card className="bg-surface border-border md:col-span-2">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-sm">Slack</CardTitle>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] uppercase tracking-wider",
            badge.tone,
          )}
        >
          {badge.label}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-text-secondary text-xs">
          Listens to selected channels and surfaces finance-relevant messages
          in the inbox. Webhook fires on every message; matched messages are
          inserted and triaged by Claude.
        </p>

        {!state.envConfigured ? (
          <p className="text-text-tertiary text-[11px]">
            Set <code className="font-mono">SLACK_BOT_TOKEN</code>,{" "}
            <code className="font-mono">SLACK_SIGNING_SECRET</code>, and{" "}
            <code className="font-mono">SLACK_LUKE_USER_ID</code> on the server,
            then register the Event Subscriptions URL (see README).
          </p>
        ) : (
          <>
            <div className="flex items-center gap-2 text-[11px] text-text-tertiary font-mono">
              {state.lastSyncAt ? (
                <span>
                  Last message {formatDistanceToNow(new Date(state.lastSyncAt))} ago
                </span>
              ) : (
                <span>No messages received yet</span>
              )}
              <span>·</span>
              <span>
                {selected.size === 0
                  ? "All channels (no filter)"
                  : `${selected.size} channel${selected.size === 1 ? "" : "s"} selected`}
              </span>
            </div>

            {state.errorMessage && (
              <div className="text-[11px] text-urgent">
                {state.errorMessage}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={busy === "refresh"}
                onClick={refreshChannels}
              >
                <RefreshCw
                  className={cn(
                    "size-3",
                    busy === "refresh" && "animate-spin",
                  )}
                />
                {channels ? "Refresh channels" : "Load channels"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy === "test"}
                onClick={sendTest}
              >
                <Send className="size-3" />
                Send test DM
              </Button>
              {state.status === "connected" && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy === "disconnect" || pending}
                  onClick={disconnect}
                >
                  <Slash className="size-3" />
                  Disconnect
                </Button>
              )}
            </div>

            {filteredChannels && (
              <div className="space-y-2">
                <Input
                  placeholder="Filter channels…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
                <ScrollArea className="h-48 border border-border rounded-md">
                  <ul className="divide-y divide-border">
                    {filteredChannels.map((c) => (
                      <li key={c.id}>
                        <label className="flex items-center gap-2 px-3 py-1.5 text-[12px] cursor-pointer hover:bg-hover/40">
                          <input
                            type="checkbox"
                            checked={selected.has(c.id)}
                            onChange={() => toggle(c.id)}
                            className="accent-accent size-3.5"
                          />
                          <span className="text-text-primary">
                            #{c.name}
                          </span>
                          {c.is_private && (
                            <span className="text-[10px] text-text-tertiary uppercase tracking-wider">
                              private
                            </span>
                          )}
                          {!c.is_member && (
                            <span className="text-[10px] text-warning uppercase tracking-wider">
                              bot not in channel
                            </span>
                          )}
                        </label>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    disabled={busy === "save" || pending}
                    onClick={save}
                  >
                    {busy === "save" || pending
                      ? "Saving…"
                      : "Save selection"}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
