const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidUUID(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function isValidDate(value: string | null | undefined): value is string {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const d = new Date(value + "T00:00:00Z");
  return !isNaN(d.getTime());
}

export function sanitizeString(value: unknown, maxLength = 500): string {
  if (typeof value !== "string") return "";
  return value.slice(0, maxLength).trim();
}

export function isValidPriority(value: unknown): value is "high" | "medium" | "low" {
  return value === "high" || value === "medium" || value === "low";
}
