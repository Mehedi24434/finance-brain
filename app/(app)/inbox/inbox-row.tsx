"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Send, Pencil, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

  function notImplemented(label: string) {
    toast.info(`${label} wires up when Gmail integration lands.`);
  }

  async function dismiss() {
    if (busy) return;
    setBusy(true);
    try {
      toast.success("Dismissed — wire up the inbox status endpoint in Session 5.");
      // Future: POST /api/inbox/[id]/dismiss
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full text-left px-3 py-2.5 hover:bg-hover/40 transition-colors",
          item.status === "unread" && "bg-raised/20",
        )}
      >
        <div className="flex items-start gap-2 min-w-0">
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
        </div>
      </button>

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
                disabled={!item.suggested_response}
                onClick={() => notImplemented("Send")}
              >
                <Send className="size-3" />
                Send
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!item.suggested_response}
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
