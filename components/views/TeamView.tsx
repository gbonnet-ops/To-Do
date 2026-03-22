"use client";

import { Task } from "@/lib/types";
import { isOverdue } from "@/lib/utils";
import TaskRow from "@/components/TaskRow";

interface TeamViewProps {
  tasks: Task[];
  deals: string[];
  dealDot: Record<string, string>;
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
  onNotifyAssignee?: (id: string) => void;
  slackConnected?: boolean;
}

export default function TeamView({
  tasks, deals, dealDot, mobile, pushingId, recentAssignees,
  onToggle, onDelete, onEdit, onChangeDeal, onChangePriority, onChangeAssignee, onChangeDeadline,
  onNotifyAssignee, slackConnected,
}: TeamViewProps) {
  const openTasks = tasks.filter((t) => !t.done);
  const assigned: Record<string, Task[]> = {};
  const unassigned: Task[] = [];

  openTasks.forEach((t) => {
    if (t.assignee) {
      if (!assigned[t.assignee]) assigned[t.assignee] = [];
      assigned[t.assignee].push(t);
    } else {
      unassigned.push(t);
    }
  });

  const people = Object.keys(assigned).sort();

  const taskRowProps = {
    onToggle, onDelete, onEdit, onChangeDeal, onChangePriority,
    onChangeAssignee, onChangeDeadline, onNotifyAssignee, slackConnected,
    pushingId, recentAssignees, mobile, deals, dealDot,
  };

  if (people.length === 0 && unassigned.length === 0) {
    return (
      <div className="text-center py-12" style={{ color: "#27272A" }}>
        <div style={{ fontSize: "13px", fontWeight: 500 }}>Aucune tâche</div>
      </div>
    );
  }

  return (
    <>
      <div
        className="uppercase tracking-[0.5px]"
        style={{ padding: "14px 0 4px", fontSize: "10px", fontWeight: 500, color: "#27272A" }}
      >
        Équipe — {people.length} personne{people.length > 1 ? "s" : ""}
      </div>

      {people.map((person) => {
        const pts = assigned[person].sort((a, b) => {
          const po: Record<string, number> = { high: 0, medium: 1, low: 2 };
          return po[a.priority] - po[b.priority];
        });
        const highCount = pts.filter((t) => t.priority === "high").length;
        const overdueCount = pts.filter((t) => isOverdue(t.deadline)).length;

        return (
          <div key={person} className="mb-2">
            <div
              className="flex items-center gap-2"
              style={{ padding: "12px 0 6px", borderTop: "1px solid rgba(255,255,255,0.03)" }}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(129,140,248,0.15)", color: "#818CF8", fontSize: "11px", fontWeight: 600 }}
              >
                {person[0].toUpperCase()}
              </div>
              <span style={{ fontSize: "13px", fontWeight: 500, color: "#CBD5E1" }}>{person}</span>
              <span className="ml-auto" style={{ fontSize: "10px", color: "#3F3F46" }}>
                {pts.length} tâche{pts.length > 1 ? "s" : ""}
              </span>
              {overdueCount > 0 && (
                <span style={{ fontSize: "10px", color: "#F87171", fontWeight: 500 }}>{overdueCount} retard</span>
              )}
              {highCount > 0 && (
                <span style={{ fontSize: "10px", color: "#F87171" }}>▲{highCount}</span>
              )}
            </div>
            {pts.map((task) => (
              <TaskRow key={task.id} task={task} {...taskRowProps} />
            ))}
          </div>
        );
      })}

      {/* Unassigned */}
      {unassigned.length > 0 && (
        <div className="mt-2">
          <div
            className="flex items-center gap-2"
            style={{ padding: "12px 0 6px", borderTop: "1px solid rgba(255,255,255,0.03)" }}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.04)", color: "#3F3F46", fontSize: "11px" }}
            >
              ?
            </div>
            <span style={{ fontSize: "13px", fontWeight: 500, color: "#52525B" }}>Non assignées</span>
            <span className="ml-auto" style={{ fontSize: "10px", color: "#3F3F46" }}>{unassigned.length}</span>
          </div>
          {unassigned.map((task) => (
            <TaskRow key={task.id} task={task} {...taskRowProps} />
          ))}
        </div>
      )}
    </>
  );
}
