"use client";

import { useState, useEffect } from "react";
import { Deal, Task } from "@/lib/types";
import { COLOR_PALETTE } from "@/lib/constants";

interface SettingsPanelProps {
  deals: Deal[];
  tasks: Task[];
  mobile: boolean;
  onAddDeal: (name: string, color: string, company: string) => void;
  onRemoveDeal: (name: string) => void;
  onUpdateDealCompany: (name: string, company: string) => void;
}

export default function SettingsPanel({ deals, tasks, mobile, onAddDeal, onRemoveDeal, onUpdateDealCompany }: SettingsPanelProps) {
  const [newDealName, setNewDealName] = useState("");
  const [newDealCompany, setNewDealCompany] = useState("");
  const [newDealColor, setNewDealColor] = useState(COLOR_PALETTE[deals.length % COLOR_PALETTE.length]);
  const [editingCompany, setEditingCompany] = useState<string | null>(null);
  const [editCompanyValue, setEditCompanyValue] = useState("");
  const [slackConnected, setSlackConnected] = useState(false);
  const [slackTeam, setSlackTeam] = useState<string | null>(null);
  const [slackLoading, setSlackLoading] = useState(false);

  useEffect(() => {
    fetch("/api/slack/status")
      .then((r) => r.json())
      .then((d) => {
        setSlackConnected(d.connected);
        setSlackTeam(d.team);
      })
      .catch(() => {});
  }, []);

  const disconnectSlack = async () => {
    setSlackLoading(true);
    try {
      await fetch("/auth/slack", { method: "POST" });
      setSlackConnected(false);
      setSlackTeam(null);
    } catch {}
    setSlackLoading(false);
  };

  const submitNewDeal = () => {
    if (newDealName.trim()) {
      onAddDeal(newDealName, newDealColor, newDealCompany);
      setNewDealName("");
      setNewDealCompany("");
    }
  };

  const startEditCompany = (d: Deal) => {
    setEditingCompany(d.name);
    setEditCompanyValue(d.company || "");
  };

  const saveCompany = (dealName: string) => {
    onUpdateDealCompany(dealName, editCompanyValue);
    setEditingCompany(null);
  };

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
          const isEditing = editingCompany === d.name;
          return (
            <div key={d.name}>
              <div
                className="flex items-center gap-2 rounded-md"
                style={{ padding: "6px 8px", background: "rgba(255,255,255,0.02)" }}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                <div className="flex-1 min-w-0">
                  <span style={{ fontSize: "13px", color: "#CBD5E1" }}>{d.name}</span>
                  {d.company && !isEditing && (
                    <span
                      onClick={() => startEditCompany(d)}
                      className="cursor-pointer"
                      style={{ fontSize: "10px", color: "#52525B", marginLeft: "6px" }}
                    >
                      {d.company}
                    </span>
                  )}
                  {!d.company && !isEditing && (
                    <span
                      onClick={() => startEditCompany(d)}
                      className="cursor-pointer"
                      style={{ fontSize: "10px", color: "#27272A", marginLeft: "6px", fontStyle: "italic" }}
                    >
                      + entreprise
                    </span>
                  )}
                </div>
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
              {isEditing && (
                <div className="flex gap-1.5 items-center" style={{ padding: "4px 8px 4px 24px" }}>
                  <input
                    value={editCompanyValue}
                    onChange={(e) => setEditCompanyValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveCompany(d.name);
                      if (e.key === "Escape") setEditingCompany(null);
                    }}
                    autoFocus
                    placeholder="Nom de l'entreprise..."
                    className="flex-1 rounded-md font-[inherit] min-w-0 outline-none"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "#CBD5E1",
                      fontSize: "11px",
                      padding: "4px 8px",
                    }}
                  />
                  <div
                    onClick={() => saveCompany(d.name)}
                    className="cursor-pointer rounded-[4px]"
                    style={{ padding: "2px 8px", fontSize: "10px", color: "#34D399", background: "rgba(52,211,153,0.08)" }}
                  >
                    OK
                  </div>
                  <div
                    onClick={() => setEditingCompany(null)}
                    className="cursor-pointer"
                    style={{ fontSize: "10px", color: "#52525B", padding: "2px 4px" }}
                  >
                    ✕
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add new deal */}
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-1.5 items-center">
          <input
            value={newDealName}
            onChange={(e) => setNewDealName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newDealName.trim()) submitNewDeal();
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
            onClick={submitNewDeal}
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
        {newDealName.trim() && (
          <input
            value={newDealCompany}
            onChange={(e) => setNewDealCompany(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitNewDeal();
            }}
            placeholder="Entreprise (optionnel, ex: Société Dupont SA)..."
            className="rounded-md font-[inherit] min-w-0 outline-none"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.05)",
              color: "#94A3B8",
              fontSize: "11px",
              padding: "5px 10px",
            }}
          />
        )}
      </div>

      {/* Integrations */}
      <div
        className="uppercase tracking-[0.5px] mt-4 mb-2"
        style={{ fontSize: "11px", fontWeight: 500, color: "#52525B" }}
      >
        Intégrations
      </div>

      <div className="flex items-center gap-2 rounded-md" style={{ padding: "6px 8px", background: "rgba(255,255,255,0.02)" }}>
        <span style={{ fontSize: "13px" }}>💬</span>
        <span className="flex-1" style={{ fontSize: "13px", color: "#CBD5E1" }}>
          Slack
          {slackConnected && slackTeam && (
            <span style={{ fontSize: "10px", color: "#52525B", marginLeft: "6px" }}>{slackTeam}</span>
          )}
        </span>
        {slackConnected ? (
          <div
            onClick={!slackLoading ? disconnectSlack : undefined}
            className="cursor-pointer rounded-[5px]"
            style={{
              padding: "3px 8px",
              fontSize: "10px",
              color: "#F87171",
              background: "rgba(248,113,113,0.08)",
              opacity: slackLoading ? 0.5 : 1,
            }}
          >
            Déconnecter
          </div>
        ) : (
          <a
            href="/auth/slack"
            className="rounded-[5px] no-underline"
            style={{
              padding: "3px 8px",
              fontSize: "10px",
              color: "#34D399",
              background: "rgba(52,211,153,0.08)",
            }}
          >
            Connecter
          </a>
        )}
      </div>
      <div style={{ fontSize: "10px", color: "#27272A", marginTop: "4px", paddingLeft: "8px" }}>
        {slackConnected
          ? "Slack est utilisé pour enrichir les contextes meetings"
          : "Connecte Slack pour ajouter tes messages aux contextes meetings"
        }
      </div>
    </div>
  );
}
