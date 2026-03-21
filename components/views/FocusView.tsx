"use client";

import { Task, CalendarEvent } from "@/lib/types";
import { todayStr } from "@/lib/utils";
import TaskRow from "@/components/TaskRow";

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
  onPushCalendar?: (id: string) => void;
}

export default function FocusView({
  tasks, calEvents, dealDot, deals, mobile, pushingId, recentAssignees,
  onToggle, onDelete, onEdit, onChangeDeal, onChangePriority, onChangeAssignee, onPushCalendar,
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
    onChangeAssignee, onPushCalendar, pushingId, recentAssignees, mobile, deals, dealDot,
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
            {g.meetings.map((e, i) => {
              const st = e.start ? new Date(e.start).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";
              const en = e.end ? new Date(e.end).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";
              return (
                <div key={`m-${i}`} className="flex items-center gap-2.5" style={{ padding: "6px 0 6px 4px" }}>
                  <div className="flex-shrink-0 rounded-sm" style={{ width: 3, height: 18, background: dot, opacity: 0.4 }} />
                  <div className="flex-1">
                    <span style={{ fontSize: "12px", color: "#64748B" }}>{e.title}</span>
                    <span style={{ fontSize: "10px", color: "#3F3F46", marginLeft: "8px" }}>
                      {st}{en ? `–${en}` : ""}
                    </span>
                  </div>
                </div>
              );
            })}

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
          {unmatchedMeetings.map((e, i) => {
            const st = e.start ? new Date(e.start).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";
            const en = e.end ? new Date(e.end).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";
            return (
              <div key={`um-${i}`} className="flex items-center gap-2.5" style={{ padding: "6px 0 6px 4px" }}>
                <div className="flex-shrink-0 rounded-sm" style={{ width: 3, height: 18, background: "#3F3F46", opacity: 0.4 }} />
                <div className="flex-1">
                  <span style={{ fontSize: "12px", color: "#64748B" }}>{e.title}</span>
                  <span style={{ fontSize: "10px", color: "#3F3F46", marginLeft: "8px" }}>
                    {st}{en ? `–${en}` : ""}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
