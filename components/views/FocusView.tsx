"use client";

import { Task, CalendarEvent } from "@/lib/types";
import { todayStr } from "@/lib/utils";
import TaskRow from "@/components/TaskRow";
import MeetingCard from "@/components/MeetingCard";

interface FocusViewProps {
  tasks: Task[];
  calEvents: CalendarEvent[];
  dealDot: Record<string, string>;
  deals: string[];
  mobile: boolean;
  pushingId: string | null;
  recentAssignees: string[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onChangeDeal: (id: string, deal: string) => void;
  onChangePriority: (id: string, priority: string) => void;
  onChangeAssignee: (id: string, name: string | null) => void;
  onChangeDeadline?: (id: string, deadline: string | null) => void;
}

export default function FocusView({
  tasks, calEvents, dealDot, deals, mobile, pushingId, recentAssignees,
  onToggle, onDelete, onEdit, onChangeDeal, onChangePriority, onChangeAssignee, onChangeDeadline,
}: FocusViewProps) {
  const today = todayStr();
  const todayMeetings = calEvents.filter((e) => e.date === today);

  // Group focus tasks by deal
  const dealGroups: Record<string, { tasks: Task[]; meetings: CalendarEvent[] }> = {};

  tasks.filter((t) => !t.done).forEach((t) => {
    if (!dealGroups[t.deal]) dealGroups[t.deal] = { tasks: [], meetings: [] };
    dealGroups[t.deal].tasks.push(t);
  });

  // Attach meetings to their matched deal
  todayMeetings.forEach((e) => {
    const d = e.deal === "_unmatched" ? null : e.deal;
    if (d && dealGroups[d]) {
      dealGroups[d].meetings.push(e);
    } else if (d && d !== "_unmatched") {
      dealGroups[d] = { tasks: [], meetings: [e] };
    }
  });

  const unmatchedMeetings = todayMeetings.filter((e) => e.deal === "_unmatched");
  const dealOrder = Object.keys(dealGroups).sort();

  if (tasks.filter((t) => !t.done).length === 0 && todayMeetings.length === 0) {
    return (
      <div className="text-center py-12" style={{ color: "#27272A" }}>
        <div style={{ fontSize: "13px", fontWeight: 500 }}>Rien d&apos;urgent</div>
        <div style={{ fontSize: "12px", marginTop: "6px", color: "#1C1C1E" }}>
          Tâches high priority et en retard
        </div>
      </div>
    );
  }

  const taskRowProps = {
    onToggle, onDelete, onEdit, onChangeDeal, onChangePriority,
    onChangeAssignee, onChangeDeadline, pushingId, recentAssignees, mobile, deals, dealDot,
  };

  return (
    <>
      {dealOrder.map((d) => {
        const g = dealGroups[d];
        const dot = dealDot[d] || "#64748B";
        return (
          <div key={d} className="mb-2.5">
            <div
              className="flex items-center gap-1.5"
              style={{ padding: "10px 0 4px", borderTop: "1px solid rgba(255,255,255,0.03)" }}
            >
              <span className="w-[5px] h-[5px] rounded-full" style={{ background: dot }} />
              <span style={{ fontSize: "11px", fontWeight: 500, color: "#52525B" }}>{d}</span>
              <span style={{ fontSize: "10px", color: "#27272A" }}>
                {g.tasks.length} tâche{g.tasks.length > 1 ? "s" : ""}
              </span>
            </div>

            {/* Meetings for this deal */}
            {g.meetings.map((e, i) => (
              <MeetingCard key={`m-${i}`} event={e} dotColor={dot} mobile={mobile} />
            ))}

            {/* Tasks for this deal */}
            {g.tasks.map((task) => (
              <TaskRow key={task.id} task={task} {...taskRowProps} />
            ))}
          </div>
        );
      })}

      {/* Unmatched professional meetings */}
      {unmatchedMeetings.length > 0 && (
        <div className="mb-2.5">
          <div style={{ padding: "10px 0 4px", borderTop: "1px solid rgba(255,255,255,0.03)" }}>
            <span style={{ fontSize: "11px", fontWeight: 500, color: "#3F3F46" }}>Autres meetings</span>
          </div>
          {unmatchedMeetings.map((e, i) => (
            <MeetingCard key={`um-${i}`} event={e} dotColor="#3F3F46" mobile={mobile} />
          ))}
        </div>
      )}
    </>
  );
}
