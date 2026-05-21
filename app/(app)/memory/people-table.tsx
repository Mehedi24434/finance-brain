import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { createServiceRoleClient } from "@/lib/supabase/server";

const IMPORTANCE_TONE: Record<string, string> = {
  critical: "border-urgent/40 text-urgent",
  high: "border-warning/40 text-warning",
  medium: "border-info/40 text-info",
  low: "border-border text-text-tertiary",
};

export default async function PeopleTable() {
  const db = createServiceRoleClient();
  const { data } = await db
    .from("relationships")
    .select(
      "id, name, role, organization, relationship, importance, cadence, last_interaction, active",
    )
    .eq("active", true)
    .order("importance", { ascending: false })
    .order("name", { ascending: true })
    .limit(200);

  const rows = data ?? [];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead className="bg-raised/40">
          <tr className="text-left text-text-tertiary uppercase tracking-wider text-[10px]">
            <th className="py-2 px-3 font-medium">Name</th>
            <th className="py-2 px-3 font-medium">Role</th>
            <th className="py-2 px-3 font-medium">Org</th>
            <th className="py-2 px-3 font-medium">Relationship</th>
            <th className="py-2 px-3 font-medium">Importance</th>
            <th className="py-2 px-3 font-medium">Cadence</th>
            <th className="py-2 px-3 font-medium">Last contact</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((p) => (
            <tr key={p.id} className="hover:bg-hover/30">
              <td className="py-2 px-3 text-text-primary">{p.name}</td>
              <td className="py-2 px-3 text-text-secondary">{p.role ?? "—"}</td>
              <td className="py-2 px-3 text-text-secondary">
                {p.organization ?? "—"}
              </td>
              <td className="py-2 px-3">
                {p.relationship && (
                  <Badge
                    variant="outline"
                    className="text-[10px] uppercase tracking-wider h-5 px-1.5 text-text-secondary"
                  >
                    {String(p.relationship).replace(/_/g, " ")}
                  </Badge>
                )}
              </td>
              <td className="py-2 px-3">
                {p.importance && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] uppercase tracking-wider h-5 px-1.5 ${IMPORTANCE_TONE[p.importance] ?? ""}`}
                  >
                    {p.importance}
                  </Badge>
                )}
              </td>
              <td className="py-2 px-3 text-text-secondary">{p.cadence ?? "—"}</td>
              <td className="py-2 px-3 text-text-tertiary font-mono">
                {p.last_interaction
                  ? format(new Date(p.last_interaction), "MMM d")
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div className="py-6 text-center text-text-tertiary text-xs">
          No relationships tracked yet.
        </div>
      )}
    </div>
  );
}
