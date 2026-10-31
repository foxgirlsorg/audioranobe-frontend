'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { errMsg, useToast } from '@/lib/toast';
import { chapterNumberLabel } from '@/lib/format';
import type { TextChapter, TitleFull } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import Toggle from '@/components/Toggle/Toggle';
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog';
import { announcementLine } from '@/lib/ttsMode';
import BookImportModal from './BookImportModal';
import TextEditorModal from './TextEditorModal';
import { AddChapterModal, EditVolumeModal, MoveModal, type VolumeOption } from './TextDialogs';
import styles from './TextBranch.module.css';

type Filter = 'all' | 'edited' | 'off';
type Bulk = 'enable' | 'disable' | 'remove' | 'resync';

const CPS = 14;
const minutes = (chars: number): string => {
  const s = Math.round(chars / CPS);
  return s < 60 ? `${s} с` : `${Math.floor(s / 60)} мин${s % 60 ? ` ${s % 60} с` : ''}`;
};
const date = (ts: number): string => new Date(ts * 1000).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

interface VolumeGroup {
  id: number;
  number: number;
  name: string;
  chapters: TextChapter[];
}

export default function TextBranchManager({ title, onReload }: { title: TitleFull; onReload: () => Promise<void> | void }) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(title.text_branch?.enabled ?? true);
  const [chapters, setChapters] = useState<TextChapter[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<Set<number> | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<TextChapter | null>(null);
  const [confirm, setConfirm] = useState<{ ids: number[]; action: 'remove' | 'resync' } | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editVolume, setEditVolume] = useState<VolumeOption | null>(null);
  const [moving, setMoving] = useState<number[] | null>(null);

  const volumeOptions = useMemo<VolumeOption[]>(
    () => [...title.volumes].sort((a, b) => a.number - b.number).map((v) => ({ id: v.id, number: v.number, name: v.name })),
    [title.volumes],
  );
  const nextNumber = (volumeId: number): number =>
    Math.floor(Math.max(0, ...(chapters ?? []).filter((c) => c.volume_id === volumeId).map((c) => c.number))) + 1;

  const load = useCallback(async () => {
    try {
      const r = await api<{ enabled: boolean; chapters: TextChapter[] }>(`/panel/titles/${title.id}/texts`);
      setChapters(r.chapters);
      setEnabled(r.enabled);
      setError('');
    } catch (e) {
      setError(errMsg(e));
    }
  }, [title.id]);
  useEffect(() => { void load(); }, [load]);

  const groups = useMemo<VolumeGroup[]>(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<number, VolumeGroup>();
    for (const c of chapters ?? []) {
      if (filter === 'edited' && !c.edited) continue;
      if (filter === 'off' && c.enabled && !c.removed) continue;
      if (q && !`${c.name} ${chapterNumberLabel(c.number, c.number_end)}`.toLowerCase().includes(q)) continue;
      let g = map.get(c.volume_id);
      if (!g) {
        g = { id: c.volume_id, number: c.volume_number, name: c.volume_name, chapters: [] };
        map.set(c.volume_id, g);
      }
      g.chapters.push(c);
    }
    return [...map.values()].sort((a, b) => a.number - b.number);
  }, [chapters, query, filter]);

  const isOpen = (g: VolumeGroup): boolean => (open ? open.has(g.id) : groups.length <= 3 || g.id === groups[groups.length - 1]?.id);
  const toggleOpen = (g: VolumeGroup) => {
    const base = open ?? new Set(groups.filter(isOpen).map((x) => x.id));
    const next = new Set(base);
    if (next.has(g.id)) next.delete(g.id);
    else next.add(g.id);
    setOpen(next);
  };

  const totals = useMemo(() => {
    const live = (chapters ?? []).filter((c) => !c.removed);
    return { n: live.length, chars: live.reduce((a, c) => a + c.chars, 0) };
  }, [chapters]);

  const flip = (ids: number[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) (on ? next.add(id) : next.delete(id));
      return next;
    });

  const allIds = groups.flatMap((g) => g.chapters.map((c) => c.id));
  const allOn = allIds.length > 0 && allIds.every((id) => selected.has(id));

  async function setBranch(next: boolean) {
    setBusy(true);
    try {
      await api(`/panel/titles/${title.id}/texts`, { method: 'PUT', body: { enabled: next } });
      setEnabled(next);
      toast(next ? 'Озвучка в браузере включена' : 'Озвучка в браузере отключена');
      await onReload();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function run(ids: number[], action: Bulk) {
    if (ids.length === 0) return;
    setBusy(true);
    try {
      await api('/panel/texts', { method: 'POST', body: { ids, action } });
      toast(
        action === 'remove' ? 'Тексты удалены' : action === 'resync' ? 'Тексты обновлены из источника' : action === 'enable' ? 'Озвучка включена' : 'Озвучка отключена',
      );
      setSelected(new Set());
      await Promise.all([load(), onReload()]);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className={styles.error}>{error}</p>;
  if (!chapters) return <div className={styles.center}><Spinner /></div>;

  const picked = [...selected];
  const editable = chapters.filter((c) => !c.removed);
  const editIndex = editing ? editable.findIndex((c) => c.id === editing.id) : -1;
  const editorCaption = (c: TextChapter): string =>
    `${title.volume_label} ${chapterNumberLabel(c.volume_number)} · глава ${chapterNumberLabel(c.number, c.number_end)} · AudioRanobe AI`;

  return (
    <div className={styles.root}>
      <div className={styles.branch}>
        <div className={styles.branchText}>
          <b>Озвучка в браузере</b>
        </div>
        <dl className={styles.nums}>
          <div><dt>глав</dt><dd>{totals.n}</dd></div>
          <div><dt>знаков</dt><dd>{totals.chars.toLocaleString('ru-RU')}</dd></div>
          <div><dt>на 1×</dt><dd>≈ {minutes(totals.chars)}</dd></div>
        </dl>
        <Toggle checked={enabled} disabled={busy} onChange={setBranch} label={enabled ? 'Включена' : 'Отключена'} />
      </div>

      <div className={styles.toolbar}>
        <button
          type="button"
          className={allOn ? `${styles.cb} ${styles.cbOn}` : styles.cb}
          aria-label="Выбрать все"
          onClick={() => flip(allIds, !allOn)}
        >
          {allOn ? '✓' : ''}
        </button>
        <input
          className={`input ${styles.search}`}
          placeholder="Поиск по названию или номеру"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {(['all', 'edited', 'off'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            className={filter === f ? `${styles.filter} ${styles.filterOn}` : styles.filter}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'Все' : f === 'edited' ? 'Изменённые' : 'Отключённые'}
          </button>
        ))}
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy || chapters.length === 0}
          onClick={() => setConfirm({ ids: chapters.map((c) => c.id), action: 'resync' })}
        >
          Обновить из источника
        </button>
        <button type="button" className="btn btn-ghost" disabled={volumeOptions.length === 0} onClick={() => setAdding(true)}>
          Добавить главу
        </button>
        {totals.n === 0 ? (
          <button type="button" className="btn btn-ghost" onClick={() => setImporting(true)}>
            Импорт из файла
          </button>
        ) : null}
      </div>

      {groups.length === 0 ? <p className={styles.empty}>Ничего не найдено.</p> : null}

      {groups.map((g) => {
        const ids = g.chapters.map((c) => c.id);
        const on = ids.filter((id) => selected.has(id)).length;
        const live = g.chapters.filter((c) => !c.removed);
        return (
          <section key={g.id} className={styles.vol}>
            <div className={styles.volHead}>
              <button
                type="button"
                className={on === ids.length ? `${styles.cb} ${styles.cbOn}` : on > 0 ? `${styles.cb} ${styles.cbPart}` : styles.cb}
                aria-label={`Выбрать том ${chapterNumberLabel(g.number)}`}
                onClick={() => flip(ids, on !== ids.length)}
              >
                {on === ids.length ? '✓' : on > 0 ? '–' : ''}
              </button>
              <button type="button" className={styles.volToggle} onClick={() => toggleOpen(g)} aria-expanded={isOpen(g)}>
                {isOpen(g) ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                <h3>{`${title.volume_label} ${chapterNumberLabel(g.number)}`}{g.name ? ` · ${g.name}` : ''}</h3>
                <span>{`${live.length} гл. · ${live.reduce((a, c) => a + c.chars, 0).toLocaleString('ru-RU')} зн.`}</span>
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setEditVolume({ id: g.id, number: g.number, name: g.name })}
              >
                {`Править ${title.volume_label.toLowerCase()}`}
              </button>
            </div>
            {isOpen(g)
              ? g.chapters.map((c) => (
                  <div
                    key={c.id}
                    className={[styles.row, selected.has(c.id) ? styles.rowSel : '', !c.enabled || c.removed ? styles.rowOff : ''].filter(Boolean).join(' ')}
                  >
                    <button
                      type="button"
                      className={selected.has(c.id) ? `${styles.cb} ${styles.cbOn}` : styles.cb}
                      aria-label={`Выбрать главу ${chapterNumberLabel(c.number, c.number_end)}`}
                      onClick={() => flip([c.id], !selected.has(c.id))}
                    >
                      {selected.has(c.id) ? '✓' : ''}
                    </button>
                    <span className={styles.num}>{chapterNumberLabel(c.number, c.number_end)}</span>
                    <span className={styles.name}>
                      {c.name || `Глава ${chapterNumberLabel(c.number, c.number_end)}`}
                      <small>
                        {c.removed ? (
                          'текст удалён'
                        ) : (
                          <>
                            {c.edited ? <><Pencil size={11} aria-hidden="true" />{' изменён вручную · '}</> : null}
                            {date(c.updated_at)}
                          </>
                        )}
                      </small>
                    </span>
                    <span className={styles.len}>
                      {c.removed ? '—' : `${c.chars.toLocaleString('ru-RU')} зн.`}
                      {c.removed ? null : <small>{`≈ ${minutes(c.chars)}`}</small>}
                    </span>
                    <span className={styles.act}>
                      {!c.removed && !c.enabled ? <em className={styles.offTag}>Отключена</em> : null}
                      {c.removed ? (
                        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setConfirm({ ids: [c.id], action: 'resync' })}>
                          Восстановить
                        </button>
                      ) : (
                        <>
                          <button type="button" className={styles.iconBtn} title="Править текст" aria-label="Править текст" onClick={() => setEditing(c)}>
                            <Pencil size={14} />
                          </button>
                          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void run([c.id], c.enabled ? 'disable' : 'enable')}>
                            {c.enabled ? 'Отключить' : 'Включить'}
                          </button>
                        </>
                      )}
                    </span>
                  </div>
                ))
              : null}
          </section>
        );
      })}

      <div className={styles.danger}>
        <div>
          <b>Удалить все тексты ветки</b>
          <small>Ветка AudioRanobe AI исчезнет, аудио других веток не затрагивается.</small>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy || totals.n === 0}
          onClick={() => setConfirm({ ids: chapters.filter((c) => !c.removed).map((c) => c.id), action: 'remove' })}
        >
          Удалить все тексты
        </button>
      </div>

      {picked.length > 0 ? (
        <div className={styles.bulk} role="region" aria-label="Действия с выбранными главами">
          <b>{`Выбрано: ${picked.length}`}</b>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setConfirm({ ids: picked, action: 'resync' })}>Обновить из источника</button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void run(picked, 'disable')}>Отключить озвучку</button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void run(picked, 'enable')}>Включить озвучку</button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setMoving(picked)}>{`Переместить в ${title.volume_label.toLowerCase()}…`}</button>
          <span className={styles.grow} />
          <button type="button" className={`btn btn-ghost ${styles.dng}`} disabled={busy} onClick={() => setConfirm({ ids: picked, action: 'remove' })}>Удалить тексты</button>
          <button type="button" className="btn btn-ghost" onClick={() => setSelected(new Set())}>Снять выбор</button>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && void run(confirm.ids, confirm.action)}
        danger
        title={confirm?.action === 'remove' ? `Удалить тексты: ${confirm.ids.length}?` : `Обновить из источника: ${confirm?.ids.length ?? 0}?`}
        body={
          confirm?.action === 'remove'
            ? 'Тексты будут удалены, источник их заново не подтянет.'
            : 'Сохранённые тексты, включая правки, заменятся оригиналами из источника.'
        }
      />

      {adding ? (
        <AddChapterModal
          titleId={title.id}
          volumes={volumeOptions}
          volumeWord={title.volume_label}
          defaultVolumeId={groups[groups.length - 1]?.id ?? volumeOptions[volumeOptions.length - 1].id}
          nextNumber={nextNumber}
          onClose={() => setAdding(false)}
          onDone={async () => { await Promise.all([load(), onReload()]); }}
        />
      ) : null}

      {editVolume ? (
        <EditVolumeModal
          volume={editVolume}
          volumeWord={title.volume_label}
          onClose={() => setEditVolume(null)}
          onDone={async () => { await Promise.all([load(), onReload()]); }}
        />
      ) : null}

      {moving ? (
        <MoveModal
          titleId={title.id}
          ids={moving}
          volumes={volumeOptions}
          volumeWord={title.volume_label}
          onClose={() => setMoving(null)}
          onDone={async () => { setSelected(new Set()); await Promise.all([load(), onReload()]); }}
        />
      ) : null}

      {importing ? (
        <BookImportModal
          titleId={title.id}
          volumeWord={title.volume_label}
          defaultVolume={title.volumes.length === 0 ? 1 : Math.max(...title.volumes.map((v) => v.number)) + 1}
          onClose={() => setImporting(false)}
          onDone={async () => { await Promise.all([load(), onReload()]); }}
        />
      ) : null}

      {editing ? (
        <TextEditorModal
          chapter={editing}
          caption={editorCaption(editing)}
          announcement={announcementLine({
            volumeCount: title.volumes.length,
            volumeLabel: title.volume_label,
            volumeNumber: editing.volume_number,
            number: editing.number,
            numberEnd: editing.number_end,
            name: editing.name,
          })}
          canPrev={editIndex > 0}
          canNext={editIndex >= 0 && editIndex < editable.length - 1}
          onNavigate={(d) => setEditing(editable[editIndex + d] ?? editing)}
          onClose={() => setEditing(null)}
          onSaved={async () => { await Promise.all([load(), onReload()]); }}
          onRemove={(id) => { setEditing(null); setConfirm({ ids: [id], action: 'remove' }); }}
          onResync={(id) => { setEditing(null); setConfirm({ ids: [id], action: 'resync' }); }}
        />
      ) : null}
    </div>
  );
}
