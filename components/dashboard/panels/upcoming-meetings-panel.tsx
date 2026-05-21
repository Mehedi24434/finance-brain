import { format } from "date-fns";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { Calendar } from "lucide-react";
import EmptyState from "../empty-state";
import PanelShell from "../panel-shell";
import MeetingBriefSheet from "../meeting-brief-sheet";

export default async function UpcomingMeetingsPanel() {
  const db = createServiceRoleClient();
  const nowIso = new Date().toISOString();
  const { data } = await db
    .from("meeting_notes")
    .select("id, title, meeting_date, attendees, category, pre_brief")
    .gte("meeting_date", nowIso)
    .order("meeting_date", { ascending: true })
    .limit(5);

  const rows = data ?? [];

  return (
    <PanelShell
      title="Upcoming meetings"
      counter={rows.length ? `${rows.length} scheduled` : null}
    >
      {rows.length === 0 ? (
        <EmptyState title="No meetings on the calendar" />
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((m) => {
            const dt = new Date(m.meeting_date);
            const day = format(dt, "EEE MMM d");
            const time = format(dt, "p");
            const attendees =
              (m.attendees ?? []).slice(0, 3).join(", ") +
              ((m.attendees?.length ?? 0) > 3
                ? `, +${(m.attendees?.length ?? 0) - 3}`
                : "");
            return (
              <li key={m.id} className="px-3 py-2.5 hover:bg-hover/40">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="shrink-0 w-12 text-center font-mono">
                    <div className="text-[10px] uppercase tracking-wider text-text-tertiary">
                      {format(dt, "EEE")}
                    </div>
                    <div className="text-base leading-none text-text-primary">
                      {format(dt, "d")}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="text-[13px] text-text-primary truncate">
                      {m.title}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-text-secondary">
                      <Calendar className="size-3" />
                      <span>
                        {day} · {time}
                      </span>
                    </div>
                    {attendees && (
                      <div className="text-[11px] text-text-tertiary truncate">
                        {attendees}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    {m.pre_brief && (
                      <span className="text-[10px] uppercase tracking-wider font-mono text-ok">
                        Briefed
                      </span>
                    )}
                    <MeetingBriefSheet
                      meetingId={m.id}
                      meetingTitle={m.title}
                      initialPreBrief={m.pre_brief ?? null}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PanelShell>
  );
}
