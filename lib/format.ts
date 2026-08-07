
function locale(): string {
  return 'ru-RU';
}

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

export const formatTime = formatDuration;

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(locale(), { year: 'numeric', month: 'short', day: 'numeric' });
}

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

export function formatRating(r: number | null | undefined): string {
  if (r === null || r === undefined || !Number.isFinite(r)) return '—';
  return r.toFixed(1);
}

export function chapterFilePrefix(n: number): string {
  const whole = Math.floor(n);
  const frac = Math.round((n - whole) * 1000) / 1000;
  return String(whole).padStart(3, '0') + (frac > 0 ? String(frac).slice(1) : '');
}

/** Up-to-two-letter avatar initials from a username. */
export function initialsOf(username: string): string {
  const parts = username.split(/[_\-.]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return username.slice(0, 2).toUpperCase();
}
