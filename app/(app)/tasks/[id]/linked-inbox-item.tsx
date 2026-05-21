"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LinkedInboxItem({
  item,
}: {
  item: {
    id: string;
    sender: string | null;
    subject: string | null;
    preview: string | null;
    body: string | null;
    source: string | null;
    received_at: string;
    classification: string | null;
  };
}) {
  const [open, setOpen] = useState(false);
  const ChevronIcon = open ? ChevronDown : ChevronRight;
  return (
    <section className="bg-surface border border-border rounded-lg">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-hover/30"
      >
        <div className="flex items-center gap-2 min-w-0">
          <ChevronIcon className="size-3.5 text-text-tertiary shrink-0" />
          <div className="text-[12px] text-text-secondary">Linked inbox item</div>
          <div className="text-[12px] text-text-primary truncate">
            {item.sender ? `${item.sender} · ` : ""}
            {item.subject ?? "(no subject)"}
          </div>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-text-tertiary font-mono shrink-0">
          {item.source}
        </span>
      </button>
      {open && (
        <div
          className={cn(
            "px-3 pb-3 pt-1 text-[12px] text-text-primary leading-relaxed whitespace-pre-wrap border-t border-border",
          )}
        >
          {item.body ?? item.preview ?? (
            <span className="text-text-tertiary">No body captured.</span>
          )}
        </div>
      )}
    </section>
  );
}
