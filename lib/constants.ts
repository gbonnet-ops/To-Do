export const DEFAULT_DEALS = [
  { name: "Nova", color: "#818CF8" },
  { name: "Babylon", color: "#FBBF24" },
  { name: "Darwin", color: "#34D399" },
  { name: "Job Search", color: "#F87171" },
  { name: "AI Projects", color: "#38BDF8" },
  { name: "Perso", color: "#A78BFA" },
];

export const COLOR_PALETTE = [
  "#818CF8", "#FBBF24", "#34D399", "#F87171", "#38BDF8", "#A78BFA",
  "#FB923C", "#F472B6", "#22D3EE", "#A3E635", "#E879F9", "#FCA5A5",
];

export const PRIORITY_COLOR: Record<string, string> = {
  high: "#F87171",
  medium: "#64748B",
  low: "#334155",
};

export const PRIORITY_ICON: Record<string, string> = {
  high: "▲",
  medium: "●",
  low: "▽",
};

export const PRIORITY_LABELS: Record<string, string> = {
  high: "Haute",
  medium: "Moyenne",
  low: "Basse",
};

export const EXCLUDED_TITLES = [
  "bureau", "sport", "gym", "untitled", "sans titre", "untitled event",
  "lunch", "déjeuner", "perso", "dispo", "bloqué", "bloc", "focus time", "no meeting",
];
