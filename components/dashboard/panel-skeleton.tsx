import PanelShell from "./panel-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function PanelSkeleton({
  title,
  rows = 4,
}: {
  title: string;
  rows?: number;
}) {
  return (
    <PanelShell title={title}>
      <ul className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <li key={i} className="px-4 py-2.5 space-y-1.5">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-2/5" />
          </li>
        ))}
      </ul>
    </PanelShell>
  );
}
