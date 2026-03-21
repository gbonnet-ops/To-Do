"use client";

import { useState, useEffect, useRef } from "react";
import { Task } from "@/lib/types";
import { formatDeadline, deadlineColor } from "@/lib/utils";
import { PRIORITY_COLOR, PRIORITY_ICON, PRIORITY_LABELS } from "@/lib/constants";

interface TaskRowProps {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onChangeDeal: (id: string, deal: string) => void;
  onChangePriority: (id: string, priority: string) => void;
  onChangeAssignee: (id: string, name: string | null) => void;
  onPushCalendar?: (id: string) => void;
  pushingId: string | null;
  recentAssignees: string[];
  mobile: boolean;
  deals: string[];
  dealDot: Record<string, string>;
}

export default function TaskRow({
  task, onToggle, onDelete, onEdit, onChangeDeal, onChangePriority,
  onChangeAssignee, onPushCalendar, pushingId, recentAssignees,
  mobile, deals, dealDot,
}: TaskRowProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);
  const [hovered, setHovered] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);
  const [priOpen, setPriOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [assigneeInput, setAssigneeInput] = useState(task.assignee || "");

  const lpRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inRef = useRef<HTMLInputElement>(null);
  const dealRef = useRef<HTMLDivElement>(null);
  const priRef = useRef<HTMLDivElement>(null);
  const assigneeRef = useRef<HTMLDivElement>(null);
  const assigneeInputRef = useRef<HTMLInputElement>(null);

  const dot = dealDot[task.deal] || "#64748B";

  useEffect(() => {
    const h = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (dealRef.current && !dealRef.current.contains(target)) setDealOpen(false);
      if (priRef.current && !priRef.current.contains(target)) setPriOpen(false);
      if (assigneeRef.current && !assigneeRef.current.contains(target)) setAssigneeOpen(false);
    };
    document.addEventListener("mousedown", h);
    document.addEventListener("touchstart", h);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("touchstart", h);
    };
  }, []);

  useEffect(() => {
    if (assigneeOpen && assigneeInputRef.current) assigneeInputRef.current.focus();
  }, [assigneeOpen]);

  useEffect(() => {
    if (editing && inRef.current) inRef.current.focus();
  }, [editing]);

  const dl = formatDeadline(task.deadline);
  const dlC = deadlineColor(task.deadline);

  const handleSave = () => {
    if (editText.trim()) onEdit(task.id, editText.trim());
    setEditing(false);
  };

  const startLP = () => {
    lpRef.current = setTimeout(() => {
      setEditing(true);
      setEditText(task.text);
    }, 500);
  };
  const cancelLP = () => {
    if (lpRef.current) clearTimeout(lpRef.current);
  };

  const DealPicker = ({ position }: { position: "right" | "left" }) => (
    dealOpen ? (
      <div
        className="absolute z-60 rounded-lg p-[3px] min-w-[140px]"
        style={{
          top: "calc(100% + 4px)",
          [position]: 0,
          background: "#18181B",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        }}
      >
        {deals.map((d) => (
          <div
            key={d}
            className="cursor-pointer flex items-center gap-2 rounded-md"
            onClick={() => { onChangeDeal(task.id, d); setDealOpen(false); }}
            style={{
              padding: mobile ? "9px 12px" : "7px 10px",
              fontSize: mobile ? "13px" : "12px",
              color: d === task.deal ? "#E2E8F0" : "#71717A",
              background: d === task.deal ? "rgba(255,255,255,0.05)" : "transparent",
            }}
          >
            <span className="w-[5px] h-[5px] rounded-full" style={{ background: dealDot[d] }} />
            {d}
          </div>
        ))}
      </div>
    ) : null
  );

  const PriorityPicker = ({ position }: { position: "right" | "left" }) => (
    priOpen ? (
      <div
        className="absolute z-60 rounded-lg p-[3px] min-w-[120px]"
        style={{
          top: "calc(100% + 4px)",
          [position]: 0,
          background: "#18181B",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        }}
      >
        {(["high", "medium", "low"] as const).map((p) => (
          <div
            key={p}
            className="cursor-pointer flex items-center gap-2 rounded-md"
            onClick={() => { onChangePriority(task.id, p); setPriOpen(false); }}
            style={{
              padding: mobile ? "9px 12px" : "7px 10px",
              fontSize: mobile ? "13px" : "12px",
              color: p === task.priority ? "#E2E8F0" : "#71717A",
              background: p === task.priority ? "rgba(255,255,255,0.05)" : "transparent",
            }}
          >
            <span style={{ fontSize: "10px", color: PRIORITY_COLOR[p] }}>{PRIORITY_ICON[p]}</span>
            {PRIORITY_LABELS[p]}
          </div>
        ))}
      </div>
    ) : null
  );

  const AssigneePicker = ({ position }: { position: "right" | "left" }) => (
    assigneeOpen ? (
      <div
        className="absolute z-60 rounded-lg p-1.5 min-w-[150px]"
        style={{
          top: "calc(100% + 4px)",
          [position]: 0,
          background: "#18181B",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        }}
      >
        <input
          ref={assigneeInputRef}
          value={assigneeInput}
          onChange={(e) => setAssigneeInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { onChangeAssignee(task.id, assigneeInput.trim()); setAssigneeOpen(false); }
            if (e.key === "Escape") setAssigneeOpen(false);
          }}
          placeholder="Nom..."
          className="w-full rounded-[5px] font-[inherit]"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid #334155",
            color: "#E2E8F0",
            fontSize: mobile ? "13px" : "12px",
            padding: mobile ? "7px 8px" : "6px 8px",
            marginBottom: recentAssignees.length ? "4px" : 0,
          }}
        />
        {recentAssignees
          .filter((a) => a !== task.assignee && a.toLowerCase().includes(assigneeInput.toLowerCase()))
          .slice(0, 4)
          .map((a) => (
            <div
              key={a}
              className="cursor-pointer rounded-[5px]"
              onClick={() => { onChangeAssignee(task.id, a); setAssigneeOpen(false); }}
              style={{ padding: mobile ? "7px 8px" : "5px 8px", fontSize: mobile ? "12px" : "11px", color: "#A1A1AA" }}
            >
              {a}
            </div>
          ))}
        {task.assignee && (
          <div
            className="cursor-pointer rounded-[5px] mt-0.5"
            onClick={() => { onChangeAssignee(task.id, null); setAssigneeOpen(false); }}
            style={{ padding: mobile ? "7px 8px" : "5px 8px", fontSize: mobile ? "12px" : "11px", color: "#7F1D1D" }}
          >
            Retirer
          </div>
        )}
      </div>
    ) : null
  );

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="transition-opacity duration-200"
      style={{
        display: "flex",
        alignItems: mobile ? "flex-start" : "center",
        flexDirection: mobile ? "column" : "row",
        gap: mobile ? "6px" : "0",
        padding: mobile ? "14px 0" : "10px 0",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        opacity: task.done ? 0.3 : 1,
      }}
    >
      {/* Main line */}
      <div className="flex items-center gap-2.5 w-full">
        {/* Checkbox */}
        <div
          onClick={() => onToggle(task.id)}
          className="flex-shrink-0 cursor-pointer flex items-center justify-center transition-all duration-150"
          style={{
            width: mobile ? 22 : 18,
            height: mobile ? 22 : 18,
            borderRadius: "5px",
            border: task.done ? "none" : "1.5px solid #334155",
            background: task.done ? "#818CF8" : "transparent",
            fontSize: "10px",
            color: "#FFF",
          }}
        >
          {task.done && "✓"}
        </div>

        {/* Deal dot */}
        <span
          className="w-[5px] h-[5px] rounded-full flex-shrink-0"
          style={{ background: dot, opacity: task.done ? 0.3 : 0.7 }}
        />

        {/* Text */}
        <div
          className="flex-1 min-w-0"
          {...(mobile ? { onTouchStart: startLP, onTouchEnd: cancelLP, onTouchMove: cancelLP } : {})}
        >
          {editing ? (
            <input
              ref={inRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") setEditing(false);
              }}
              onBlur={handleSave}
              className="w-full rounded-md font-[inherit]"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid #334155",
                color: "#E2E8F0",
                fontSize: mobile ? "14px" : "13px",
                padding: "5px 8px",
              }}
            />
          ) : (
            <div
              onDoubleClick={!mobile ? () => { setEditing(true); setEditText(task.text); } : undefined}
              style={{
                fontSize: mobile ? "14px" : "13px",
                fontWeight: 400,
                color: task.done ? "#475569" : "#CBD5E1",
                textDecoration: task.done ? "line-through" : "none",
                whiteSpace: mobile ? "normal" : "nowrap",
                overflow: mobile ? "visible" : "hidden",
                textOverflow: mobile ? "unset" : "ellipsis",
                lineHeight: "1.45",
              }}
            >
              {task.text}
            </div>
          )}
        </div>

        {/* Desktop: inline metadata */}
        {!mobile && (
          <>
            <div ref={dealRef} className="relative flex-shrink-0">
              <span
                onClick={() => setDealOpen(!dealOpen)}
                className="cursor-pointer rounded transition-all duration-100"
                style={{
                  fontSize: "11px",
                  color: dealOpen ? dealDot[task.deal] : "#475569",
                  fontWeight: 400,
                  padding: "2px 6px",
                  background: dealOpen ? "rgba(255,255,255,0.05)" : "transparent",
                }}
              >
                {task.deal}
              </span>
              <DealPicker position="right" />
            </div>

            {dl && (
              <span className="flex-shrink-0" style={{ fontSize: "11px", color: dlC, fontWeight: 500 }}>
                {dl}
              </span>
            )}

            {/* Push to calendar */}
            {task.deadline && !task.done && (
              <span
                onClick={() => !task.synced && onPushCalendar?.(task.id)}
                className="flex-shrink-0 transition-opacity duration-150"
                style={{
                  fontSize: "10px",
                  cursor: task.synced ? "default" : "pointer",
                  color: task.synced ? "#34D399" : "#27272A",
                  opacity: pushingId === task.id ? 0.4 : task.synced ? 0.6 : hovered ? 0.6 : 0,
                }}
              >
                {pushingId === task.id ? "⏳" : task.synced ? "✓📅" : "📅"}
              </span>
            )}

            <div ref={priRef} className="relative flex-shrink-0">
              <span
                onClick={() => setPriOpen(!priOpen)}
                className="cursor-pointer rounded flex items-center justify-center transition-all duration-100"
                style={{
                  width: 18, height: 18,
                  fontSize: "9px",
                  color: PRIORITY_COLOR[task.priority],
                  background: priOpen ? "rgba(255,255,255,0.05)" : "transparent",
                }}
              >
                {PRIORITY_ICON[task.priority]}
              </span>
              <PriorityPicker position="right" />
            </div>

            <div ref={assigneeRef} className="relative flex-shrink-0">
              <span
                onClick={() => { setAssigneeOpen(!assigneeOpen); setAssigneeInput(task.assignee || ""); }}
                className="cursor-pointer rounded transition-all duration-100"
                style={{
                  fontSize: "11px",
                  color: task.assignee ? "#A78BFA" : "#27272A",
                  padding: "2px 6px",
                  background: assigneeOpen ? "rgba(255,255,255,0.05)" : "transparent",
                }}
              >
                {task.assignee || "+"}
              </span>
              <AssigneePicker position="right" />
            </div>
          </>
        )}

        {/* Delete */}
        <div
          onClick={() => onDelete(task.id)}
          className="w-6 h-6 rounded-md flex-shrink-0 cursor-pointer flex items-center justify-center transition-opacity duration-150"
          style={{
            fontSize: "11px",
            color: "#334155",
            opacity: mobile ? 0.5 : hovered ? 0.6 : 0,
          }}
        >
          ✕
        </div>
      </div>

      {/* Mobile: metadata line */}
      {mobile && (
        <div className="flex gap-2 ml-8 items-center flex-wrap">
          <div ref={dealRef} className="relative">
            <span
              onClick={() => setDealOpen(!dealOpen)}
              className="cursor-pointer rounded"
              style={{
                fontSize: "11px",
                color: dealOpen ? dealDot[task.deal] : "#475569",
                padding: "2px 6px",
                background: dealOpen ? "rgba(255,255,255,0.05)" : "transparent",
              }}
            >
              {task.deal}
            </span>
            <DealPicker position="left" />
          </div>

          {dl && <span style={{ fontSize: "11px", color: dlC, fontWeight: 500 }}>{dl}</span>}

          <div ref={priRef} className="relative">
            <span
              onClick={() => setPriOpen(!priOpen)}
              className="cursor-pointer rounded flex items-center gap-1"
              style={{
                fontSize: "10px",
                color: PRIORITY_COLOR[task.priority],
                padding: "2px 6px",
                background: priOpen ? "rgba(255,255,255,0.05)" : "transparent",
              }}
            >
              {PRIORITY_ICON[task.priority]}
              <span style={{ fontSize: "10px", color: "#3F3F46" }}>{PRIORITY_LABELS[task.priority]}</span>
            </span>
            <PriorityPicker position="left" />
          </div>

          <div ref={assigneeRef} className="relative">
            <span
              onClick={() => { setAssigneeOpen(!assigneeOpen); setAssigneeInput(task.assignee || ""); }}
              className="cursor-pointer rounded"
              style={{
                fontSize: "11px",
                color: task.assignee ? "#A78BFA" : "#27272A",
                padding: "2px 6px",
                background: assigneeOpen ? "rgba(255,255,255,0.05)" : "transparent",
              }}
            >
              {task.assignee || "👤"}
            </span>
            <AssigneePicker position="left" />
          </div>

          {task.deadline && !task.done && (
            <span
              onClick={() => !task.synced && onPushCalendar?.(task.id)}
              className="transition-opacity"
              style={{
                fontSize: "11px",
                cursor: task.synced ? "default" : "pointer",
                color: task.synced ? "#34D399" : "#3F3F46",
                opacity: pushingId === task.id ? 0.4 : 1,
              }}
            >
              {pushingId === task.id ? "⏳" : task.synced ? "✓📅" : "📅"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
