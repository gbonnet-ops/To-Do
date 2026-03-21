import { todayStr, tomorrowStr, nextWeekStr, getNextDay } from "./utils";

export const parseDeal = (text: string, dealNames: string[]): string | null => {
  const m = text.match(/#(\w[\w\s]*?)(?=\s|$)/);
  if (!m) return null;
  const r = m[1].toLowerCase().trim();
  const map: Record<string, string> = {};
  (dealNames || []).forEach((d) => {
    map[d.toLowerCase()] = d;
    map[d.split(" ")[0].toLowerCase()] = d;
  });
  return map[r] || (dealNames || []).find((d) => d.toLowerCase().startsWith(r)) || null;
};

export const parsePriority = (text: string): "high" | "medium" | "low" => {
  const m = text.match(/!(high|med|medium|low|haute|moyenne|basse)/i);
  if (!m) return "medium";
  const r = m[1].toLowerCase();
  if (["high", "haute"].includes(r)) return "high";
  if (["low", "basse"].includes(r)) return "low";
  return "medium";
};

export const parseDate = (text: string): string | null => {
  const m = text.match(/@(\S+)/);
  if (!m) return null;
  const r = m[1].toLowerCase();
  if (["today", "auj", "aujourdhui"].includes(r)) return todayStr();
  if (["tomorrow", "demain", "dem"].includes(r)) return tomorrowStr();
  if (["week", "semaine", "sem"].includes(r)) return nextWeekStr();
  const days: Record<string, number> = {
    lundi: 1, lun: 1, monday: 1,
    mardi: 2, mar: 2, tuesday: 2,
    mercredi: 3, mer: 3, wednesday: 3,
    jeudi: 4, jeu: 4, thursday: 4,
    vendredi: 5, ven: 5, friday: 5,
  };
  if (days[r]) return getNextDay(days[r]);
  if (/^\d{4}-\d{2}-\d{2}$/.test(r)) return r;
  if (/^\d{2}\/\d{2}$/.test(r)) {
    const [dd, mm] = r.split("/");
    return `${new Date().getFullYear()}-${mm}-${dd}`;
  }
  return null;
};

export const parseAssignee = (t: string): string | null => {
  const m = t.match(/>(\w+)/);
  return m ? m[1] : null;
};

export const cleanText = (t: string): string =>
  t
    .replace(/#\w[\w\s]*?(?=\s|$)/g, "")
    .replace(/!(high|med|medium|low|haute|moyenne|basse)/gi, "")
    .replace(/@\S+/g, "")
    .replace(/>\w+/g, "")
    .replace(/\s+/g, " ")
    .trim();
