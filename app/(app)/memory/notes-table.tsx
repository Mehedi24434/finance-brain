import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { createServiceRoleClient } from "@/lib/supabase/server";

const CONF_TONE: Record<string, string> = {
  high: "border-ok/40 text-ok",
  medium: "border-warning/40 text-warning",
  low: "border-border text-text-tertiary",
};

export default async function NotesTable() {
  const db = createServiceRoleClient();
  const { data } = await db
    .from("memory_notes")
    .select(
      "id, memory_type, category, title, content, confidence, last_referenced, reference_count, created_at",
    )
    .order("reference_count", { ascending: false })
    .order("last_referenced", { ascending: false, nullsFirst: false })
    .limit(200);

  const rows = data ?? [];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead className="bg-raised/40">
          <tr className="text-left text-text-tertiary uppercase tracking-wider text-[10px]">
            <th className="py-2 px-3 font-medium">Type</th>
            <th className="py-2 px-3 font-medium">Category</th>
            <th className="py-2 px-3 font-medium">Title</th>
            <th className="py-2 px-3 font-medium">Content</th>
            <th className="py-2 px-3 font-medium">Conf.</th>
            <th className="py-2 px-3 font-medium font-mono">Refs</th>
            <th className="py-2 px-3 font-medium">Last seen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((n) => (
            <tr key={n.id} className="hover:bg-hover/30">
              <td className="py-2 px-3 text-text-secondary">{n.memory_type}</td>
              <td className="py-2 px-3">
                {n.category && (
                  <Badge
                    variant="outline"
                    className="text-[10px] uppercase tracking-wider h-5 px-1.5 text-text-secondary"
                  >
                    {n.category.replace(/_/g, " ")}
                  </Badge>
                )}
              </td>
              <td className="py-2 px-3 text-text-primary max-w-[24ch] truncate">
                {n.title}
              </td>
              <td className="py-2 px-3 text-text-secondary max-w-[48ch] truncate">
                {n.content}
              </td>
              <td className="py-2 px-3">
                {n.confidence && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] uppercase tracking-wider h-5 px-1.5 ${CONF_TONE[n.confidence] ?? ""}`}
                  >
                    {n.confidence}
                  </Badge>
                )}
              </td>
              <td className="py-2 px-3 font-mono text-text-primary">
                {n.reference_count ?? 0}
              </td>
              <td className="py-2 px-3 text-text-tertiary">
                {n.last_referenced
                  ? format(new Date(n.last_referenced), "MMM d")
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div className="py-6 text-center text-text-tertiary text-xs">
          No memory notes yet.
        </div>
      )}
    </div>
  );
}
