import Link from "next/link";
import { cn } from "@/lib/utils";

export type FilterOption = {
  value: string;
  label: string;
  count?: number;
};

export default function FilterChips({
  group,
  options,
  active,
  basePath,
  currentParams,
}: {
  group: string;
  options: FilterOption[];
  active: string;
  basePath: string;
  currentParams: Record<string, string | undefined>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-text-tertiary px-1">
        {group}
      </span>
      {options.map((opt) => {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(currentParams)) {
          if (v && k !== group) params.set(k, v);
        }
        if (opt.value !== "all") params.set(group, opt.value);
        const href = params.size ? `${basePath}?${params.toString()}` : basePath;
        const isActive = opt.value === active;
        return (
          <Link
            key={opt.value}
            href={href}
            className={cn(
              "inline-flex items-center gap-1 h-6 px-2 rounded-full border text-[11px] transition-colors",
              isActive
                ? "border-accent/40 bg-accent/15 text-text-primary"
                : "border-border bg-raised/40 text-text-secondary hover:text-text-primary hover:border-border",
            )}
          >
            <span>{opt.label}</span>
            {opt.count !== undefined && (
              <span className="font-mono text-[10px] text-text-tertiary">
                {opt.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
