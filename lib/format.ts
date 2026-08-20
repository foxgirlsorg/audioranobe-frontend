
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

/**
 * "Last seen" moment (RU), coarsening with age so only what's needed shows:
 * today/yesterday → time, within a week → weekday + time, older → day+month,
 * a past year → day+month+year. VK-style.
 */
export function lastSeen(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const time = d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', hour12: false });
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);

  if (dayDiff <= 0) return `сегодня в ${time}`;
  if (dayDiff === 1) return `вчера в ${time}`;
  if (dayDiff < 7) {
    const weekday = d.toLocaleDateString(locale(), { weekday: 'long' });
    return `${weekday}, ${time}`;
  }
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString(locale(), { day: 'numeric', month: 'long' });
  }
  return d.toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' });
}


export function presenceLabel(status: 'online' | 'offline', lastSeenAt?: string | null): string {
  if (status === 'online') return 'в сети';
  return lastSeenAt ? `был(а) в сети ${lastSeen(lastSeenAt)}` : 'не в сети';
}

export function presenceLabelCompact(status: 'online' | 'offline', lastSeenAt?: string | null): string {
  if (status === 'online') return 'в сети';
  return lastSeenAt ? `${lastSeen(lastSeenAt)}` : 'не в сети';
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

/** Markdown source reduced to a flat, single-line summary for meta descriptions. */
export function plainSummary(markdown: string, maxLen = 200): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\|\|([\s\S]*?)\|\|/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>+\s?/gm, '')
    .replace(/^\s{0,3}([-*+]|\d+[.)])\s+/gm, '')
    .replace(/(\*\*\*|___)([^*_]+)\1/g, '$2')
    .replace(/(\*\*|__)([^*_]+)\1/g, '$2')
    .replace(/(\*|_)([^*_]+)\1/g, '$2')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
