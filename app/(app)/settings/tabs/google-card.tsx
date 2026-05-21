"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Link as LinkIcon, RefreshCw, Slash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type GoogleCardState = {
  connected: boolean;
  envConfigured: boolean;
  email: string | null;
  gmailQuery: string | null;
  lastSyncAt: string | null;
  errorMessage: string | null;
};

export default function GoogleCard({ state }: { state: GoogleCardState }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState(state.gmailQuery ?? "");

  const badge = !state.envConfigured
    ? { label: "Env missing", tone: "" }
    : state.connected
      ? { label: "Connected", tone: "border-ok/40 text-ok" }
      : { label: "Not connected", tone: "border-warning/40 text-warning" };

  function connect() {
    // Full-page navigation to /api/auth/google/start — that route 302s to
    // Google's consent screen.
    window.location.href = "/api/auth/google/start";
  }

  function disconnect() {
    if (busy) return;
    setBusy("disconnect");
    start(async () => {
      try {
        const res = await fetch("/api/integrations/google", { method: "DELETE" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Failed (${res.status})`);
        }
        toast.success("Disconnected");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      } finally {
        setBusy(null);
      }
    });
  }

  async function syncNow() {
    if (busy) return;
    setBusy("sync");
    const toastId = toast.loading("Syncing Gmail + Calendar…");
    try {
      const res = await fetch("/api/integrations/google/sync", {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed (${res.status})`);
      }
      const data = (await res.json()) as {
        gmail?: { fetched?: number; inserted?: number; triaged?: number };
        calendar?: { fetched?: number; upserted?: number };
      };
      const gmailLine = data.gmail
        ? `Gmail: ${data.gmail.inserted ?? 0} new (${data.gmail.triaged ?? 0} triaged)`
        : "Gmail: skipped";
      const calLine = data.calendar
        ? `Calendar: ${data.calendar.upserted ?? 0} events`
        : "Calendar: skipped";
      toast.success(`${gmailLine} · ${calLine}`, { id: toastId });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed", {
        id: toastId,
      });
    } finally {
      setBusy(null);
    }
  }

  function saveQuery() {
    if (busy) return;
    setBusy("query");
    start(async () => {
      try {
        const res = await fetch("/api/integrations/google", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gmail_query: query || null }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Failed (${res.status})`);
        }
        toast.success("Gmail query saved");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      } finally {
        setBusy(null);
      }
    });
  }

  return (
    <Card className="bg-surface border-border md:col-span-2">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-sm">Google (Gmail + Calendar)</CardTitle>
        <Badge
          variant="outline"
          className={cn("text-[10px] uppercase tracking-wider", badge.tone)}
        >
          {badge.label}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-text-secondary text-xs">
          Pulls recent Gmail threads into the inbox (auto-triaged), and syncs
          your next 7 days of calendar events into Meeting Notes so each one
          can be pre-briefed.
        </p>

        {!state.envConfigured ? (
          <p className="text-text-tertiary text-[11px]">
            Set <code className="font-mono">GOOGLE_CLIENT_ID</code>,{" "}
            <code className="font-mono">GOOGLE_CLIENT_SECRET</code>,{" "}
            <code className="font-mono">GOOGLE_REDIRECT_URI</code>, and{" "}
            <code className="font-mono">GOOGLE_STATE_SECRET</code> on the
            server (see README).
          </p>
        ) : !state.connected ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={connect}>
              <LinkIcon className="size-3" />
              Connect Google
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-[11px] text-text-tertiary font-mono">
              {state.email && <span>{state.email}</span>}
              <span>·</span>
              {state.lastSyncAt ? (
                <span>
                  Last sync {formatDistanceToNow(new Date(state.lastSyncAt))} ago
                </span>
              ) : (
                <span>Never synced</span>
              )}
            </div>
            {state.errorMessage && (
              <div className="text-[11px] text-urgent">{state.errorMessage}</div>
            )}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={busy === "sync"}
                onClick={syncNow}
              >
                <RefreshCw
                  className={cn(
                    "size-3",
                    busy === "sync" && "animate-spin",
                  )}
                />
                Sync now
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy === "disconnect" || pending}
                onClick={disconnect}
              >
                <Slash className="size-3" />
                Disconnect
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gmail-query" className="text-text-secondary text-xs">
                Gmail query
              </Label>
              <Input
                id="gmail-query"
                placeholder="from:(*.com) -in:promotions newer_than:7d"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-text-tertiary">
                  Filter applied each sync. Leave blank to use the default.
                </p>
                <Button
                  size="sm"
                  disabled={busy === "query" || pending}
                  onClick={saveQuery}
                >
                  {busy === "query" ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
