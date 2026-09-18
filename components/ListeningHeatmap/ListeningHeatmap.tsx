'use client';

import { useEffect, useState } from 'react';
import CalendarHeatmap from 'react-calendar-heatmap';
import 'react-calendar-heatmap/dist/styles.css';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { ListeningHeatmapData } from '@/lib/types';
import styles from './ListeningHeatmap.module.css';

type DayValue = { date: Date; realKey: string; seconds: number; future: boolean };

const MONTH_LABELS: [string, string, string, string, string, string, string, string, string, string, string, string] =
  ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
// The library always lays real Sunday at row 0. Feeding it dates shifted back
// by one day makes real Monday land on row 0 instead.
//
// Weekday labels are drawn ourselves (see WeekdayLabels below) rather than via
// the library's own showWeekdayLabels: its getHeight() adds a fixed 30-unit
// "weekday label" allowance to the SVG's height even in horizontal mode, where
// that allowance is actually spent on WIDTH — leaving a large dead band under
// the grid. Turning its labels off drops that allowance and the dead band
// with it; row centers below are in the % of total height it leaves instead
// (12-unit month-label band + 7 * 12-unit rows = 96 units total).
const WEEKDAY_ROWS: { label: string; centerPct: number }[] = [
  { label: 'Вт', centerPct: (12 + 12 * 1.5) / 96 },
  { label: 'Чт', centerPct: (12 + 12 * 3.5) / 96 },
  { label: 'Сб', centerPct: (12 + 12 * 5.5) / 96 },
];

/**
 * Brightest square = 5h+ listened that day — a fixed scale, not relative to
 * the user's own busiest day (unlike GitHub's commit graph).
 */
function heatLevel(seconds: number): 0 | 1 | 2 | 3 | 4 {
  if (seconds <= 0) return 0;
  const hours = seconds / 3600;
  if (hours >= 5) return 4;
  if (hours >= 2) return 3;
  if (hours >= 0.5) return 2;
  return 1;
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Every date fed to the library is shifted back a day so real Monday lands
// where the library always puts Sunday (row 0).
//
// startDate/endDate just need to name the right local calendar day (the
// library re-derives local midnight from them internally), so a plain
// setDate shift is fine here.
function shiftBackLocal(d: Date): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() - 1);
  return copy;
}

// Per-day `values`, however, get compared directly by raw millisecond
// difference against that local-midnight reference (getValueCache floors
// msDiff / 86_400_000 — no calendar-aware re-derivation). A local-midnight
// Date drifts by the DST offset across a transition, and a full year
// contains both a spring-forward and a fall-back: the first collapses two
// distinct real days onto the same index, and the second later leaves one
// index with no day mapped to it at all — a cell that renders as empty
// ("!value") deep in a block of genuinely future days, indistinguishable by
// color from a real data gap.
//
// Anchoring purely in UTC removes that drift between values but then drifts
// them all by a few hours relative to the reference (which is always
// re-derived in local time — see above), which can push the very first or
// last day of the range out of it entirely (it just silently disappears,
// not even rendered as empty). Fixing the UTC anchor to Jan 1st's own local
// offset splits the difference: exactly 86_400_000ms between every value
// (no DST collisions/gaps) while staying aligned with the reference at
// both range edges, which sit in the same (northern-winter) DST regime.
function shiftBackUTC(d: Date, refOffsetMin: number): Date {
  const utcMidnight = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  return new Date(utcMidnight + refOffsetMin * 60_000);
}

export default function ListeningHeatmap({ userRef, initial }: { userRef: string; initial: ListeningHeatmapData }) {
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [data, setData] = useState<ListeningHeatmapData>(initial);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedYear === null || selectedYear === initial.year) {
      setData(initial);
      return;
    }
    let alive = true;
    setLoading(true);
    api<ListeningHeatmapData>(`/users/${encodeURIComponent(userRef)}/listening-heatmap`, {
      params: { year: selectedYear },
    })
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userRef, selectedYear, initial]);

  const now = new Date();
  const activeYear = data.year;
  const years = data.years;
  const isCurrentYear = activeYear === now.getFullYear();
  const todayKey = dateKey(now);

  // One extra day of padding before Jan 1st: the library's own index-range
  // check is otherwise exactly one short of covering it (regardless of DST),
  // silently dropping that cell entirely.
  const gridStart = shiftBackLocal(new Date(activeYear, 0, 1));
  gridStart.setDate(gridStart.getDate() - 1);
  const gridEnd = shiftBackLocal(new Date(activeYear, 11, 31));

  const refOffsetMin = new Date(activeYear, 0, 1).getTimezoneOffset();
  const values: DayValue[] = [];
  for (let d = new Date(activeYear, 0, 1); d.getFullYear() === activeYear; d.setDate(d.getDate() + 1)) {
    const realKey = dateKey(d);
    values.push({
      date: shiftBackUTC(d, refOffsetMin),
      realKey,
      seconds: data.days[realKey] ?? 0,
      future: isCurrentYear && realKey > todayKey,
    });
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <span className="eyebrow">Активность</span>
        <select
          className={styles.yearSelect}
          disabled={years.length <= 1}
          value={activeYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.scroll} style={{ opacity: loading ? 0.5 : 1 }}>
        <div className={styles.weekdayCol}>
          {WEEKDAY_ROWS.map(({ label, centerPct }) => (
            <span key={label} className={styles.weekdayLabel} style={{ top: `${centerPct * 100}%` }}>
              {label}
            </span>
          ))}
        </div>
        <CalendarHeatmap
          startDate={gridStart}
          endDate={gridEnd}
          monthLabels={MONTH_LABELS}
          showWeekdayLabels={false}
          gutterSize={2}
          values={values}
          classForValue={(v) => {
            const value = v as DayValue | undefined;
            if (!value) return styles.level0;
            if (value.future) return styles.future;
            return styles[`level${heatLevel(value.seconds)}`];
          }}
          titleForValue={(v) => {
            const value = v as DayValue | undefined;
            if (!value || value.future) return '';
            return `${formatDate(value.realKey)} — ${(value.seconds / 3600).toFixed(1)} ч`;
          }}
        />
      </div>
    </div>
  );
}
