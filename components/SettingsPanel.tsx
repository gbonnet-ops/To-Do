"use client";

import { useState } from "react";
import { Deal, Task } from "@/lib/types";
import { COLOR_PALETTE } from "@/lib/constants";

interface SettingsPanelProps {
  deals: Deal[];
  tasks: Task[];
  mobile: boolean;
  onAddDeal: (name: string, color: string) => void;
  onRemoveDeal: (name: string) => void;
}

export default function SettingsPanel({ deals, tasks, mobile, onAddDeal, onRemoveDeal }: SettingsPanelProps) {
  const [newDealName, setNewDealName] = useState("");
  const [newDealColor, setNewDealColor] = useState(COLOR_PALETTE[deals.length % COLOR_PALETTE.length]);

  return (
    <div
      className="rounded-[10px] mb-3.5"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        padding: "14px",
      }}
    >
      <div
        className="uppercase tracking-[0.5px] mb-2.5"
        style={{ fontSize: "11px", fontWeight: 500, color: "#52525B" }}
      >
        Gérer les projets
      </div>

      {/* Current deals */}
      <div className="flex flex-col gap-1 mb-3">
        {deals.map((d) => {
          const taskCount = tasks.filter((t) => t.deal === d.name && !t.done).length;
          return (
            <div
              key={d.name}
              className="flex items-center gap-2 rounded-md"
              style={{ padding: "6px 8px", background: "rgba(255,255,255,0.02)" }}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
              <span className="flex-1" style={{ fontSize: "13px", color: "#CBD5E1" }}>{d.name}</span>
              <span style={{ fontSize: "10px", color: "#3F3F46" }}>
                {taskCount > 0 ? `${taskCount} tâche${taskCount > 1 ? "s" : ""}` : ""}
              </span>
              <div
                onClick={() => onRemoveDeal(d.name)}
                className="w-[22px] h-[22px] rounded-[5px] cursor-pointer flex items-center justify-center"
                style={{ fontSize: "10px", color: "#52525B", opacity: taskCount > 0 ? 0.3 : 0.6 }}
              >
                ✕
              </div>
            </div>
          );
        })}
      </div>

      {/* Add new deal */}
      <div className="flex gap-1.5 items-center">
        <input
          value={newDealName}
          onChange={(e) => setNewDealName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newDealName.trim()) {
              onAddDeal(newDealName, newDealColor);
              setNewDealName("");
            }
          }}
          placeholder="Nouveau projet..."
          className="flex-1 rounded-md font-[inherit] min-w-0 outline-none"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
            color: "#CBD5E1",
            fontSize: "13px",
            padding: "7px 10px",
          }}
        />
        <div className="flex gap-[3px] flex-shrink-0">
          {COLOR_PALETTE.slice(0, mobile ? 6 : 8).map((c) => (
            <div
              key={c}
              onClick={() => setNewDealColor(c)}
              className="cursor-pointer rounded transition-all duration-100"
              style={{
                width: 18, height: 18,
                background: c,
                opacity: newDealColor === c ? 1 : 0.3,
                border: newDealColor === c ? "2px solid #FFF" : "2px solid transparent",
              }}
            />
          ))}
        </div>
        <div
          onClick={() => {
            if (newDealName.trim()) {
              onAddDeal(newDealName, newDealColor);
              setNewDealName("");
            }
          }}
          className="cursor-pointer rounded-md"
          style={{
            padding: "6px 12px",
            fontSize: "12px",
            color: newDealName.trim() ? "#34D399" : "#27272A",
            background: newDealName.trim() ? "rgba(52,211,153,0.1)" : "transparent",
          }}
        >
          +
        </div>
      </div>
    </div>
  );
}
