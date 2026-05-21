import { cn } from "@/lib/utils";

export default function PanelShell({
  title,
  counter,
  className,
  bodyClassName,
  children,
  headerExtras,
}: {
  title: string;
  counter?: string | null;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
  headerExtras?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "bg-surface border border-border rounded-lg flex flex-col min-h-0",
        className,
      )}
    >
      <header className="h-10 shrink-0 px-3 flex items-center justify-between gap-2 border-b border-border">
        <h2 className="text-[13px] font-semibold tracking-tight text-text-primary">
          {title}
        </h2>
        <div className="flex items-center gap-2">
          {headerExtras}
          {counter && (
            <span className="inline-flex items-center h-5 px-2 rounded text-[10px] font-mono uppercase tracking-wider bg-raised text-text-secondary border border-border">
              {counter}
            </span>
          )}
        </div>
      </header>
      <div className={cn("flex-1 min-h-0", bodyClassName)}>{children}</div>
    </section>
  );
}
