import { Suspense } from "react";
import HeroLine from "@/components/dashboard/hero-line";
import DailyBriefingPanel from "@/components/dashboard/panels/daily-briefing-panel";
import UrgentRisksPanel from "@/components/dashboard/panels/urgent-risks-panel";
import PendingApprovalsPanel from "@/components/dashboard/panels/pending-approvals-panel";
import ProcurementFollowupsPanel from "@/components/dashboard/panels/procurement-followups-panel";
import TreasuryAlertsPanel from "@/components/dashboard/panels/treasury-alerts-panel";
import VendorEscalationsPanel from "@/components/dashboard/panels/vendor-escalations-panel";
import InboxTriagePanel from "@/components/dashboard/panels/inbox-triage-panel";
import UpcomingMeetingsPanel from "@/components/dashboard/panels/upcoming-meetings-panel";
import OperationalPriorityQueuePanel from "@/components/dashboard/panels/operational-priority-queue-panel";
import ExecutiveRemindersPanel from "@/components/dashboard/panels/executive-reminders-panel";
import UnresolvedTasksTable from "@/components/dashboard/panels/unresolved-tasks-table";
import PanelSkeleton from "@/components/dashboard/panel-skeleton";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <div className="p-4 lg:p-6 space-y-4">
      <Suspense fallback={null}>
        <HeroLine />
      </Suspense>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Row 1: briefing full width */}
      <div className="lg:col-span-12">
        <Suspense fallback={<PanelSkeleton title="Daily briefing" rows={3} />}>
          <DailyBriefingPanel />
        </Suspense>
      </div>

      {/* Row 2: urgent / approvals */}
      <div className="lg:col-span-6">
        <Suspense fallback={<PanelSkeleton title="Urgent risks" />}>
          <UrgentRisksPanel />
        </Suspense>
      </div>
      <div className="lg:col-span-6">
        <Suspense fallback={<PanelSkeleton title="Pending approvals" />}>
          <PendingApprovalsPanel />
        </Suspense>
      </div>

      {/* Row 3: procurement / treasury / vendor */}
      <div className="lg:col-span-4">
        <Suspense fallback={<PanelSkeleton title="Procurement followups" />}>
          <ProcurementFollowupsPanel />
        </Suspense>
      </div>
      <div className="lg:col-span-4">
        <Suspense fallback={<PanelSkeleton title="Treasury alerts" />}>
          <TreasuryAlertsPanel />
        </Suspense>
      </div>
      <div className="lg:col-span-4">
        <Suspense fallback={<PanelSkeleton title="Vendor escalations" />}>
          <VendorEscalationsPanel />
        </Suspense>
      </div>

      {/* Row 4: inbox triage / upcoming meetings */}
      <div className="lg:col-span-7">
        <Suspense fallback={<PanelSkeleton title="Inbox triage" />}>
          <InboxTriagePanel />
        </Suspense>
      </div>
      <div className="lg:col-span-5">
        <Suspense fallback={<PanelSkeleton title="Upcoming meetings" />}>
          <UpcomingMeetingsPanel />
        </Suspense>
      </div>

      {/* Row 5: priority queue / reminders */}
      <div className="lg:col-span-8">
        <Suspense fallback={<PanelSkeleton title="Operational priority queue" />}>
          <OperationalPriorityQueuePanel />
        </Suspense>
      </div>
      <div className="lg:col-span-4">
        <Suspense fallback={<PanelSkeleton title="Executive reminders" />}>
          <ExecutiveRemindersPanel />
        </Suspense>
      </div>

      {/* Row 6: unresolved tasks table */}
      <div className="lg:col-span-12">
        <Suspense fallback={<PanelSkeleton title="Unresolved tasks" rows={6} />}>
          <UnresolvedTasksTable />
        </Suspense>
      </div>
      </div>
    </div>
  );
}
