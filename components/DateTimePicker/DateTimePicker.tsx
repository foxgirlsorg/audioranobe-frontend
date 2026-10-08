'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import styles from './DateTimePicker.module.css';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const pad = (n: number) => String(n).padStart(2, '0');

export const toLocalInput = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

function parse(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export default function DateTimePicker({
  value,
  onChange,
  placeholder = 'Не ограничено',
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const selected = parse(value);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => startOfDay(selected ?? new Date()));
  const rootRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const trigger = rootRef.current?.getBoundingClientRect();
      const pop = popRef.current;
      if (!trigger || !pop) return;
      const h = pop.offsetHeight;
      const w = pop.offsetWidth;
      const below = trigger.bottom + 8;
      const top = below + h > window.innerHeight - 8 && trigger.top - 8 - h > 8 ? trigger.top - 8 - h : below;
      const left = Math.max(8, Math.min(trigger.left, window.innerWidth - w - 8));
      setPos({ top, left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, view]);

  const today = startOfDay(new Date());
  const days = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, i) => new Date(view.getFullYear(), view.getMonth(), 1 - offset + i));
  }, [view]);

  const hours = selected?.getHours() ?? 12;
  const minutes = selected?.getMinutes() ?? 0;

  const commit = (day: Date, h: number, m: number) =>
    onChange(toLocalInput(new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m)));

  const pickDay = (day: Date) => {
    if (day < today) return;
    commit(day, hours, minutes);
  };

  const setTime = (h: number, m: number) => {
    const base = selected ?? new Date();
    commit(base, ((h % 24) + 24) % 24, ((m % 60) + 60) % 60);
  };

  const shiftMonth = (delta: number) => setView(new Date(view.getFullYear(), view.getMonth() + delta, 1));

  const label = selected
    ? selected.toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';
  const monthTitle = view.toLocaleString('ru-RU', { month: 'long', year: 'numeric' });

  return (
    <div className={styles.root} ref={rootRef}>
      <div className={styles.trigger}>
        <button type="button" className={styles.field} onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open}>
          <CalendarDays size={15} />
          <span className={label ? styles.value : styles.placeholder}>{label || placeholder}</span>
        </button>
        {selected ? (
          <button type="button" className={styles.clear} onClick={() => onChange('')} aria-label="Сбросить" title="Сбросить">
            <X size={14} />
          </button>
        ) : null}
      </div>

      {open && typeof document !== 'undefined'
        ? createPortal(
        <div
          ref={popRef}
          className={`glass-panel ${styles.popover}`}
          style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden' }}
          role="dialog"
          aria-label="Выбор даты и времени"
        >
          <div className={styles.monthRow}>
            <button type="button" className={styles.nav} onClick={() => shiftMonth(-1)} aria-label="Предыдущий месяц">
              <ChevronLeft size={16} />
            </button>
            <span className={styles.month}>{monthTitle}</span>
            <button type="button" className={styles.nav} onClick={() => shiftMonth(1)} aria-label="Следующий месяц">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className={styles.weekdays}>
            {WEEKDAYS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
          <div className={styles.grid}>
            {days.map((d) => {
              const past = d < today;
              const outside = d.getMonth() !== view.getMonth();
              const isSel = selected ? sameDay(d, selected) : false;
              return (
                <button
                  key={d.getTime()}
                  type="button"
                  disabled={past}
                  onClick={() => pickDay(d)}
                  className={`${styles.day} ${outside ? styles.outside : ''} ${isSel ? styles.selected : ''} ${sameDay(d, today) ? styles.today : ''}`}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          <div className={styles.timeRow}>
            <span className={styles.timeLabel}>{'Время'}</span>
            <div className={styles.time}>
              <input
                className={styles.timeInput}
                inputMode="numeric"
                value={pad(hours)}
                aria-label="Часы"
                onChange={(e) => {
                  const n = Number(e.target.value.replace(/\D/g, '').slice(-2));
                  if (Number.isFinite(n)) setTime(Math.min(n, 23), minutes);
                }}
                onWheel={(e) => setTime(hours + (e.deltaY < 0 ? 1 : -1), minutes)}
              />
              <span>{':'}</span>
              <input
                className={styles.timeInput}
                inputMode="numeric"
                value={pad(minutes)}
                aria-label="Минуты"
                onChange={(e) => {
                  const n = Number(e.target.value.replace(/\D/g, '').slice(-2));
                  if (Number.isFinite(n)) setTime(hours, Math.min(n, 59));
                }}
                onWheel={(e) => setTime(hours, minutes + (e.deltaY < 0 ? 5 : -5))}
              />
            </div>
          </div>
          <div className={styles.foot}>
            <button type="button" className="btn btn-ghost" onClick={() => { onChange(''); setOpen(false); }}>
              {'Сбросить'}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setOpen(false)}>
              {'Готово'}
            </button>
          </div>
        </div>,
            document.body
          )
        : null}
    </div>
  );
}
