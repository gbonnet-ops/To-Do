"use client";

import { Task } from "@/lib/types";
import TaskRow from "@/components/TaskRow";

interface AllViewProps {
  tasks: Task[];
  showDone: boolean;
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
}

export default function AllView({
  tasks, showDone, deals, dealDot, mobile, pushingId, recentAssignees,
  onToggle, onDelete, onEdit, onChangeDeal, onChangePriority, onChangeAssignee, onChangeDeadline,
}: AllViewProps) {
  const display = showDone ? tasks : tasks.filter((t) => !t.done);

  const taskRowProps = {
    onToggle, onDelete, onEdit, onChangeDeal, onChangePriority,
    onChangeAssignee, onChangeDeadline, pushingId, recentAssignees, mobile, deals, dealDot,
  };

  if (display.filter((t) => !t.done).length === 0 && !showDone) {
    return (
      <div className="text-center py-12" style={{ color: "#27272A" }}>
        <div style={{ fontSize: "13px", fontWeight: 500 }}>Aucune tâche</div>
        <div style={{ fontSize: "12px", marginTop: "6px", color: "#1C1C1E" }}>
          Ajoute avec le champ ci-dessus
        </div>
      </div>
    );
  }

  return (
    <>
      {display.map((task) => (
        <TaskRow key={task.id} task={task} {...taskRowProps} />
      ))}
    </>
  );
}
