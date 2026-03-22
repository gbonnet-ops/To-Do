"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Task, Deal, CalendarEvent, EmailSuggestion, CompletionSuggestion, MeetingPrepSuggestion, StatusMessage, ViewType } from "@/lib/types";
import { DEFAULT_DEALS } from "@/lib/constants";
import { uid, todayStr, isOverdue, isToday, greet, getWeekDays, formatDeadline } from "@/lib/utils";
import {
  loadTasks, saveTasks, loadDeals, saveDeals,
  fetchTasks, fetchDeals,
  apiAddTask, apiUpdateTask, apiDeleteTask,
  apiAddDeal, apiUpdateDeal, apiDeleteDeal,
  loadScannedGmailIds, saveScannedGmailIds,
  loadSeenCalendarKeys, saveSeenCalendarKeys, calEventKey,
  loadCalContexts, saveCalContexts,
} from "@/lib/store";
import QuickAdd from "./QuickAdd";
import SettingsPanel from "./SettingsPanel";
import FocusView from "./views/FocusView";
import AllView from "./views/AllView";
import WeekView from "./views/WeekView";
import TeamView from "./views/TeamView";
import RecapView from "./views/RecapView";

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
  const [calEvents, setCalEvents] = useState<CalendarEvent[]>([]);
  const [calLoading, setCalLoading] = useState(false);
  const [calLastFetch, setCalLastFetch] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<EmailSuggestion[]>([]);
  const [scanLoading, setScanLoading] = useState(false);
  const [slackConnected, setSlackConnected] = useState(false);
  const [slackScanLoading, setSlackScanLoading] = useState(false);
  const [pushingId, setPushingId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<StatusMessage | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [completionSuggestions, setCompletionSuggestions] = useState<CompletionSuggestion[]>([]);
  const [meetingPreps, setMeetingPreps] = useState<MeetingPrepSuggestion[]>([]);
  const mobile = useIsMobile();

  // Derived
  const DEALS = deals.map((d) => d.name);
  const DEAL_DOT: Record<string, string> = Object.fromEntries(deals.map((d) => [d.name, d.color]));

  // ── Load data from API (source of truth), fallback to localStorage ──
  const loadFromApi = useCallback(async (): Promise<{ ok: boolean; tasks: Task[] }> => {
    try {
      const [apiTasks, apiDeals] = await Promise.all([fetchTasks(), fetchDeals()]);

      if (apiDeals.length > 0) {
        setDeals(apiDeals);
        saveDeals(apiDeals);
      } else {
        // First time: seed deals to Supabase from defaults
        const localDeals = loadDeals();
        setDeals(localDeals);
        for (let i = 0; i < localDeals.length; i++) {
          const d = localDeals[i];
          apiAddDeal({
            name: d.name,
            color: d.color,
            keywords: [d.name.toLowerCase()],
            sort_order: i,
          }).catch(() => {});
        }
      }

      setTasks(apiTasks);
      saveTasks(apiTasks);
      return { ok: true, tasks: apiTasks };
    } catch {
      // API failed (not logged in or network error) — use localStorage
      const localTasks = loadTasks();
      setTasks(localTasks);
      setDeals(loadDeals());
      return { ok: false, tasks: localTasks };
    }
  }, []);

  // ── Auto-detect completed tasks from sent emails ──
  const checkCompletions = useCallback(async (currentTasks: Task[]) => {
    try {
      const openTasks = currentTasks
        .filter((t) => !t.done)
        .slice(0, 30)
        .map((t) => ({ id: t.id, text: t.text, deal: t.deal, assignee: t.assignee }));
      if (openTasks.length === 0) return;

      const res = await fetch("/api/gmail/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openTasks }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const completions: CompletionSuggestion[] = data.completions || [];
      if (completions.length > 0) {
        setCompletionSuggestions(completions);
      }
    } catch {
      // Silent fail — non-critical feature
    }
  }, []);

  useEffect(() => {
    loadFromApi().then((result) => {
      setLoading(false);
      setTimeout(() => { initialized.current = true; }, 50);
      // Auto-sync calendar on first load if logged in
      if (result.ok) {
        syncCalendar();
        // Check for completed tasks based on sent emails
        checkCompletions(result.tasks);
      }
    });
    // Check Slack connection status
    fetch("/api/slack/status").then((r) => r.json()).then((d) => {
      setSlackConnected(!!d.connected);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadFromApi]);

  // Persist to localStorage on changes
  useEffect(() => { if (initialized.current) saveTasks(tasks); }, [tasks]);
  useEffect(() => { if (initialized.current) saveDeals(deals); }, [deals]);

  // ── Re-fetch on tab focus (cross-device sync) ──
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible" && initialized.current) {
        loadFromApi().then((result) => {
          if (result.ok) checkCompletions(result.tasks);
        }).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [loadFromApi, checkCompletions]);

  // Recent assignees
  const recentAssignees = [...new Set(tasks.map((t) => t.assignee).filter(Boolean))] as string[];

  // ── Calendar sync ──
  const syncCalendar = useCallback(async () => {
    setCalLoading(true);
    setStatusMsg({ type: "info", text: "Sync Calendar en cours..." });
    try {
      const week = getWeekDays(weekOffset);
      const week2 = getWeekDays(weekOffset + 1);
      const start = week[0].date;
      const end = week2[6].date;

      const res = await fetch(`/api/calendar?start=${start}&end=${end}`);
      if (!res.ok) throw new Error(`Calendar API: ${res.status}`);
      const events: CalendarEvent[] = await res.json();

      // Inject cached contexts into events
      const cachedContexts = loadCalContexts();
      const eventsWithContext = events.map((e) => {
        const key = calEventKey(e.title, e.start);
        return cachedContexts[key] ? { ...e, context: cachedContexts[key] } : e;
      });

      setCalEvents(eventsWithContext);
      setCalLastFetch(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));

      // Detect new calendar events
      const seenKeys = loadSeenCalendarKeys();
      const seenSet = new Set(seenKeys);
      const allKeys = eventsWithContext.map((e) => calEventKey(e.title, e.start));
      const newEvents = eventsWithContext.filter((e) => !seenSet.has(calEventKey(e.title, e.start)));

      // Save all current event keys as seen
      saveSeenCalendarKeys(allKeys);

      if (newEvents.length > 0 && seenKeys.length > 0) {
        // Ask AI for prep suggestions based on emails + meeting context
        fetchMeetingPreps(newEvents);
      }

      // Fetch contexts for events that don't have one yet
      // Also re-fetch if there are new events (new emails may update context for existing meetings)
      const hasNewEvents = newEvents.length > 0;
      const eventsNeedingContext = eventsWithContext.filter(
        (e) => !e.context || hasNewEvents
      );
      if (eventsNeedingContext.length > 0) {
        fetchMeetingContexts(eventsNeedingContext, hasNewEvents ? {} : cachedContexts);
      }

      setStatusMsg({ type: "ok", text: `${events.length} meeting${events.length !== 1 ? "s" : ""} deal` });
    } catch (e) {
      setStatusMsg({ type: "error", text: `Calendar: ${e instanceof Error ? e.message : "erreur"}` });
    }
    setCalLoading(false);
    setTimeout(() => setStatusMsg(null), 5000);
  }, [weekOffset]);

  // ── Fetch meeting contexts from emails (background, non-blocking) ──
  const fetchMeetingContexts = useCallback(async (events: CalendarEvent[], existingContexts: Record<string, string>) => {
    try {
      const eventsToFetch = events.map((e) => ({
        key: calEventKey(e.title, e.start),
        title: e.title,
        deal: e.deal || null,
        attendees: e.attendees || [],
        date: e.date,
      }));
      const res = await fetch("/api/calendar/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: eventsToFetch }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const newContexts: Record<string, string> = data.contexts || {};
      if (Object.keys(newContexts).length === 0) return;

      // Merge with existing contexts and save
      const merged = { ...existingContexts, ...newContexts };
      saveCalContexts(merged);

      // Update calEvents with new contexts
      setCalEvents((prev) =>
        prev.map((e) => {
          const key = calEventKey(e.title, e.start);
          return newContexts[key] ? { ...e, context: newContexts[key] } : e;
        })
      );
    } catch {
      // Silent fail — non-critical
    }
  }, []);

  // ── Refresh all contexts (clear cache + re-fetch) ──
  const refreshContexts = useCallback(async () => {
    if (calLoading) return;
    setCalLoading(true);
    setStatusMsg({ type: "info", text: "Actualisation des contextes..." });
    try {
      // Clear cached contexts to force re-fetch
      saveCalContexts({});
      const eventsToFetch = calEvents.map((e) => ({
        key: calEventKey(e.title, e.start),
        title: e.title,
        attendees: e.attendees || [],
        date: e.date,
      }));
      if (eventsToFetch.length > 0) {
        const res = await fetch("/api/calendar/context", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ events: eventsToFetch }),
        });
        if (res.ok) {
          const data = await res.json();
          const newContexts: Record<string, string> = data.contexts || {};
          saveCalContexts(newContexts);
          setCalEvents((prev) =>
            prev.map((e) => {
              const key = calEventKey(e.title, e.start);
              return { ...e, context: newContexts[key] || null };
            })
          );
        }
      }
      setStatusMsg({ type: "ok", text: "Contextes actualisés" });
    } catch {
      setStatusMsg({ type: "error", text: "Erreur actualisation contextes" });
    }
    setCalLoading(false);
    setTimeout(() => setStatusMsg(null), 5000);
  }, [calEvents, calLoading]);

  // ── Gmail + Slack scan ──
  const scanEmails = useCallback(async () => {
    setScanLoading(true);
    setStatusMsg({ type: "info", text: "Scan Gmail + Slack en cours..." });
    try {
      const scannedIds = loadScannedGmailIds();
      const openTaskTexts = tasks.filter((t) => !t.done).slice(0, 15).map((t) => t.text);

      // Run Gmail + Slack scans in parallel
      const gmailPromise = fetch("/api/gmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ existingTasks: openTaskTexts, dealNames: DEALS, scannedIds }),
      });
      const slackPromise = slackConnected
        ? fetch("/api/slack/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ existingTasks: openTaskTexts, dealNames: DEALS }),
          })
        : null;

      const [gmailRes, slackRes] = await Promise.all([gmailPromise, slackPromise]);

      const allResults: EmailSuggestion[] = [];

      // Process Gmail results
      if (gmailRes.ok) {
        const data = await gmailRes.json();
        const results: EmailSuggestion[] = data.suggestions || data;
        if (data.scannedIds) saveScannedGmailIds(data.scannedIds);
        allResults.push(...results);
      }

      // Process Slack results
      if (slackRes && slackRes.ok) {
        const data = await slackRes.json();
        const results: EmailSuggestion[] = data.suggestions || [];
        allResults.push(...results);
      }

      // Deduplicate: remove suggestions that overlap with existing meeting prep suggestions or each other
      const prepTexts = new Set(meetingPreps.map((p) => p.text.toLowerCase()));
      const seenTexts = new Set<string>();
      const deduped = allResults.filter((s) => {
        const lower = s.text.toLowerCase();
        if (prepTexts.has(lower) || seenTexts.has(lower)) return false;
        seenTexts.add(lower);
        return true;
      });
      setSuggestions(deduped);
      setStatusMsg(deduped.length > 0
        ? { type: "ok", text: `${deduped.length} suggestion${deduped.length > 1 ? "s" : ""} trouvée${deduped.length > 1 ? "s" : ""}` }
        : { type: "ok", text: "Aucune nouvelle tâche détectée" }
      );
    } catch (e) {
      setStatusMsg({ type: "error", text: `Scan: ${e instanceof Error ? e.message : "erreur"}` });
    }
    setScanLoading(false);
    setTimeout(() => setStatusMsg(null), 5000);
  }, [tasks, DEALS, meetingPreps, slackConnected]);

  // ── Accept/dismiss suggestions ──
  const acceptSuggestion = useCallback((idx: number) => {
    const s = suggestions[idx];
    if (!s) return;
    const id = uid();
    const task: Task = {
      id, text: s.text, deal: s.deal || "Perso",
      priority: s.priority || "medium", deadline: s.deadline || null,
      assignee: s.assignee || null, done: false, created_at: new Date().toISOString(),
    };
    setTasks((p) => [task, ...p]);
    setSuggestions((p) => p.filter((_, i) => i !== idx));
    apiAddTask({ id, text: task.text, deal: task.deal, priority: task.priority, deadline: task.deadline, assignee: task.assignee, source: "gmail" }).catch(() => {});
  }, [suggestions]);

  const acceptAllSuggestions = useCallback(() => {
    const newTasks = suggestions.map((s) => ({
      id: uid(), text: s.text, deal: s.deal || "Perso",
      priority: s.priority || "medium", deadline: s.deadline || null,
      assignee: s.assignee || null, done: false, created_at: new Date().toISOString(),
    }));
    setTasks((p) => [...newTasks, ...p]);
    setSuggestions([]);
    for (const t of newTasks) {
      apiAddTask({ id: t.id, text: t.text, deal: t.deal, priority: t.priority, deadline: t.deadline, assignee: t.assignee, source: "gmail" }).catch(() => {});
    }
  }, [suggestions]);

  // ── Accept/dismiss completion suggestions ──
  const acceptCompletion = useCallback((taskId: string) => {
    setTasks((p) => p.map((t) =>
      t.id === taskId ? { ...t, done: true, completed_at: new Date().toISOString() } : t
    ));
    apiUpdateTask(taskId, { done: true }).catch(() => {});
    setCompletionSuggestions((p) => p.filter((c) => c.taskId !== taskId));
  }, []);

  const acceptAllCompletions = useCallback(() => {
    const ids = new Set(completionSuggestions.map((c) => c.taskId));
    setTasks((p) => p.map((t) =>
      ids.has(t.id) ? { ...t, done: true, completed_at: new Date().toISOString() } : t
    ));
    for (const id of ids) {
      apiUpdateTask(id, { done: true }).catch(() => {});
    }
    setCompletionSuggestions([]);
  }, [completionSuggestions]);

  // ── Meeting prep: fetch AI suggestions for new events ──
  const fetchMeetingPreps = useCallback(async (newEvents: CalendarEvent[]) => {
    try {
      const res = await fetch("/api/calendar/prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newEvents: newEvents.map((e) => ({
            title: e.title,
            date: e.date,
            start: e.start,
            deal: e.deal === "_unmatched" ? null : e.deal,
          })),
          existingTasks: tasks.filter((t) => !t.done).slice(0, 20).map((t) => t.text),
          dealNames: DEALS,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const preps: MeetingPrepSuggestion[] = data.prepSuggestions || [];
      if (preps.length > 0) {
        // Deduplicate against current Gmail suggestions
        const gmailTexts = new Set(suggestions.map((s) => s.text.toLowerCase()));
        const filtered = preps.filter((p) => !gmailTexts.has(p.text.toLowerCase()));
        if (filtered.length > 0) setMeetingPreps(filtered);
      }
    } catch {
      // Silent fail — non-critical
    }
  }, [tasks, DEALS, suggestions]);

  // ── Accept a meeting prep suggestion as a task ──
  const acceptPrep = useCallback((idx: number) => {
    const prep = meetingPreps[idx];
    if (!prep) return;
    const id = uid();
    const task: Task = {
      id,
      text: prep.text,
      deal: prep.deal || "Perso",
      priority: prep.priority || "high",
      deadline: prep.deadline || null,
      assignee: null,
      done: false,
      created_at: new Date().toISOString(),
    };
    setTasks((p) => [task, ...p]);
    setMeetingPreps((p) => p.filter((_, i) => i !== idx));
    apiAddTask({ id, text: task.text, deal: task.deal, priority: task.priority, deadline: task.deadline, assignee: task.assignee, source: "calendar-prep" }).catch(() => {});
  }, [meetingPreps]);

  const acceptAllPreps = useCallback(() => {
    const newTasks = meetingPreps.map((prep) => ({
      id: uid(),
      text: prep.text,
      deal: prep.deal || "Perso",
      priority: prep.priority || ("high" as const),
      deadline: prep.deadline || null,
      assignee: null,
      done: false,
      created_at: new Date().toISOString(),
    }));
    setTasks((p) => [...newTasks, ...p]);
    setMeetingPreps([]);
    for (const t of newTasks) {
      apiAddTask({ id: t.id, text: t.text, deal: t.deal, priority: t.priority, deadline: t.deadline, assignee: t.assignee, source: "calendar-prep" }).catch(() => {});
    }
  }, [meetingPreps]);

  // ── Push task deadline to calendar ──
  const pushTaskToCalendar = useCallback(async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task || !task.deadline) return;
    setPushingId(id);
    setStatusMsg({ type: "info", text: "Ajout au Calendar..." });
    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: task.text,
          date: task.deadline,
          description: `DealFlow task — ${task.deal} — Priority: ${task.priority}`,
        }),
      });
      if (!res.ok) throw new Error(`Calendar push: ${res.status}`);
      setTasks((p) => p.map((t) => t.id === id ? { ...t, synced: true } : t));
      apiUpdateTask(id, { synced: true }).catch(() => {});
      setStatusMsg({ type: "ok", text: "Ajouté au Calendar" });
    } catch (e) {
      setStatusMsg({ type: "error", text: `Push: ${e instanceof Error ? e.message : "erreur"}` });
    }
    setPushingId(null);
    setTimeout(() => setStatusMsg(null), 4000);
  }, [tasks]);

  // ── Task operations (optimistic + API sync) ──
  const addTask = useCallback((text: string, dealName: string, priority: "high" | "medium" | "low", deadline: string | null, assignee: string | null) => {
    const id = uid();
    setTasks((p) => [{
      id, text, deal: dealName, priority, deadline, assignee,
      done: false, created_at: new Date().toISOString(),
    }, ...p]);
    apiAddTask({ id, text, deal: dealName, priority, deadline, assignee }).catch(() => {});
  }, []);

  const toggle = useCallback((id: string) => {
    let newDone = false;
    setTasks((p) => p.map((t) => {
      if (t.id !== id) return t;
      newDone = !t.done;
      return { ...t, done: newDone, completed_at: newDone ? new Date().toISOString() : null };
    }));
    // Use setTimeout to ensure newDone is set after the state updater runs
    setTimeout(() => apiUpdateTask(id, { done: newDone }).catch(() => {}), 0);
  }, []);

  const del = useCallback((id: string) => {
    setTasks((p) => p.filter((t) => t.id !== id));
    apiDeleteTask(id).catch(() => {});
  }, []);

  const edit = useCallback((id: string, text: string) => {
    setTasks((p) => p.map((t) => t.id === id ? { ...t, text } : t));
    apiUpdateTask(id, { text }).catch(() => {});
  }, []);

  const changeDeal = useCallback((id: string, newDeal: string) => {
    setTasks((p) => p.map((t) => t.id === id ? { ...t, deal: newDeal } : t));
    apiUpdateTask(id, { deal: newDeal }).catch(() => {});
  }, []);

  const changePri = useCallback((id: string, newPri: string) => {
    setTasks((p) => p.map((t) => t.id === id ? { ...t, priority: newPri as Task["priority"] } : t));
    apiUpdateTask(id, { priority: newPri as Task["priority"] }).catch(() => {});
  }, []);

  const changeAssignee = useCallback((id: string, name: string | null) => {
    setTasks((p) => p.map((t) => t.id === id ? { ...t, assignee: name || null } : t));
    apiUpdateTask(id, { assignee: name || null }).catch(() => {});
  }, []);

  const notifyAssignee = useCallback(async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task?.assignee) return;
    setStatusMsg({ type: "info", text: `Notification Slack à ${task.assignee}...` });
    try {
      const res = await fetch("/api/slack/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assigneeName: task.assignee,
          taskText: task.text,
          dealName: task.deal !== "Perso" ? task.deal : null,
          priority: task.priority,
          deadline: task.deadline,
        }),
      });
      const d = await res.json();
      if (d.sent) {
        setStatusMsg({ type: "ok", text: `Notifié ${d.user} sur Slack` });
      } else {
        setStatusMsg({ type: "error", text: d.reason || "Utilisateur non trouvé sur Slack" });
      }
    } catch {
      setStatusMsg({ type: "error", text: "Erreur envoi Slack" });
    }
    setTimeout(() => setStatusMsg(null), 4000);
  }, [tasks]);

  const changeDeadline = useCallback((id: string, deadline: string | null) => {
    setTasks((p) => p.map((t) => t.id === id ? { ...t, deadline } : t));
    apiUpdateTask(id, { deadline }).catch(() => {});
  }, []);

  const clearDone = useCallback(() => {
    const doneTasks = tasks.filter((t) => t.done);
    setTasks((p) => p.filter((t) => !t.done));
    for (const t of doneTasks) {
      apiDeleteTask(t.id).catch(() => {});
    }
  }, [tasks]);

  // ── Deal management (optimistic + API sync) ──
  const addDeal = useCallback((name: string, color: string, company?: string) => {
    if (!name.trim() || deals.some((d) => d.name.toLowerCase() === name.trim().toLowerCase())) return;
    const trimmed = name.trim();
    const comp = company?.trim() || "";
    setDeals((p) => [...p, { name: trimmed, color, company: comp || undefined }]);
    apiAddDeal({ name: trimmed, color, company: comp || undefined, keywords: [trimmed.toLowerCase()], sort_order: deals.length }).catch(() => {});
  }, [deals]);

  const updateDealCompany = useCallback((name: string, company: string) => {
    setDeals((p) => p.map((d) => d.name === name ? { ...d, company: company || undefined } : d));
    apiUpdateDeal(name, { company }).catch(() => {});
  }, []);

  const removeDeal = useCallback((name: string) => {
    if (tasks.some((t) => t.deal === name && !t.done)) {
      setStatusMsg({ type: "error", text: `"${name}" a des tâches ouvertes — complète-les ou change leur deal d'abord` });
      setTimeout(() => setStatusMsg(null), 4000);
      return;
    }
    setDeals((p) => p.filter((d) => d.name !== name));
    if (deal === name) setDeal("Tous");
    apiDeleteDeal(name).catch(() => {});
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
            onUpdateDealCompany={updateDealCompany}
          />
        )}

        {/* Stats + sync buttons */}
        <div className="flex gap-4 mb-3 items-center flex-wrap" style={{ fontSize: "12px" }}>
          <span style={{ color: "#64748B" }}>{openN} ouvertes</span>
          {overdueN > 0 && <span style={{ color: "#F87171" }}>{overdueN} en retard</span>}
          {todayN > 0 && <span style={{ color: "#FBBF24" }}>{todayN} aujourd&apos;hui</span>}
          <span className="flex-1" />
          {/* Sync buttons */}
          <div className="flex gap-1.5 items-center">
            <div
              onClick={!scanLoading ? scanEmails : undefined}
              className="flex items-center gap-[5px] rounded-md"
              style={{
                padding: "4px 10px", fontSize: "11px",
                cursor: scanLoading ? "wait" : "pointer",
                color: "#34D399", background: "rgba(52,211,153,0.08)",
                opacity: scanLoading ? 0.5 : 1,
              }}
            >
              {scanLoading ? "⏳" : "📧"} {scanLoading ? "Scan..." : "Gmail"}
            </div>
            {slackConnected && (
              <div
                className="flex items-center gap-[5px] rounded-md"
                style={{
                  padding: "4px 10px", fontSize: "11px",
                  color: slackConnected ? "#818CF8" : "#3F3F46",
                  background: "rgba(129,140,248,0.08)",
                }}
                title="Slack connecté — inclus dans le scan Gmail"
              >
                💬 Slack
              </div>
            )}
            {calLastFetch && <span style={{ fontSize: "9px", color: "#27272A" }}>màj {calLastFetch}</span>}
          </div>
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

        {/* ── COMPLETION SUGGESTIONS ── */}
        {completionSuggestions.length > 0 && (
          <div
            className="rounded-[10px] mb-3"
            style={{
              background: "rgba(129,140,248,0.05)",
              border: "1px solid rgba(129,140,248,0.12)",
              padding: "10px 12px",
            }}
          >
            <div className="flex justify-between items-center mb-2">
              <span style={{ fontSize: "11px", fontWeight: 500, color: "#818CF8" }}>
                ✅ {completionSuggestions.length} tâche{completionSuggestions.length > 1 ? "s" : ""} probablement terminée{completionSuggestions.length > 1 ? "s" : ""}
              </span>
              <div className="flex gap-2">
                <span onClick={acceptAllCompletions} className="cursor-pointer" style={{ fontSize: "10px", color: "#818CF8" }}>
                  Tout compléter
                </span>
                <span onClick={() => setCompletionSuggestions([])} className="cursor-pointer" style={{ fontSize: "10px", color: "#52525B" }}>
                  Ignorer
                </span>
              </div>
            </div>
            {completionSuggestions.map((c, i) => (
              <div
                key={c.taskId}
                className="flex items-center gap-2"
                style={{ padding: "8px 0", borderTop: i > 0 ? "1px solid rgba(255,255,255,0.03)" : "none" }}
              >
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: "13px", color: "#CBD5E1", marginBottom: "3px", textDecoration: "line-through", opacity: 0.7 }}>{c.taskText}</div>
                  <div style={{ fontSize: "10px", color: "#818CF8" }}>{c.reason}</div>
                </div>
                <div
                  onClick={() => acceptCompletion(c.taskId)}
                  className="cursor-pointer rounded-md"
                  style={{ padding: "5px 10px", fontSize: "11px", color: "#818CF8", background: "rgba(129,140,248,0.1)" }}
                >
                  ✓ Fait
                </div>
                <div
                  onClick={() => setCompletionSuggestions((p) => p.filter((x) => x.taskId !== c.taskId))}
                  className="cursor-pointer rounded-md"
                  style={{ padding: "5px 8px", fontSize: "11px", color: "#52525B" }}
                >
                  ✕
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── MEETING PREP SUGGESTIONS ── */}
        {meetingPreps.length > 0 && (
          <div
            className="rounded-[10px] mb-3"
            style={{
              background: "rgba(251,191,36,0.05)",
              border: "1px solid rgba(251,191,36,0.12)",
              padding: "10px 12px",
            }}
          >
            <div className="flex justify-between items-center mb-2">
              <span style={{ fontSize: "11px", fontWeight: 500, color: "#FBBF24" }}>
                📅 {meetingPreps.length} préparation{meetingPreps.length > 1 ? "s" : ""} suggérée{meetingPreps.length > 1 ? "s" : ""} pour vos meetings
              </span>
              <div className="flex gap-2">
                <span onClick={acceptAllPreps} className="cursor-pointer" style={{ fontSize: "10px", color: "#FBBF24" }}>
                  Tout accepter
                </span>
                <span onClick={() => setMeetingPreps([])} className="cursor-pointer" style={{ fontSize: "10px", color: "#52525B" }}>
                  Ignorer tout
                </span>
              </div>
            </div>
            {meetingPreps.map((m, i) => (
              <div
                key={i}
                className="flex items-center gap-2"
                style={{ padding: "8px 0", borderTop: i > 0 ? "1px solid rgba(255,255,255,0.03)" : "none" }}
              >
                <div className="flex-1 min-w-0">
                  {m.meetingTitle && (
                    <div style={{ fontSize: "10px", color: "#FBBF24", marginBottom: "2px", fontWeight: 500 }}>
                      📅 {m.meetingTitle}
                    </div>
                  )}
                  <div style={{ fontSize: "13px", color: "#CBD5E1", marginBottom: "3px" }}>{m.text}</div>
                  <div className="flex gap-1.5 items-center flex-wrap">
                    {m.deal && <span style={{ fontSize: "10px", color: DEAL_DOT[m.deal] || "#64748B" }}>{m.deal}</span>}
                    {m.priority === "high" && <span style={{ fontSize: "10px", color: "#F87171" }}>▲</span>}
                    {m.deadline && <span style={{ fontSize: "10px", color: "#64748B" }}>{formatDeadline(m.deadline)}</span>}
                    {m.source && <span style={{ fontSize: "9px", color: "#92702D" }}>← {m.source}</span>}
                  </div>
                </div>
                <div
                  onClick={() => acceptPrep(i)}
                  className="cursor-pointer rounded-md"
                  style={{ padding: "5px 10px", fontSize: "11px", color: "#FBBF24", background: "rgba(251,191,36,0.1)" }}
                >
                  ✓
                </div>
                <div
                  onClick={() => setMeetingPreps((p) => p.filter((_, j) => j !== i))}
                  className="cursor-pointer rounded-md"
                  style={{ padding: "5px 8px", fontSize: "11px", color: "#52525B" }}
                >
                  ✕
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── EMAIL SUGGESTIONS ── */}
        {suggestions.length > 0 && (
          <div
            className="rounded-[10px] mb-3"
            style={{
              background: "rgba(52,211,153,0.05)",
              border: "1px solid rgba(52,211,153,0.12)",
              padding: "10px 12px",
            }}
          >
            <div className="flex justify-between items-center mb-2">
              <span style={{ fontSize: "11px", fontWeight: 500, color: "#34D399" }}>
                📧 {suggestions.length} tâche{suggestions.length > 1 ? "s" : ""} suggérée{suggestions.length > 1 ? "s" : ""} depuis Gmail
              </span>
              <div className="flex gap-2">
                <span onClick={acceptAllSuggestions} className="cursor-pointer" style={{ fontSize: "10px", color: "#34D399" }}>
                  Tout accepter
                </span>
                <span onClick={() => setSuggestions([])} className="cursor-pointer" style={{ fontSize: "10px", color: "#52525B" }}>
                  Tout ignorer
                </span>
              </div>
            </div>
            {suggestions.map((s, i) => (
              <div
                key={i}
                className="flex items-center gap-2"
                style={{ padding: "8px 0", borderTop: i > 0 ? "1px solid rgba(255,255,255,0.03)" : "none" }}
              >
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: "13px", color: "#CBD5E1", marginBottom: "3px" }}>{s.text}</div>
                  <div className="flex gap-1.5 items-center flex-wrap">
                    {s.deal && <span style={{ fontSize: "10px", color: DEAL_DOT[s.deal] || "#64748B" }}>{s.deal}</span>}
                    {s.priority === "high" && <span style={{ fontSize: "10px", color: "#F87171" }}>▲</span>}
                    {s.deadline && <span style={{ fontSize: "10px", color: "#64748B" }}>{formatDeadline(s.deadline)}</span>}
                    {s.assignee && <span style={{ fontSize: "10px", color: "#A78BFA" }}>{s.assignee}</span>}
                    {s.source && <span style={{ fontSize: "9px", color: "#27272A" }}>← {s.source}</span>}
                  </div>
                </div>
                <div
                  onClick={() => acceptSuggestion(i)}
                  className="cursor-pointer rounded-md"
                  style={{ padding: "5px 10px", fontSize: "11px", color: "#34D399", background: "rgba(52,211,153,0.1)" }}
                >
                  ✓
                </div>
                <div
                  onClick={() => setSuggestions((p) => p.filter((_, j) => j !== i))}
                  className="cursor-pointer rounded-md"
                  style={{ padding: "5px 8px", fontSize: "11px", color: "#52525B" }}
                >
                  ✕
                </div>
              </div>
            ))}
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
            { k: "recap" as ViewType, l: "Récap" },
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
                onChangeDeadline={changeDeadline}
                onNotifyAssignee={notifyAssignee}
                slackConnected={slackConnected}
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
                onChangeDeadline={changeDeadline}
                onNotifyAssignee={notifyAssignee}
                slackConnected={slackConnected}
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
            calLoading={calLoading}
            onRefreshContexts={refreshContexts}
            onToggle={toggle}
            onDelete={del}
            onEdit={edit}
            onChangeDeal={changeDeal}
            onChangePriority={changePri}
            onChangeAssignee={changeAssignee}
            onChangeDeadline={changeDeadline}
            onNotifyAssignee={notifyAssignee}
            slackConnected={slackConnected}
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
            onChangeDeadline={changeDeadline}
            onNotifyAssignee={notifyAssignee}
            slackConnected={slackConnected}
          />
        )}

        {/* Recap view */}
        {view === "recap" && (
          <RecapView
            deals={deals}
            mobile={mobile}
          />
        )}
      </div>
    </div>
  );
}
