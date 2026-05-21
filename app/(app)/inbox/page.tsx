import { createServiceRoleClient } from "@/lib/supabase/server";
import FilterChips from "@/components/dashboard/filter-chips";
import EmptyState from "@/components/dashboard/empty-state";
import PanelShell from "@/components/dashboard/panel-shell";
import InboxRow from "./inbox-row";

export const dynamic = "force-dynamic";

const CLASSIFICATION_OPTIONS = [
  { value: "all", label: "All" },
  { value: "approval", label: "Approval" },
  { value: "urgent", label: "Urgent" },
  { value: "request", label: "Request" },
  { value: "fyi", label: "FYI" },
  { value: "noise", label: "Noise" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
  { value: "actioned", label: "Actioned" },
];

const SOURCE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "email", label: "Gmail" },
  { value: "slack", label: "Slack" },
];

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{
    classification?: string;
    status?: string;
    source?: string;
  }>;
}) {
  const sp = await searchParams;
  const classification = sp.classification ?? "all";
  const status = sp.status ?? "all";
  const source = sp.source ?? "all";

  const db = createServiceRoleClient();
  let query = db
    .from("inbox_items")
    .select(
      "id, sender, subject, preview, body, source, category, classification, urgency_score, status, received_at, suggested_response",
      { count: "exact" },
    )
    .order("received_at", { ascending: false })
    .limit(100);

  if (classification !== "all") {
    query = query.eq("classification", classification);
  }
  if (status !== "all") {
    query = query.eq("status", status);
  } else {
    query = query.neq("status", "archived");
  }
  if (source !== "all") query = query.eq("source", source);

  const { data, count } = await query;
  const rows = data ?? [];

  const currentParams = { classification, status, source };

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-end justify-between">
        <h1 className="text-lg font-semibold">Inbox</h1>
        <div className="text-xs font-mono text-text-tertiary">
          {count ?? 0} matching
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg p-3 space-y-2">
        <FilterChips
          group="classification"
          options={CLASSIFICATION_OPTIONS}
          active={classification}
          basePath="/inbox"
          currentParams={currentParams}
        />
        <FilterChips
          group="status"
          options={STATUS_OPTIONS}
          active={status}
          basePath="/inbox"
          currentParams={currentParams}
        />
        <FilterChips
          group="source"
          options={SOURCE_OPTIONS}
          active={source}
          basePath="/inbox"
          currentParams={currentParams}
        />
      </div>

      <PanelShell title="Threads" counter={rows.length ? `${rows.length} shown` : null}>
        {rows.length === 0 ? (
          <EmptyState
            title="No inbox threads match"
            hint="Try clearing filters, or run pre-triage from Settings → Demo controls."
          />
        ) : (
          <ul>
            {rows.map((r) => (
              <InboxRow key={r.id} item={r} />
            ))}
          </ul>
        )}
      </PanelShell>
    </div>
  );
}
