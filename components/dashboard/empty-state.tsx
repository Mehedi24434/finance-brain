export default function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-3 py-6 text-center space-y-1.5">
      <div className="text-sm text-text-secondary">{title}</div>
      {hint && <div className="text-xs text-text-tertiary">{hint}</div>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
