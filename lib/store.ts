import { Task, Deal } from "./types";
import { DEFAULT_DEALS } from "./constants";

const TASKS_KEY = "dealflow-tasks-v2";
const DEALS_KEY = "dealflow-deals-v2";

// ── localStorage (cache / offline fallback) ──

export const loadTasks = (): Task[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveTasks = (tasks: Task[]) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  } catch (e) {
    console.error("Save tasks failed:", e);
  }
};

export const loadDeals = (): Deal[] => {
  if (typeof window === "undefined") return DEFAULT_DEALS;
  try {
    const raw = localStorage.getItem(DEALS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_DEALS;
  } catch {
    return DEFAULT_DEALS;
  }
};

export const saveDeals = (deals: Deal[]) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DEALS_KEY, JSON.stringify(deals));
  } catch (e) {
    console.error("Save deals failed:", e);
  }
};

// ── API (source of truth for cross-device sync) ──

export const fetchTasks = async (): Promise<Task[]> => {
  const res = await fetch("/api/tasks");
  if (!res.ok) throw new Error(`Tasks API: ${res.status}`);
  return res.json();
};

export const fetchDeals = async (): Promise<Deal[]> => {
  const res = await fetch("/api/deals");
  if (!res.ok) throw new Error(`Deals API: ${res.status}`);
  return res.json();
};

export const apiAddTask = async (task: {
  id: string;
  text: string;
  deal: string;
  priority: string;
  deadline: string | null;
  assignee: string | null;
  source?: string;
}) => {
  const res = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(task),
  });
  if (!res.ok) throw new Error(`Add task API: ${res.status}`);
  return res.json();
};

export const apiUpdateTask = async (id: string, updates: Partial<Task>) => {
  const res = await fetch("/api/tasks", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...updates }),
  });
  if (!res.ok) throw new Error(`Update task API: ${res.status}`);
  return res.json();
};

export const apiDeleteTask = async (id: string) => {
  const res = await fetch(`/api/tasks?id=${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Delete task API: ${res.status}`);
};

export const apiAddDeal = async (deal: {
  name: string;
  color: string;
  keywords?: string[];
  sort_order?: number;
}) => {
  const res = await fetch("/api/deals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(deal),
  });
  if (!res.ok) throw new Error(`Add deal API: ${res.status}`);
  return res.json();
};

// ── Gmail scanned IDs (rolling 2-day memory) ──

const GMAIL_SCANNED_KEY = "dealflow-gmail-scanned";

interface GmailScannedData {
  date: string; // YYYY-MM-DD of last update
  ids: string[];
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export const loadScannedGmailIds = (): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(GMAIL_SCANNED_KEY);
    if (!raw) return [];
    const data: GmailScannedData = JSON.parse(raw);
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = yesterdayStr();
    // Keep data if it was saved today or yesterday
    if (data.date !== today && data.date !== yesterday) {
      localStorage.removeItem(GMAIL_SCANNED_KEY);
      return [];
    }
    return data.ids;
  } catch {
    return [];
  }
};

export const saveScannedGmailIds = (ids: string[]) => {
  if (typeof window === "undefined") return;
  try {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(GMAIL_SCANNED_KEY, JSON.stringify({ date: today, ids }));
  } catch (e) {
    console.error("Save scanned gmail ids failed:", e);
  }
};

export const apiDeleteDeal = async (name: string) => {
  const res = await fetch(`/api/deals?name=${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Delete deal API: ${res.status}`);
};
