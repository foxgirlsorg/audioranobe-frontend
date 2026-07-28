// Formatting helpers shared across the app.
// Durations render as H:MM:SS when >= 1 hour, otherwise M:SS.
// Dates and relative times use Russian locale.

function locale(): string {
  return 'ru-RU';
}

/** 65 → "1:05", 3671 → "1:01:11" */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
  const s = Math.floor(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  if (h > 0) return `${h}:${two(m)}:${two(sec)}`;
  return `${m}:${two(sec)}`;
}

/** Alias for player time displays. */
export const formatTime = formatDuration;

/** ISO date → "Jan 5, 2026" / "5 янв. 2026 г." */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(locale(), { year: 'numeric', month: 'short', day: 'numeric' });
}

/** ISO date → "Jan 5, 2026, 14:32" (locale-aware) */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString(locale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** ISO date → "now"/"5 min. ago"/"3 hr. ago" (localized); older than ~30d → absolute date */
export function timeAgo(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto', style: 'short' });
  if (diff < 45) return rtf.format(0, 'second');
  if (diff < 3600) return rtf.format(-Math.max(1, Math.floor(diff / 60)), 'minute');
  if (diff < 86400) return rtf.format(-Math.floor(diff / 3600), 'hour');
  if (diff < 86400 * 30) return rtf.format(-Math.floor(diff / 86400), 'day');
  return formatDate(iso);
}

/** 1234 → "1.2k", 4200000 → "4.2M" (suffixes kept language-neutral) */
export function formatCount(n: number): string {
  if (!Number.isFinite(n)) return '0';
  if (Math.abs(n) < 1000) return String(n);
  if (Math.abs(n) < 1_000_000) {
    const v = n / 1000;
    return `${v >= 100 ? Math.round(v) : Math.round(v * 10) / 10}k`;
  }
  const v = n / 1_000_000;
  return `${v >= 100 ? Math.round(v) : Math.round(v * 10) / 10}M`;
}

/** 8.4321 → "8.4", null → "—" */
export function formatRating(r: number | null | undefined): string {
  if (r === null || r === undefined || !Number.isFinite(r)) return '—';
  return r.toFixed(1);
}
