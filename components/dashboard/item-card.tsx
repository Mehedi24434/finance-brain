import Link from "next/link";
import {
  AlertTriangle,
  Calendar,
  Inbox,
  Mail,
  MessageCircle,
  MessageSquare,
  Mic,
  PenLine,
  Users,
  Voicemail,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { dueLabel, formatUsd, type Severity } from "@/lib/panels";

const STRIPE_BG: Record<Severity, string> = {
  urgent: "bg-urgent",
  warning: "bg-warning",
  ok: "bg-ok",
  info: "bg-info",
  muted: "bg-text-tertiary/40",
};

export type ItemCardSource =
  | "email"
  | "slack"
  | "teams"
  | "sms"
  | "voicemail"
  | "meeting"
  | "manual"
  | "telegram"
  | "other"
  | null
  | undefined;

const SOURCE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  email: Mail,
  slack: MessageSquare,
  teams: Users,
  sms: MessageCircle,
  voicemail: Voicemail,
  meeting: Calendar,
  manual: PenLine,
  telegram: MessageCircle,
  other: Inbox,
};

const SOURCE_LABEL: Record<string, string> = {
  email: "Email",
  slack: "Slack",
  teams: "Teams",
  sms: "SMS",
  voicemail: "Voicemail",
  meeting: "Meeting",
  manual: "Manual",
  telegram: "Telegram",
  other: "Other",
};

export default function ItemCard({
  severity,
  title,
  href,
  category,
  amount,
  deadline,
  source,
  secondary,
  tag,
  rank,
  children,
}: {
  severity: Severity;
  title: string;
  href?: string;
  category?: string | null;
  amount?: number | null;
  deadline?: string | null;
  source?: ItemCardSource;
  secondary?: string | null;
  tag?: { label: string; tone?: Severity } | null;
  rank?: number;
  children?: React.ReactNode;
}) {
  const SourceIcon = source ? SOURCE_ICON[source] ?? AlertTriangle : null;
  const due = dueLabel(deadline);
  const amountLabel = formatUsd(amount ?? null);

  const inner = (
    <div className="relative pl-4 pr-3 py-2.5 hover:bg-hover/40 transition-colors group">
      <span
        className={cn(
          "absolute left-0 top-2 bottom-2 w-[3px] rounded-full",
          STRIPE_BG[severity],
          severity === "urgent" && "urgent-stripe",
        )}
      />
      <div className="flex items-start gap-3 min-w-0">
        {typeof rank === "number" && (
          <div className="w-6 shrink-0 text-text-tertiary font-mono text-xs leading-5 text-right">
            {rank}
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-start justify-between gap-2 min-w-0">
            <div className="text-[13px] text-text-primary leading-snug truncate">
              {title}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {tag && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] uppercase tracking-wider h-5 px-1.5",
                    tag.tone === "urgent" && "border-urgent/40 text-urgent",
                    tag.tone === "warning" && "border-warning/40 text-warning",
                    tag.tone === "ok" && "border-ok/40 text-ok",
                  )}
                >
                  {tag.label}
                </Badge>
              )}
              {category && (
                <Badge
                  variant="outline"
                  className="text-[10px] uppercase tracking-wider h-5 px-1.5 text-text-secondary"
                >
                  {category.replace(/_/g, " ")}
                </Badge>
              )}
            </div>
          </div>
          {(amountLabel || due || SourceIcon) && (
            <div className="flex items-center gap-2 text-[11px] text-text-secondary">
              {amountLabel && (
                <span className="font-mono text-text-primary">{amountLabel}</span>
              )}
              {amountLabel && (due || SourceIcon) && (
                <span className="text-text-tertiary">·</span>
              )}
              {due && (
                <span
                  className={cn(
                    due.startsWith("Overdue") && "text-urgent",
                  )}
                >
                  {due}
                </span>
              )}
              {due && SourceIcon && <span className="text-text-tertiary">·</span>}
              {SourceIcon && source && (
                <span className="inline-flex items-center gap-1">
                  <SourceIcon className="size-3" />
                  <span>{SOURCE_LABEL[source] ?? source}</span>
                </span>
              )}
            </div>
          )}
          {secondary && (
            <div className="text-[11px] text-text-tertiary truncate">
              {secondary}
            </div>
          )}
        </div>
        {children && (
          <div className="shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            {children}
          </div>
        )}
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="block focus:outline-none focus:bg-hover/40">
      {inner}
    </Link>
  ) : (
    inner
  );
}
