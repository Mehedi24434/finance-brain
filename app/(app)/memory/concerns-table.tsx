import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { formatUsd } from "@/lib/panels";

const STATUS_TONE: Record<string, string> = {
  escalated: "border-urgent/40 text-urgent",
  active: "border-warning/40 text-warning",
  monitoring: "border-info/40 text-info",
  mitigated: "border-ok/40 text-ok",
  resolved: "border-border text-text-tertiary",
};

export default async function ConcernsTable() {
  const db = createServiceRoleClient();
  const { data } = await db
    .from("ongoing_concerns")
    .select(
      "id, title, status, financial_impact_usd, stakeholders, next_review, category",
    )
    .order("status", { ascending: true })
    .order("financial_impact_usd", { ascending: false, nullsFirst: false })
    .limit(200);

  const rows = data ?? [];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead className="bg-raised/40">
          <tr className="text-left text-text-tertiary uppercase tracking-wider text-[10px]">
            <th className="py-2 px-3 font-medium">Concern</th>
            <th className="py-2 px-3 font-medium">Status</th>
            <th className="py-2 px-3 font-medium font-mono">Impact</th>
            <th className="py-2 px-3 font-medium">Stakeholders</th>
            <th className="py-2 px-3 font-medium">Category</th>
            <th className="py-2 px-3 font-medium">Next review</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((c) => (
            <tr key={c.id} className="hover:bg-hover/30">
              <td className="py-2 px-3 text-text-primary max-w-[36ch] truncate">
                {c.title}
              </td>
              <td className="py-2 px-3">
                {c.status && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] uppercase tracking-wider h-5 px-1.5 ${STATUS_TONE[c.status] ?? ""}`}
                  >
                    {c.status}
                  </Badge>
                )}
              </td>
              <td className="py-2 px-3 font-mono text-text-primary">
                {formatUsd(c.financial_impact_usd) ?? "—"}
              </td>
              <td className="py-2 px-3 text-text-secondary max-w-[28ch] truncate">
                {(c.stakeholders ?? []).join(", ") || "—"}
              </td>
              <td className="py-2 px-3">
                {c.category && (
                  <Badge
                    variant="outline"
                    className="text-[10px] uppercase tracking-wider h-5 px-1.5 text-text-secondary"
                  >
                    {c.category.replace(/_/g, " ")}
                  </Badge>
                )}
              </td>
              <td className="py-2 px-3 text-text-tertiary font-mono">
                {c.next_review ? format(new Date(c.next_review), "MMM d") : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div className="py-6 text-center text-text-tertiary text-xs">
          No ongoing concerns logged.
        </div>
      )}
    </div>
  );
}
