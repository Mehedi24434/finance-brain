import MemoryTabs from "./memory-tabs";
import NotesTable from "./notes-table";
import PeopleTable from "./people-table";
import ConcernsTable from "./concerns-table";

export const dynamic = "force-dynamic";

export default function MemoryPage() {
  return (
    <div className="p-4 lg:p-6 space-y-3">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Memory</h1>
        <p className="text-text-tertiary text-xs">
          Read-only view of Luke&rsquo;s persistent context. Manage via Supabase Studio.
        </p>
      </div>
      <MemoryTabs
        notes={<NotesTable />}
        people={<PeopleTable />}
        concerns={<ConcernsTable />}
      />
    </div>
  );
}
