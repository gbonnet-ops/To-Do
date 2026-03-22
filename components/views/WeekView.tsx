"use client";

import { Task, CalendarEvent } from "@/lib/types";
import { getWeekDays } from "@/lib/utils";
import TaskRow from "@/components/TaskRow";
import MeetingCard from "@/components/MeetingCard";

interface WeekViewProps {
  tasks: Task[];
  calEvents: CalendarEvent[];
  weekOffset: number;
  setWeekOffset: (fn: (w: number) => number) => void;
  deals: string[];
  dealDot: Record<string, string>;
  mobile: boolean;
  pushingId: string | null;
  recentAssignees: string[];
  calLoading: boolean;
  onRefreshContexts: () => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onChangeDeal: (id: string, deal: string) => void;
  onChangePriority: (id: string, priority: string) => void;
  onChangeAssignee: (id: string, name: string | null) => void;
  onChangeDeadline?: (id: string, deadline: string | null) => void;
  onNotifyAssignee?: (id: string) => void;
  slackConnected?: boolean;
}

export default function WeekView({
  tasks, calEvents, weekOffset, setWeekOffset, deals, dealDot, mobile,
  pushingId, recentAssignees, calLoading, onRefreshContexts,
  onToggle, onDelete, onEdit, onChangeDeal, onChangePriority, onChangeAssignee, onChangeDeadline,
  onNotifyAssignee, slackConnected,
}: WeekViewProps) {
  const weekDays = getWeekDays(weekOffset);
  const openTasks = tasks.filter((t) => !t.done);
  const overdue = weekOffset === 0 ? openTasks.filter((t) => t.deadline && t.deadline < weekDays[0].date) : [];
  const noDate = weekOffset === 0 ? openTasks.filter((t) => !t.deadline) : [];
  const weekLabel =
    weekOffset === 0 ? "Cette semaine" :
    weekOffset === 1 ? "Semaine prochaine" :
    weekOffset === -1 ? "Semaine dernière" :
    `Semaine du ${weekDays[0].day} ${weekDays[0].month}`;

  const taskRowProps = {
    onToggle, onDelete, onEdit, onChangeDeal, onChangePriority,
    onChangeAssignee, onChangeDeadline, onNotifyAssignee, slackConnected,
    pushingId, recentAssignees, mobile, deals, dealDot,
  };

  return (
    <>
      {/* Header with nav */}
      <div className="flex items-center justify-between" style={{ padding: "14px 0 8px" }}>
        <div className="flex items-center gap-3">
          <div
            onClick={() => setWeekOffset((w) => w - 1)}
            className="cursor-pointer flex items-center justify-center rounded-md"
            style={{ width: 28, height: 28, fontSize: "14px", color: "#52525B", background: "rgba(255,255,255,0.03)" }}
          >
            ‹
          </div>
          <span style={{ fontSize: "12px", fontWeight: 500, color: "#64748B" }}>
            {weekLabel}{" "}
            <span style={{ color: "#3F3F46", fontWeight: 400 }}>
              · {weekDays[0].day}–{weekDays[6].day} {weekDays[6].month}
            </span>
          </span>
          <div
            onClick={() => setWeekOffset((w) => w + 1)}
            className="cursor-pointer flex items-center justify-center rounded-md"
            style={{ width: 28, height: 28, fontSize: "14px", color: "#52525B", background: "rgba(255,255,255,0.03)" }}
          >
            ›
          </div>
        </div>
        <div className="flex items-center gap-2">
          {weekOffset !== 0 && (
            <span
              onClick={() => setWeekOffset(() => 0)}
              className="cursor-pointer rounded-[5px]"
              style={{ fontSize: "11px", color: "#818CF8", padding: "4px 8px", background: "rgba(129,140,248,0.08)" }}
            >
              Aujourd&apos;hui
            </span>
          )}
          <span
            onClick={!calLoading ? onRefreshContexts : undefined}
            className="cursor-pointer rounded-[5px] transition-all duration-150"
            style={{
              fontSize: "11px",
              padding: "4px 8px",
              color: calLoading ? "#FBBF24" : "#52525B",
              background: calLoading ? "rgba(251,191,36,0.08)" : "rgba(255,255,255,0.04)",
              cursor: calLoading ? "wait" : "pointer",
            }}
            title="Actualiser les contextes"
          >
            {calLoading ? "⏳" : "🔄"}
          </span>
        </div>
      </div>

      {/* Overdue section */}
      {overdue.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-1.5" style={{ fontSize: "11px", fontWeight: 500, color: "#F87171", padding: "8px 0 6px" }}>
            En retard <span style={{ opacity: 0.6 }}>{overdue.length}</span>
          </div>
          {overdue
            .sort((a, b) => (a.deadline || "").localeCompare(b.deadline || ""))
            .map((task) => (
              <TaskRow key={task.id} task={task} {...taskRowProps} />
            ))}
        </div>
      )}

      {/* Day rows */}
      {weekDays.map(({ label, date, day, isToday: isTodayDay }) => {
        const dayTasks = openTasks
          .filter((t) => t.deadline === date)
          .sort((a, b) => {
            const po: Record<string, number> = { high: 0, medium: 1, low: 2 };
            return po[a.priority] - po[b.priority];
          });
        const dayMeetings = calEvents.filter((e) => e.date === date);
        const hasContent = dayTasks.length > 0 || dayMeetings.length > 0;

        return (
          <div key={date} className="mb-0.5">
            {/* Day header */}
            <div
              className="flex items-center gap-2"
              style={{ padding: "10px 0 6px", borderTop: "1px solid rgba(255,255,255,0.03)" }}
            >
              <span style={{ fontSize: "12px", fontWeight: 600, color: isTodayDay ? "#818CF8" : "#52525B" }}>
                {label}
              </span>
              <span style={{ fontSize: "11px", fontWeight: 400, color: isTodayDay ? "#818CF8" : "#3F3F46" }}>
                {day}
              </span>
              {isTodayDay && <span className="w-1 h-1 rounded-full" style={{ background: "#818CF8" }} />}
              {dayTasks.length > 0 && (
                <span style={{ fontSize: "10px", color: "#27272A", marginLeft: "auto" }}>
                  {dayTasks.length} tâche{dayTasks.length > 1 ? "s" : ""}
                </span>
              )}
              {dayMeetings.length > 0 && (
                <span style={{ fontSize: "10px", color: "#27272A", marginLeft: dayTasks.length > 0 ? "0" : "auto" }}>
                  {dayMeetings.length} meeting{dayMeetings.length > 1 ? "s" : ""}
                </span>
              )}
            </div>

            {!hasContent && (
              <div style={{ padding: "4px 0 4px 28px", fontSize: "11px", color: "#1C1C1E" }}>—</div>
            )}

            {/* Desktop: two columns */}
            {hasContent && !mobile && (
              <div className="flex gap-4">
                <div className="flex-1 min-w-0">
                  {dayTasks.map((task) => (
                    <TaskRow key={task.id} task={task} {...taskRowProps} />
                  ))}
                  {dayTasks.length === 0 && dayMeetings.length > 0 && (
                    <div style={{ padding: "8px 0", fontSize: "11px", color: "#1C1C1E", fontStyle: "italic" }}>
                      Aucune tâche
                    </div>
                  )}
                </div>
                {dayMeetings.length > 0 && (
                  <div className="w-[380px] flex-shrink-0" style={{ borderLeft: "1px solid rgba(255,255,255,0.04)", paddingLeft: "16px" }}>
                    {dayMeetings.map((e, i) => {
                      const evDot = e.deal && e.deal !== "_unmatched" ? dealDot[e.deal] || "#64748B" : "#3F3F46";
                      return (
                        <MeetingCard key={`cal-${i}`} event={e} dotColor={evDot} mobile={false} />
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Mobile: stacked */}
            {hasContent && mobile && (
              <>
                {dayTasks.map((task) => (
                  <TaskRow key={task.id} task={task} {...taskRowProps} />
                ))}
                {dayMeetings.map((e, i) => {
                  const evDot = e.deal && e.deal !== "_unmatched" ? dealDot[e.deal] || "#64748B" : "#3F3F46";
                  return (
                    <MeetingCard key={`cal-${i}`} event={e} dotColor={evDot} mobile={true} />
                  );
                })}
              </>
            )}
          </div>
        );
      })}

      {/* No date section */}
      {noDate.length > 0 && (
        <div className="mt-2">
          <div
            className="flex items-center gap-2"
            style={{ padding: "10px 0 6px", borderTop: "1px solid rgba(255,255,255,0.03)" }}
          >
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#3F3F46" }}>Sans date</span>
            <span style={{ fontSize: "10px", color: "#27272A" }}>{noDate.length}</span>
          </div>
          {noDate.map((task) => (
            <TaskRow key={task.id} task={task} {...taskRowProps} />
          ))}
        </div>
      )}
    </>
  );
}
