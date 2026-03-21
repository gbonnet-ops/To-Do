import { Task, Deal } from "./types";
import { DEFAULT_DEALS } from "./constants";

const TASKS_KEY = "dealflow-tasks-v2";
const DEALS_KEY = "dealflow-deals-v2";

// Local storage fallback when Supabase is not configured
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
