'use client';

import React, { useMemo, useRef, useState } from 'react';
import { ArrowUpToLine, FileUp } from 'lucide-react';
import { api } from '@/lib/api';
import { errMsg, useToast } from '@/lib/toast';
import { parseBook, withoutFirstLine, type BookChapter } from '@/lib/bookImport';
import Modal from '@/components/Modal/Modal';
import Toggle from '@/components/Toggle/Toggle';
import Spinner from '@/components/Spinner/Spinner';
import styles from './TextBranch.module.css';

interface Row extends BookChapter {
  on: boolean;
}

const SHORT = 200;

export default function BookImportModal({
  titleId,
  volumeWord,
  defaultVolume,
  onClose,
  onDone,
}: {
  titleId: number;
  volumeWord: string;
  defaultVolume: number;
  onClose: () => void;
  onDone: () => Promise<void> | void;
}) {
  const { toast } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [parsing, setParsing] = useState(false);
  const [stripFirst, setStripFirst] = useState(false);
  const [fromZero, setFromZero] = useState(false);
  const [volume, setVolume] = useState(String(defaultVolume));
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const body = (r: Row): string => (stripFirst ? withoutFirstLine(r.text) : r.text);

  const picked = useMemo(() => (rows ?? []).filter((r) => r.on && body(r).trim() !== ''), [rows, stripFirst]);
  const chars = picked.reduce((n, r) => n + body(r).length, 0);

  async function load(file: File) {
    setParsing(true);
    setRows(null);
    setFileName(file.name);
    try {
      const parsed = await parseBook(file);
      setRows(parsed.map((c) => ({ ...c, on: c.text.length >= SHORT })));
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setParsing(false);
    }
  }

  const mergeUp = (i: number) =>
    setRows((prev) => {
      if (!prev || i < 1) return prev;
      const next = [...prev];
      next[i - 1] = { ...next[i - 1], text: `${next[i - 1].text}\n${next[i].text}` };
      next.splice(i, 1);
      return next;
    });

  const patch = (i: number, p: Partial<Row>) =>
    setRows((prev) => (prev ? prev.map((r, k) => (k === i ? { ...r, ...p } : r)) : prev));

  async function submit() {
    const v = Number(volume);
    if (!Number.isFinite(v) || v < 0) {
      toast('Номер тома должен быть числом не меньше 0', 'error');
      return;
    }
    setBusy(true);
    try {
      await api(`/panel/titles/${titleId}/texts/import`, {
        method: 'POST',
        body: { volume: v, from_zero: fromZero, chapters: picked.map((r) => ({ name: r.name, text: body(r) })) },
      });
      toast(`Импортировано глав: ${picked.length}`);
      await onDone();
      onClose();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  const allOn = rows !== null && rows.every((r) => r.on);

  return (
    <Modal open onClose={onClose} title="Импорт из файла" subtitle="EPUB или FB2" size="wide">
      <div className={styles.form}>
        <input
          ref={input}
          type="file"
          accept=".epub,.fb2"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void load(f);
            e.target.value = '';
          }}
        />
        <div className={styles.importPick}>
          <button type="button" className={styles.mbtn} disabled={parsing || busy} onClick={() => input.current?.click()}>
            <FileUp size={15} />
            {rows ? 'Другой файл' : 'Выбрать файл'}
          </button>
          <span className={styles.importFile}>{fileName || 'Файл не выбран'}</span>
        </div>

        {parsing ? <div className={styles.center}><Spinner /></div> : null}

        {rows ? (
          <>
            <div className={styles.formRow}>
              <label className={styles.field}>
                <span>{volumeWord}, в который добавить главы</span>
                <input className="input" type="number" step="any" min={0} value={volume} onChange={(e) => setVolume(e.target.value)} />
              </label>
            </div>
            <Toggle
              checked={fromZero}
              onChange={setFromZero}
              label="Нумеровать с нуля"
              hint="Первая глава получит номер 0 — для пролога. Иначе нумерация начинается с 1."
            />
            <Toggle
              checked={stripFirst}
              onChange={setStripFirst}
              label="Убрать первую строку глав"
              hint="Включите, если первая строка каждой главы — её название: при озвучке оно не будет прочитано дважды."
            />

            <div className={styles.importHead}>
              <button
                type="button"
                className={allOn ? `${styles.cb} ${styles.cbOn}` : styles.cb}
                aria-label="Выбрать все"
                onClick={() => setRows(rows.map((r) => ({ ...r, on: !allOn })))}
              >
                {allOn ? '✓' : ''}
              </button>
              <span>Выбрано {picked.length} из {rows.length} · {chars.toLocaleString('ru-RU')} знаков</span>
            </div>

            <div className={styles.importList}>
              {rows.map((r, i) => {
                const text = body(r);
                const number = rows.slice(0, i).filter((x) => x.on && body(x).trim() !== '').length + (fromZero ? 0 : 1);
                return (
                  <div key={i} className={r.on ? styles.importRow : `${styles.importRow} ${styles.rowOff}`}>
                    <button
                      type="button"
                      className={r.on ? `${styles.cb} ${styles.cbOn}` : styles.cb}
                      aria-label="Импортировать главу"
                      onClick={() => patch(i, { on: !r.on })}
                    >
                      {r.on ? '✓' : ''}
                    </button>
                    <span className={styles.num}>{r.on ? number : '—'}</span>
                    <input
                      className={`input ${styles.importName}`}
                      value={r.name}
                      maxLength={300}
                      placeholder="Без названия"
                      onChange={(e) => patch(i, { name: e.target.value })}
                    />
                    <span className={styles.importSide}>
                      <button type="button" className={styles.importLen} onClick={() => setOpen(open === i ? null : i)}>
                        {text.length.toLocaleString('ru-RU')} зн.{text.length < SHORT ? ' · короткая' : ''} · {open === i ? 'скрыть' : 'текст'}
                      </button>
                      {i > 0 ? (
                        <button type="button" className={styles.sq} title="Склеить с предыдущей главой" aria-label="Склеить с предыдущей главой" onClick={() => mergeUp(i)}>
                          <ArrowUpToLine size={14} />
                        </button>
                      ) : null}
                    </span>
                    {open === i ? (
                      <p className={styles.importExcerpt}>{text}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </>
        ) : null}

        <div className={styles.mfoot}>
          <button type="button" className={styles.mbtn} onClick={onClose}>Отмена</button>
          <button
            type="button"
            className={`${styles.mbtn} ${styles.mbtnPri}`}
            disabled={busy || picked.length === 0}
            onClick={() => void submit()}
          >
            {busy ? 'Импортируем…' : `Импортировать${picked.length ? ` (${picked.length})` : ''}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
