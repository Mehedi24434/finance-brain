import { Suspense } from "react";
import UnresolvedTasksTable from "@/components/dashboard/panels/unresolved-tasks-table";
import FilterChips from "@/components/dashboard/filter-chips";
import PanelSkeleton from "@/components/dashboard/panel-skeleton";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "waiting", label: "Waiting" },
  { value: "blocked", label: "Blocked" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const PRIORITY_OPTIONS = [
  { value: "all", label: "All" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const CATEGORY_OPTIONS = [
  { value: "all", label: "All" },
  { value: "procurement", label: "Procurement" },
  { value: "capex", label: "Capex" },
  { value: "treasury", label: "Treasury" },
  { value: "vendor", label: "Vendor" },
  { value: "close", label: "Close" },
  { value: "audit", label: "Audit" },
  { value: "operations", label: "Operations" },
  { value: "board", label: "Board" },
  { value: "compliance", label: "Compliance" },
  { value: "reporting", label: "Reporting" },
];

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    priority?: string;
    category?: string;
  }>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? "open";
  const priority = sp.priority ?? "all";
  const category = sp.category ?? "all";

  const currentParams = { status, priority, category };

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <h1 className="text-lg font-semibold">Tasks</h1>

      <div className="bg-surface border border-border rounded-lg p-3 space-y-2">
        <FilterChips
          group="status"
          options={STATUS_OPTIONS}
          active={status}
          basePath="/tasks"
          currentParams={currentParams}
        />
        <FilterChips
          group="priority"
          options={PRIORITY_OPTIONS}
          active={priority}
          basePath="/tasks"
          currentParams={currentParams}
        />
        <FilterChips
          group="category"
          options={CATEGORY_OPTIONS}
          active={category}
          basePath="/tasks"
          currentParams={currentParams}
        />
      </div>

      <Suspense fallback={<PanelSkeleton title="All tasks" rows={8} />}>
        <UnresolvedTasksTable
          title="All tasks"
          pageSize={100}
          filter={{
            status,
            priority: priority === "all" ? undefined : priority,
            category: category === "all" ? undefined : category,
          }}
        />
      </Suspense>
    </div>
  );
}
