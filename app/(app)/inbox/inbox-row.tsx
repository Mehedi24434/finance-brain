"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Send, Pencil, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import TriageButton from "@/components/dashboard/triage-button";

export type InboxRowItem = {
  id: string;
  sender: string | null;
  subject: string | null;
  preview: string | null;
  body: string | null;
  source: string | null;
  category: string | null;
  classification: string | null;
  urgency_score: number | null;
  status: string;
  received_at: string;
  suggested_response: string | null;
};

const CLASS_TONE: Record<string, string> = {
  urgent: "border-urgent/40 text-urgent",
  approval: "border-warning/40 text-warning",
  request: "border-info/40 text-info",
  fyi: "border-border text-text-secondary",
  noise: "border-border text-text-tertiary",
};

export default function InboxRow({ item }: { item: InboxRowItem }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.suggested_response ?? "");
  const [busy, setBusy] = useState(false);
  const canSendViaGmail = item.source === "email";

  async function sendReply() {
    if (busy) return;
    setBusy(true);
    const toastId = toast.loading("Sending via Gmail…");
    try {
      const res = await fetch(`/api/inbox/${item.id}/send-reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: editing ? draft : undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed (${res.status})`);
      }
      toast.success("Reply sent", { id: toastId });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed", {
        id: toastId,
      });
    } finally {
      setBusy(false);
    }
  }

  async function dismiss() {
    if (busy) return;
    setBusy(true);
    try {
      toast.success("Dismissed — wire up the inbox status endpoint in Session 5.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="border-b border-border last:border-b-0">
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2.5 hover:bg-hover/40 transition-colors",
          item.status === "unread" && "bg-raised/20",
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-start gap-2 min-w-0 flex-1 text-left"
        >
          {open ? (
            <ChevronDown className="size-3.5 text-text-tertiary shrink-0 mt-0.5" />
          ) : (
            <ChevronRight className="size-3.5 text-text-tertiary shrink-0 mt-0.5" />
          )}
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="text-[13px] text-text-primary truncate min-w-0">
                {item.sender ? `${item.sender}: ` : ""}
                {item.subject ?? "(no subject)"}
              </div>
              {item.classification && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] uppercase tracking-wider h-5 px-1.5 shrink-0",
                    CLASS_TONE[item.classification],
                  )}
                >
                  {item.classification}
                </Badge>
              )}
              {item.urgency_score !== null && item.urgency_score !== undefined && (
                <span className="text-[10px] font-mono text-text-tertiary shrink-0">
                  u{item.urgency_score}
                </span>
              )}
            </div>
            {item.preview && (
              <div className="text-[11px] text-text-tertiary truncate">
                {item.preview}
              </div>
            )}
          </div>
        </button>
        {!item.classification && (
          <TriageButton inboxId={item.id} className="shrink-0" />
        )}
      </div>

      {open && (
        <div className="px-3 pb-3 space-y-3 bg-raised/15 border-t border-border">
          <div className="pt-2 text-[12px] text-text-primary whitespace-pre-wrap leading-relaxed">
            {item.body ?? item.preview ?? (
              <span className="text-text-tertiary">No body captured.</span>
            )}
          </div>

          <div className="border-t border-border pt-3 space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-text-tertiary">
              Suggested response
            </div>
            {item.suggested_response ? (
              editing ? (
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={4}
                  className="text-[12px]"
                />
              ) : (
                <div className="text-[12px] text-text-primary whitespace-pre-wrap leading-relaxed bg-surface border border-border rounded p-2">
                  {item.suggested_response}
                </div>
              )
            ) : (
              <div className="text-[11px] text-text-tertiary italic">
                Claude hasn&rsquo;t drafted a reply yet — runs in Session 3.
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                disabled={!item.suggested_response || !canSendViaGmail || busy}
                onClick={sendReply}
                title={
                  !canSendViaGmail
                    ? "Only Gmail items can be sent via Gmail"
                    : undefined
                }
              >
                <Send className="size-3" />
                {busy ? "Sending…" : canSendViaGmail ? "Send via Gmail" : "Send"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!item.suggested_response || busy}
                onClick={() => setEditing((e) => !e)}
              >
                <Pencil className="size-3" />
                {editing ? "Done" : "Edit"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={dismiss}
                disabled={busy}
              >
                <X className="size-3" />
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}
