import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Severity } from "@/lib/panels";
import ItemCard from "../item-card";
import EmptyState from "../empty-state";
import PanelShell from "../panel-shell";
import TriageButton from "../triage-button";

function severityForClassification(c: string | null): Severity {
  switch (c) {
    case "urgent":
      return "urgent";
    case "approval":
      return "warning";
    case "request":
      return "info";
    case "fyi":
      return "muted";
    default:
      return "muted";
  }
}

const PANEL_LIMIT = 10;

export default async function InboxTriagePanel() {
  const db = createServiceRoleClient();

  const [triagedRes, untriagedRes, untriagedCountRes] = await Promise.all([
    db
      .from("inbox_items")
      .select(
        "id, sender, subject, preview, source, classification, urgency_score, received_at, status, category",
      )
      .in("status", ["unread", "read"])
      .in("classification", ["approval", "urgent", "request"])
      .order("urgency_score", { ascending: false, nullsFirst: false })
      .order("received_at", { ascending: false })
      .limit(PANEL_LIMIT),
    db
      .from("inbox_items")
      .select(
        "id, sender, subject, preview, source, classification, urgency_score, received_at, status, category",
      )
      .in("status", ["unread", "read"])
      .is("classification", null)
      .order("received_at", { ascending: false })
      .limit(PANEL_LIMIT),
    db
      .from("inbox_items")
      .select("id", { count: "exact", head: true })
      .in("status", ["unread", "read"])
      .is("classification", null),
  ]);

  const triaged = triagedRes.data ?? [];
  const untriagedAll = untriagedRes.data ?? [];
  const untriagedCount = untriagedCountRes.count ?? untriagedAll.length;

  const triagedToShow = triaged.slice(0, PANEL_LIMIT);
  const remainingSlots = Math.max(0, PANEL_LIMIT - triagedToShow.length);
  const untriagedToShow = untriagedAll.slice(0, remainingSlots);

  const rows = [
    ...triagedToShow.map((r) => ({ ...r, _triaged: true })),
    ...untriagedToShow.map((r) => ({ ...r, _triaged: false })),
  ];

  const counter =
    triagedToShow.length > 0
      ? untriagedCount > 0
        ? `${triagedToShow.length} flagged · ${untriagedCount} to triage`
        : `${triagedToShow.length} flagged`
      : untriagedCount > 0
        ? `${untriagedCount} awaiting triage`
        : null;

  return (
    <PanelShell title="Inbox triage" counter={counter}>
      {rows.length === 0 ? (
        <EmptyState title="Inbox triaged — no pending finance threads" />
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => {
            const baseSeverity = severityForClassification(r.classification);
            const severity =
              (r.urgency_score ?? 0) >= 90 ? "urgent" : baseSeverity;
            return (
            <li key={r.id}>
              <ItemCard
                severity={severity}
                title={r.subject ?? "(no subject)"}
                category={r.category}
                source={r.source as never}
                secondary={
                  r.sender
                    ? `${r.sender}${r.preview ? ` · ${r.preview.slice(0, 80)}` : ""}`
                    : (r.preview?.slice(0, 80) ?? null)
                }
                tag={
                  r._triaged && r.classification
                    ? {
                        label: r.classification,
                        tone:
                          r.classification === "urgent"
                            ? "urgent"
                            : r.classification === "approval"
                              ? "warning"
                              : undefined,
                      }
                    : { label: "untriaged", tone: undefined }
                }
              >
                {!r._triaged && <TriageButton inboxId={r.id} />}
              </ItemCard>
            </li>
            );
          })}
        </ul>
      )}
    </PanelShell>
  );
}
