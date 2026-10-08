'use client';

import { Plus, X } from 'lucide-react';
import DateTimePicker, { toLocalInput } from '@/components/DateTimePicker/DateTimePicker';
import type { Poll } from '@/lib/types';
import styles from './PollBuilder.module.css';

export interface PollDraftOption {
  id?: number;
  text: string;
}

export interface PollDraft {
  title: string;
  options: PollDraftOption[];
  closesAt: string;
}

export interface PollPayload {
  title: string;
  options: string[];
  closes_at?: number;
}

export interface PollEditPayload {
  title: string;
  options: { id?: number; text: string }[];
  closes_at?: number | null;
  reopen?: true;
}

export const MAX_POLL_OPTIONS = 10;

export const emptyPollDraft = (): PollDraft => ({ title: '', options: [{ text: '' }, { text: '' }], closesAt: '' });

export const pollToDraft = (p: Poll): PollDraft => ({
  title: p.title,
  options: p.options.map((o) => ({ id: o.id, text: o.text })),
  closesAt: p.closes_at ? toLocalInput(new Date(p.closes_at * 1000)) : '',
});

function validate(d: PollDraft): { title: string; options: PollDraftOption[] } | string {
  const title = d.title.trim();
  const options = d.options.map((o) => ({ ...o, text: o.text.trim() })).filter((o) => o.text);
  if (!title) return 'Укажите вопрос опроса';
  if (options.length < 2) return 'В опросе нужно минимум два варианта';
  return { title, options };
}

function toUnix(local: string): number | string {
  const ts = Math.floor(new Date(local).getTime() / 1000);
  if (!Number.isFinite(ts) || ts * 1000 <= Date.now()) return 'Время окончания опроса должно быть в будущем';
  return ts;
}

export function pollPayload(d: PollDraft): PollPayload | string {
  const v = validate(d);
  if (typeof v === 'string') return v;
  const out: PollPayload = { title: v.title, options: v.options.map((o) => o.text) };
  if (d.closesAt) {
    const ts = toUnix(d.closesAt);
    if (typeof ts === 'string') return ts;
    out.closes_at = ts;
  }
  return out;
}

export function pollEditPayload(d: PollDraft, original: PollDraft, reopen: boolean): PollEditPayload | string {
  const v = validate(d);
  if (typeof v === 'string') return v;
  const out: PollEditPayload = { title: v.title, options: v.options };
  if (d.closesAt !== original.closesAt) {
    if (d.closesAt) {
      const ts = toUnix(d.closesAt);
      if (typeof ts === 'string') return ts;
      out.closes_at = ts;
    } else {
      out.closes_at = null;
    }
  }
  if (reopen) out.reopen = true;
  return out;
}

export default function PollBuilder({
  value,
  onChange,
}: {
  value: PollDraft | null;
  onChange: (next: PollDraft | null) => void;
}) {
  if (!value) {
    return (
      <button type="button" className="btn btn-ghost" onClick={() => onChange(emptyPollDraft())}>
        <Plus size={15} />
        {'Добавить опрос'}
      </button>
    );
  }

  const setOption = (i: number, text: string) =>
    onChange({ ...value, options: value.options.map((o, j) => (j === i ? { ...o, text } : o)) });

  return (
    <div className={`glass-panel ${styles.box}`}>
      <div className={styles.head}>
        <span className={styles.label}>{'Опрос'}</span>
        <button type="button" className="btn btn-ghost" onClick={() => onChange(null)}>
          {'Убрать'}
        </button>
      </div>
      <input
        className="input"
        value={value.title}
        maxLength={255}
        placeholder="Вопрос"
        onChange={(e) => onChange({ ...value, title: e.target.value })}
      />
      <ul className={styles.options}>
        {value.options.map((o, i) => (
          <li key={o.id ?? `new-${i}`} className={styles.row}>
            <input
              className="input"
              value={o.text}
              maxLength={100}
              placeholder={`Вариант ${i + 1}`}
              onChange={(e) => setOption(i, e.target.value)}
            />
            {value.options.length > 2 ? (
              <button
                type="button"
                className="btn btn-ghost"
                title="Убрать вариант"
                onClick={() => onChange({ ...value, options: value.options.filter((_, j) => j !== i) })}
              >
                <X size={14} />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {value.options.length < MAX_POLL_OPTIONS ? (
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => onChange({ ...value, options: [...value.options, { text: '' }] })}
        >
          <Plus size={14} />
          {'Добавить вариант'}
        </button>
      ) : null}
      <div className={styles.close}>
        <span className={styles.label}>{'Завершить автоматически'}</span>
        <DateTimePicker value={value.closesAt} onChange={(closesAt) => onChange({ ...value, closesAt })} />
      </div>
    </div>
  );
}
