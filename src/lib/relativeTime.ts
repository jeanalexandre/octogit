const format = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** Date relative en anglais (« 2 hours ago », « yesterday ») ; `now` et `timestamp` en secondes. */
export function formatRelative(timestamp: number, now: number = Date.now() / 1000): string {
  const seconds = Math.max(0, now - timestamp);
  if (seconds < 60) return "just now";
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 365 * 86400],
    ["month", 30 * 86400],
    ["week", 7 * 86400],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (seconds >= size) return format.format(-Math.floor(seconds / size), unit);
  }
  return "just now";
}

/** Comme `formatRelative`, avec les minutes abrégées (« 12 min ago ») : dates du graphe. */
export function formatRelativeShort(timestamp: number, now: number = Date.now() / 1000): string {
  const seconds = Math.max(0, now - timestamp);
  if (seconds >= 60 && seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  return formatRelative(timestamp, now);
}

const two = (n: number) => String(n).padStart(2, "0");

/** Date et heure locales au format « 2026-11-04 14:32 » ; `timestamp` en secondes. */
export function formatAbsolute(timestamp: number): string {
  const d = new Date(timestamp * 1000);
  const date = `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
  return `${date} ${two(d.getHours())}:${two(d.getMinutes())}`;
}
