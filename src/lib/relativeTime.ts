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
