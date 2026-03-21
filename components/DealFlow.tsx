"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Task, Deal, CalendarEvent, StatusMessage, ViewType } from "@/lib/types";
import { DEFAULT_DEALS } from "@/lib/constants";
import { uid, todayStr, isOverdue, isToday, greet } from "@/lib/utils";
import { loadTasks, saveTasks, loadDeals, saveDeals } from "@/lib/store";
import QuickAdd from "./QuickAdd";
import SettingsPanel from "./SettingsPanel";
import FocusView from "./views/FocusView";
import AllView from "./views/AllView";
import WeekView from "./views/WeekView";
import TeamView from "./views/TeamView";

function useIsMobile() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const h = () => setM(window.innerWidth < 600);
    h();
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return m;
}

export default function DealFlow() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [deals, setDeals] = useState<Deal[]>(DEFAULT_DEALS);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  const [deal, setDeal] = useState("Tous");
  const [view, setView] = useState<ViewType>("focus");
  const [showDone, setShowDone] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [calEvents] = useState<CalendarEvent[]>([]);
  const [pushingId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<StatusMessage | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const mobile = useIsMobile();

  // Derived
  const DEALS = deals.map((d) => d.name);
  const DEAL_DOT: Record<string, string> = Object.fromEntries(deals.map((d) => [d.name, d.color]));

  // Load data
  useEffect(() => {
    const t = loadTasks();
    const d = loadDeals();
    setTasks(t);
    setDeals(d);
    setLoading(false);
    setTimeout(() => { initialized.current = true; }, 50);
  }, []);

  // Persist
  useEffect(() => { if (initialized.current) saveTasks(tasks); }, [tasks]);
  useEffect(() => { if (initialized.current) saveDeals(deals); }, [deals]);

  // Recent assignees
  const recentAssignees = [...new Set(tasks.map((t) => t.assignee).filter(Boolean))] as string[];

  // Task operations
  const addTask = useCallback((text: string, dealName: string, priority: "high" | "medium" | "low", deadline: string | null, assignee: string | null) => {
    setTasks((p) => [{
      id: uid(), text, deal: dealName, priority, deadline, assignee,
      done: false, created_at: new Date().toISOString(),
    }, ...p]);
  }, []);

  const toggle = useCallback((id: string) => setTasks((p) => p.map((t) => t.id === id ? { ...t, done: !t.done } : t)), []);
  const del = useCallback((id: string) => setTasks((p) => p.filter((t) => t.id !== id)), []);
  const edit = useCallback((id: string, text: string) => setTasks((p) => p.map((t) => t.id === id ? { ...t, text } : t)), []);
  const changeDeal = useCallback((id: string, newDeal: string) => setTasks((p) => p.map((t) => t.id === id ? { ...t, deal: newDeal } : t)), []);
  const changePri = useCallback((id: string, newPri: string) => setTasks((p) => p.map((t) => t.id === id ? { ...t, priority: newPri as Task["priority"] } : t)), []);
  const changeAssignee = useCallback((id: string, name: string | null) => setTasks((p) => p.map((t) => t.id === id ? { ...t, assignee: name || null } : t)), []);
  const clearDone = useCallback(() => setTasks((p) => p.filter((t) => !t.done)), []);

  // Deal management
  const addDeal = useCallback((name: string, color: string) => {
    if (!name.trim() || deals.some((d) => d.name.toLowerCase() === name.trim().toLowerCase())) return;
    setDeals((p) => [...p, { name: name.trim(), color }]);
  }, [deals]);

  const removeDeal = useCallback((name: string) => {
    if (tasks.some((t) => t.deal === name && !t.done)) {
      setStatusMsg({ type: "error", text: `"${name}" a des tâches ouvertes — complète-les ou change leur deal d'abord` });
      setTimeout(() => setStatusMsg(null), 4000);
      return;
    }
    setDeals((p) => p.filter((d) => d.name !== name));
    if (deal === name) setDeal("Tous");
  }, [tasks, deal]);

  // Filtering & sorting
  const filtered = tasks.filter((t) => deal === "Tous" || t.deal === deal);
  const focus = filtered.filter((t) => !t.done && (t.priority === "high" || isOverdue(t.deadline) || isToday(t.deadline)));

  const sorted = [...(view === "focus" ? focus : filtered)].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const p: Record<string, number> = { high: 0, medium: 1, low: 2 };
    if (p[a.priority] !== p[b.priority]) return p[a.priority] - p[b.priority];
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return 0;
  });

  const doneCount = tasks.filter((t) => t.done).length;
  const overdueN = tasks.filter((t) => !t.done && isOverdue(t.deadline)).length;
  const todayN = tasks.filter((t) => !t.done && isToday(t.deadline)).length;
  const openN = tasks.filter((t) => !t.done).length;

  const px = mobile ? "16px" : "28px";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0A0A0B", fontFamily: "system-ui", color: "#818CF8" }}>
        <div style={{ fontSize: "13px", fontWeight: 500, opacity: 0.6 }}>Chargement...</div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: "#0A0A0B",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
        color: "#E2E8F0",
      }}
    >
      {/* ── HEADER ── */}
      <div style={{ padding: `20px ${px} 16px`, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="flex justify-between items-start mb-5">
          <div>
            <div style={{ fontSize: mobile ? "16px" : "18px", fontWeight: 600, color: "#F1F5F9", letterSpacing: "-0.3px" }}>
              DealFlow
            </div>
            <div style={{ fontSize: "12px", color: "#3F3F46", marginTop: "3px" }}>
              {greet()} Grégoire
            </div>
          </div>
          <div
            onClick={() => setShowSettings(!showSettings)}
            className="cursor-pointer flex items-center justify-center rounded-md transition-all duration-100"
            style={{
              width: 28, height: 28,
              fontSize: "13px",
              color: showSettings ? "#818CF8" : "#3F3F46",
              background: showSettings ? "rgba(129,140,248,0.1)" : "transparent",
            }}
          >
            ⚙
          </div>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <SettingsPanel
            deals={deals}
            tasks={tasks}
            mobile={mobile}
            onAddDeal={addDeal}
            onRemoveDeal={removeDeal}
          />
        )}

        {/* Stats */}
        <div className="flex gap-4 mb-3 items-center flex-wrap" style={{ fontSize: "12px" }}>
          <span style={{ color: "#64748B" }}>{openN} ouvertes</span>
          {overdueN > 0 && <span style={{ color: "#F87171" }}>{overdueN} en retard</span>}
          {todayN > 0 && <span style={{ color: "#FBBF24" }}>{todayN} aujourd&apos;hui</span>}
        </div>

        {/* Status message */}
        {statusMsg && (
          <div
            className="flex items-start justify-between gap-2 mb-2.5 rounded-lg"
            style={{
              padding: "8px 12px",
              fontSize: "11px",
              fontWeight: 500,
              background: statusMsg.type === "error" ? "rgba(248,113,113,0.08)" : statusMsg.type === "ok" ? "rgba(52,211,153,0.08)" : "rgba(129,140,248,0.08)",
              color: statusMsg.type === "error" ? "#F87171" : statusMsg.type === "ok" ? "#34D399" : "#818CF8",
              border: `1px solid ${statusMsg.type === "error" ? "rgba(248,113,113,0.15)" : statusMsg.type === "ok" ? "rgba(52,211,153,0.15)" : "rgba(129,140,248,0.15)"}`,
              maxHeight: "120px",
              overflow: "auto",
            }}
          >
            <span className="break-all flex-1" style={{ lineHeight: "1.5" }}>
              {statusMsg.type === "error" ? "⚠ " : statusMsg.type === "ok" ? "✓ " : "⏳ "}
              {statusMsg.text}
            </span>
            <span
              onClick={() => setStatusMsg(null)}
              className="cursor-pointer flex-shrink-0 mt-0.5"
              style={{ opacity: 0.5, fontSize: "10px" }}
            >
              ✕
            </span>
          </div>
        )}

        {/* Quick Add */}
        <QuickAdd
          onAdd={addTask}
          deals={DEALS}
          dealDot={DEAL_DOT}
          activeDeal={deal}
          mobile={mobile}
        />
      </div>

      {/* ── VIEW TABS + DEAL FILTER ── */}
      <div style={{ padding: `12px ${px}`, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="flex gap-0 mb-3">
          {[
            { k: "focus" as ViewType, l: "Focus", c: focus.length },
            { k: "all" as ViewType, l: "Toutes", c: filtered.filter((t) => !t.done).length },
            { k: "week" as ViewType, l: "Semaine" },
            { k: "team" as ViewType, l: "Équipe" },
          ].map(({ k, l, c }) => (
            <div
              key={k}
              onClick={() => setView(k)}
              className="cursor-pointer transition-all duration-150"
              style={{
                padding: "6px 14px",
                fontSize: "12px",
                fontWeight: view === k ? 500 : 400,
                color: view === k ? "#E2E8F0" : "#3F3F46",
                borderBottom: view === k ? "1.5px solid #818CF8" : "1.5px solid transparent",
              }}
            >
              {l} {c !== undefined && <span style={{ marginLeft: "4px", opacity: 0.5 }}>{c}</span>}
            </div>
          ))}
        </div>

        {/* Deal pills — only for focus/all */}
        {(view === "focus" || view === "all") && (
          <div className="flex gap-1 flex-wrap">
            {["Tous", ...DEALS].map((d) => {
              const active = deal === d;
              const dot = DEAL_DOT[d];
              const cnt = d === "Tous" ? openN : tasks.filter((t) => !t.done && t.deal === d).length;
              const label = mobile && d === "Job Search" ? "Job" : mobile && d === "AI Projects" ? "AI" : d;
              return (
                <div
                  key={d}
                  onClick={() => setDeal(d)}
                  className="cursor-pointer flex items-center gap-[5px] rounded-md transition-all duration-100"
                  style={{
                    padding: "4px 10px",
                    fontSize: "11px",
                    color: active ? "#E2E8F0" : "#3F3F46",
                    background: active ? "rgba(255,255,255,0.06)" : "transparent",
                  }}
                >
                  {dot && (
                    <span
                      className="w-[5px] h-[5px] rounded-full"
                      style={{ background: dot, opacity: active ? 0.8 : 0.25 }}
                    />
                  )}
                  {label}
                  {cnt > 0 && <span style={{ opacity: 0.4, fontSize: "10px" }}>{cnt}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── CONTENT ── */}
      <div className="flex-1 overflow-auto" style={{ padding: `0 ${px} 80px` }}>
        {/* Focus / All views */}
        {(view === "focus" || view === "all") && (
          <>
            <div
              className="flex justify-between uppercase tracking-[0.5px]"
              style={{ padding: "14px 0 4px", fontSize: "10px", fontWeight: 500, color: "#27272A" }}
            >
              <span>
                {view === "focus" ? `Focus — ${focus.length}` : `Toutes${deal !== "Tous" ? ` · ${deal}` : ""}`}
              </span>
              {view === "all" && doneCount > 0 && (
                <div className="flex gap-2.5">
                  <span
                    onClick={() => setShowDone(!showDone)}
                    className="cursor-pointer normal-case tracking-normal"
                    style={{ color: "#3F3F46" }}
                  >
                    {showDone ? "Masquer" : "Voir"} terminées ({doneCount})
                  </span>
                  <span
                    onClick={clearDone}
                    className="cursor-pointer normal-case tracking-normal"
                    style={{ color: "#7F1D1D" }}
                  >
                    Vider
                  </span>
                </div>
              )}
            </div>

            {view === "focus" && (
              <FocusView
                tasks={sorted}
                calEvents={calEvents}
                dealDot={DEAL_DOT}
                deals={DEALS}
                mobile={mobile}
                pushingId={pushingId}
                recentAssignees={recentAssignees}
                onToggle={toggle}
                onDelete={del}
                onEdit={edit}
                onChangeDeal={changeDeal}
                onChangePriority={changePri}
                onChangeAssignee={changeAssignee}
              />
            )}

            {view === "all" && (
              <AllView
                tasks={sorted}
                showDone={showDone}
                deals={DEALS}
                dealDot={DEAL_DOT}
                mobile={mobile}
                pushingId={pushingId}
                recentAssignees={recentAssignees}
                onToggle={toggle}
                onDelete={del}
                onEdit={edit}
                onChangeDeal={changeDeal}
                onChangePriority={changePri}
                onChangeAssignee={changeAssignee}
              />
            )}
          </>
        )}

        {/* Week view */}
        {view === "week" && (
          <WeekView
            tasks={tasks}
            calEvents={calEvents}
            weekOffset={weekOffset}
            setWeekOffset={setWeekOffset}
            deals={DEALS}
            dealDot={DEAL_DOT}
            mobile={mobile}
            pushingId={pushingId}
            recentAssignees={recentAssignees}
            onToggle={toggle}
            onDelete={del}
            onEdit={edit}
            onChangeDeal={changeDeal}
            onChangePriority={changePri}
            onChangeAssignee={changeAssignee}
          />
        )}

        {/* Team view */}
        {view === "team" && (
          <TeamView
            tasks={tasks}
            deals={DEALS}
            dealDot={DEAL_DOT}
            mobile={mobile}
            pushingId={pushingId}
            recentAssignees={recentAssignees}
            onToggle={toggle}
            onDelete={del}
            onEdit={edit}
            onChangeDeal={changeDeal}
            onChangePriority={changePri}
            onChangeAssignee={changeAssignee}
          />
        )}
      </div>
    </div>
  );
}
