import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Severity } from "@/lib/panels";
import ItemCard from "../item-card";
import EmptyState from "../empty-state";
import PanelShell from "../panel-shell";

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

export default async function InboxTriagePanel() {
  const db = createServiceRoleClient();
  const { data, count } = await db
    .from("inbox_items")
    .select(
      "id, sender, subject, preview, source, classification, urgency_score, received_at, status, category",
      { count: "exact" },
    )
    .in("status", ["unread", "read"])
    .in("classification", ["approval", "urgent", "request"])
    .order("urgency_score", { ascending: false, nullsFirst: false })
    .order("received_at", { ascending: false })
    .limit(10);

  const rows = data ?? [];
  const untriaged = await db
    .from("inbox_items")
    .select("id", { count: "exact", head: true })
    .in("status", ["unread", "read"])
    .is("classification", null);

  return (
    <PanelShell
      title="Inbox triage"
      counter={
        rows.length
          ? `${count ?? rows.length} flagged`
          : untriaged.count
            ? `${untriaged.count} awaiting triage`
            : null
      }
    >
      {rows.length === 0 ? (
        <EmptyState
          title={
            untriaged.count
              ? "Inbox not triaged yet"
              : "Inbox triaged — no pending finance threads"
          }
          hint={
            untriaged.count
              ? "Run pre-triage from Settings → Demo controls once Session 3 lands."
              : undefined
          }
        />
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id}>
              <ItemCard
                severity={severityForClassification(r.classification)}
                title={r.subject ?? "(no subject)"}
                category={r.category}
                source={r.source as never}
                secondary={
                  r.sender
                    ? `${r.sender}${r.preview ? ` · ${r.preview.slice(0, 80)}` : ""}`
                    : (r.preview?.slice(0, 80) ?? null)
                }
                tag={
                  r.classification
                    ? {
                        label: r.classification,
                        tone:
                          r.classification === "urgent"
                            ? "urgent"
                            : r.classification === "approval"
                              ? "warning"
                              : undefined,
                      }
                    : null
                }
              />
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}
