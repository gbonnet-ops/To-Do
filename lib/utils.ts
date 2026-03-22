export const uid = () => crypto.randomUUID();

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const tomorrowStr = () => {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
};

export const nextWeekStr = () => {
  const t = new Date();
  t.setDate(t.getDate() + 7);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
};

export const getNextDay = (target: number) => {
  const d = new Date();
  let diff = target - d.getDay();
  if (diff <= 0) diff += 7;
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const isOverdue = (dl: string | null) => dl != null && dl < todayStr();
export const isToday = (dl: string | null) => dl === todayStr();

export const getWeekDays = (offset = 0) => {
  const today = new Date();
  const monday = new Date(today);
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  monday.setDate(today.getDate() + diff + offset * 7);
  const days: { label: string; date: string; day: number; month: string; isToday: boolean }[] = [];
  const dayNames = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    days.push({
      label: dayNames[i],
      date: str,
      day: d.getDate(),
      month: d.toLocaleDateString("fr-FR", { month: "short" }),
      isToday: str === todayStr(),
    });
  }
  return days;
};

export const formatDeadline = (d: string | null) => {
  if (!d) return null;
  const t = todayStr();
  if (d === t) return "Aujourd'hui";
  if (d === tomorrowStr()) return "Demain";
  if (d < t) {
    const diff = Math.floor((new Date(t).getTime() - new Date(d).getTime()) / 86400000);
    return `${diff}j en retard`;
  }
  const diff = Math.floor((new Date(d).getTime() - new Date(t).getTime()) / 86400000);
  if (diff <= 7) return `dans ${diff}j`;
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
};

export const deadlineColor = (d: string | null) => {
  if (!d) return "#475569";
  if (d < todayStr()) return "#F87171";
  if (d === todayStr()) return "#FBBF24";
  return "#64748B";
};

export const greet = () => {
  const h = new Date().getHours();
  if (h < 6) return "Bonne nuit";
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
};
