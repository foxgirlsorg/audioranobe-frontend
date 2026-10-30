'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronRight,
  Flame,
  Layers,
  Users,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { uploadInChunks } from '@/lib/upload';
import { useAuth } from '@/lib/auth';
import { useToast, errMsg } from '@/lib/toast';
import { formatDuration, formatDateTime, timeAgo, chapterLabel, chapterNumberLabel } from '@/lib/format';
import type { ChapterRow, JobsPage, TitleFull, TitleVersion, Volume } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import Pagination from '@/components/Pagination/Pagination';
import EmptyState from '@/components/EmptyState/EmptyState';
import StatusBadge from '@/components/StatusBadge/StatusBadge';
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog';
import Modal from '@/components/Modal/Modal';
import styles from './TitleContentManager.module.css';
import Select from '@/components/Select/Select';
import Toggle from '@/components/Toggle/Toggle';

const AUDIO_RE = /\.(mp3|m4a|m4b|aac|wav|ogg|opus|flac)$/i;
const MAX_AUDIO_BYTES = 2 * 1024 * 1024 * 1024;
const AUDIO_ACCEPT = '.mp3,.m4a,.m4b,.aac,.wav,.ogg,.opus,.flac,audio/*';
const JOBS_PER_PAGE = 30;

const naturalCompare = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

// Soft-deleted chapters are gone as far as counts and numbering are concerned.
const liveChapters = (v: Volume): ChapterRow[] => v.chapters.filter((c) => !c.is_deleted);

const nextNumberIn = (v: Volume): number =>
  Math.floor(Math.max(0, ...liveChapters(v).map((c) => c.number_end ?? c.number))) + 1;

const formatNumber = (n: number): string => String(Math.round(n * 1000) / 1000);

interface StagedFile {
  key: string;
  file: File;
  number: string;
  name: string;
  state: 'queued' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
}

const RANGE_RE = /^(\d+(?:[.,]\d+)?)(?:\s*[-–—]\s*(\d+(?:[.,]\d+)?))?$/;

function parseChapterNo(
  text: string,
  allowRange: boolean
): { n: number; end: number | null } | string {
  const m = RANGE_RE.exec(text.trim());
  if (!m) return allowRange ? 'Введите номер: 25 или 30–35' : 'Введите номер, например 25';
  const n = Number(m[1].replace(',', '.'));
  if (m[2] === undefined) return { n, end: null };
  if (!allowRange) return 'Диапазон глав доступен только модераторам';
  const end = Number(m[2].replace(',', '.'));
  if (!(end > n)) return 'Конец диапазона должен быть больше начала';
  return { n, end };
}

const chapterNoText = (n: number, end: number | null): string =>
  end != null ? `${formatNumber(n)}–${formatNumber(end)}` : formatNumber(n);

const formatSize = (b: number): string =>
  b >= 1024 * 1024 * 1024
    ? `${(b / 1024 / 1024 / 1024).toFixed(1)} ГБ`
    : `${Math.max(1, Math.round(b / 1024 / 1024))} МБ`;

const stripExt = (name: string): string => name.replace(/\.[^.]+$/, '');

type NarratorOpt = { id: number; name: string };

function NarratorChecklist({
  all,
  value,
  onChange,
}: {
  all: NarratorOpt[];
  value: number[];
  onChange: (ids: number[]) => void;
}) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const shown = needle ? all.filter((n) => n.name.toLowerCase().includes(needle)) : all;
  const toggle = (id: number) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className={styles.narList}>
      {all.length > 6 ? (
        <input
          className="input"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Найти чтеца"
          aria-label="Найти чтеца"
        />
      ) : null}
      <div className={styles.narOptions} role="group" aria-label="Чтецы">
        {shown.map((n) => (
          <label key={n.id} className={styles.narOpt}>
            <input
              type="checkbox"
              className={styles.selectBox}
              checked={value.includes(n.id)}
              onChange={() => toggle(n.id)}
            />
            {n.name}
          </label>
        ))}
        {shown.length === 0 ? <p className={styles.narEmpty}>Никого не нашли</p> : null}
      </div>
      <p className={styles.formNote}>{`Выбрано ${value.length} из ${all.length}`}</p>
    </div>
  );
}

function ChapterNarratorPicker({
  all,
  value,
  onChange,
}: {
  all: NarratorOpt[];
  value: number[];
  onChange: (ids: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<number[]>([]);
  if (all.length === 0) return null;
  const toggle = (id: number) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  if (all.length <= 4) {
    return (
      <span className={styles.chNarratorPicker}>
        {all.map((n) => (
          <button
            key={n.id}
            type="button"
            className={value.includes(n.id) ? 'pill pill-active' : 'pill'}
            onClick={() => toggle(n.id)}
            aria-pressed={value.includes(n.id)}
          >
            {n.name}
          </button>
        ))}
      </span>
    );
  }

  const chosen = all.filter((n) => value.includes(n.id));
  return (
    <>
      <span className={styles.chNarratorPicker}>
        {chosen.map((n) => (
          <span key={n.id} className={styles.narChip}>
            {n.name}
            <button
              type="button"
              onClick={() => toggle(n.id)}
              aria-label={`Убрать чтеца ${n.name}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <button
          type="button"
          className={styles.narAdd}
          onClick={() => {
            setDraft(value);
            setOpen(true);
          }}
        >
          {chosen.length > 0 ? 'Изменить' : '+ Выбрать чтецов'}
        </button>
      </span>
      <Modal open={open} onClose={() => setOpen(false)} title="Кто читает" size="sheet">
        <div className={styles.reviewDialog}>
          <NarratorChecklist all={all} value={draft} onChange={setDraft} />
          <div className={styles.reviewActions}>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Отмена
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
            >
              {`Применить (${draft.length})`}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default function TitleContentManager({
  title,
  onReload,
}: {
  title: TitleFull;
  onReload: () => Promise<void> | void;
}) {
  const titleId = title.id;
  const { toast } = useToast();
  const { user, isMod, can } = useAuth();
  const isAdmin = can('chapters.edit');
  const canManageVersions = can('versions.manage');

  // 0 = main version; an alt version id otherwise. All chapter management on this
  // page operates on the active version.
  const [currentVersion, setCurrentVersion] = useState(0);
  const [versionForm, setVersionForm] = useState<'add' | 'rename' | 'main' | null>(null);
  const [versionName, setVersionName] = useState('');
  const [versionBusy, setVersionBusy] = useState(false);
  const [versionToDelete, setVersionToDelete] = useState<TitleVersion | null>(null);

  const [showAddVolume, setShowAddVolume] = useState(false);
  const [volNumber, setVolNumber] = useState('');
  const [volName, setVolName] = useState('');
  const [savingVolume, setSavingVolume] = useState(false);
  const [editingVolume, setEditingVolume] = useState<number | null>(null);
  const [editVolNumber, setEditVolNumber] = useState('');
  const [editVolName, setEditVolName] = useState('');
  const [volumeToDelete, setVolumeToDelete] = useState<Volume | null>(null);
  const [openVolumes, setOpenVolumes] = useState<Set<number>>(
    () =>
      new Set(
        title.volumes.length <= 3
          ? title.volumes.map((v) => v.id)
          : title.volumes.slice(-1).map((v) => v.id)
      )
  );

  const toggleVolume = (id: number) =>
    setOpenVolumes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const [savingChapter, setSavingChapter] = useState(false);
  const [editingChapter, setEditingChapter] = useState<number | null>(null);
  const [editChName, setEditChName] = useState('');
  const [editChNumber, setEditChNumber] = useState('');
  const [editChNarratorIds, setEditChNarratorIds] = useState<number[]>([]);
  const [chapterToDelete, setChapterToDelete] = useState<ChapterRow | null>(null);
  const [chapterToPurge, setChapterToPurge] = useState<ChapterRow | null>(null);

  const [bulkReview, setBulkReview] = useState<{
    decision: 'approve' | 'reject';
    volume: Volume | null;
    ids: number[] | null;
  } | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const uploadChapterRef = useRef<number | null>(null);
  const [uploads, setUploads] = useState<Record<number, number>>({});
  const altInputRef = useRef<HTMLInputElement | null>(null);
  const altSlotTarget = useRef<{ volumeId: number; number: number; narratorIds: number[] } | null>(null);
  const [altUploads, setAltUploads] = useState<Record<string, number>>({});
  const stageInputRef = useRef<HTMLInputElement | null>(null);
  const stageTarget = useRef<number | null>(null);
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [stageVolume, setStageVolume] = useState('');
  const [stageStart, setStageStart] = useState('');
  const [stageNarrators, setStageNarrators] = useState<number[]>([]);
  const [stageNames, setStageNames] = useState(false);
  const [stageRunning, setStageRunning] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const [selected, setSelected] = useState<number[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMode, setBulkMode] = useState<'move' | 'narrators' | null>(null);
  const [bulkMoveVolume, setBulkMoveVolume] = useState('');
  const [bulkNarrIds, setBulkNarrIds] = useState<number[]>([]);
  const [selectionAction, setSelectionAction] = useState<
    'approve' | 'reject' | 'delete' | 'purge' | null
  >(null);

  const [jobs, setJobs] = useState<JobsPage | null>(null);
  const [jobsPage, setJobsPage] = useState(1);

  const loadJobs = useCallback(async () => {
    try {
      setJobs(
        await api<JobsPage>(`/panel/titles/${titleId}/jobs`, {
          params: { page: jobsPage, per_page: JOBS_PER_PAGE },
        })
      );
    } catch {
      // jobs are auxiliary — keep whatever we have
    }
  }, [titleId, jobsPage]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const activeJobs = jobs?.active ?? 0;

  useEffect(() => {
    if (activeJobs === 0) return;
    const t = window.setInterval(async () => {
      try {
        const next = await api<JobsPage>(`/panel/titles/${titleId}/jobs`, {
          params: { page: jobsPage, per_page: JOBS_PER_PAGE },
        });
        setJobs(next);
        if (next.active < activeJobs) void onReload();
      } catch {
        // transient poll failure — try again next tick
      }
    }, 5000);
    return () => window.clearInterval(t);
  }, [activeJobs, titleId, jobsPage, onReload]);

  function openAddVolume() {
    const maxNum = Math.max(0, ...title.volumes.map((v) => v.number));
    setVolNumber(String(maxNum + 1));
    setVolName('');
    setShowAddVolume(true);
  }

  async function addVolume(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const n = Number(volNumber);
    if (!Number.isFinite(n) || n < 0) {
      toast('Номер тома должен быть числом не меньше 0', 'error');
      return;
    }
    setSavingVolume(true);
    try {
      await api(`/panel/titles/${titleId}/volumes`, {
        body: { number: n, name: volName.trim() },
      });
      toast('Том добавлен');
      setShowAddVolume(false);
      await onReload();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSavingVolume(false);
    }
  }

  function startEditVolume(v: Volume) {
    setEditingVolume(v.id);
    setEditVolNumber(String(v.number));
    setEditVolName(v.name);
  }

  async function saveVolume(e: React.FormEvent<HTMLFormElement>, volumeId: number) {
    e.preventDefault();
    const n = Number(editVolNumber);
    if (!Number.isFinite(n) || n < 0) {
      toast('Номер тома должен быть числом не меньше 0', 'error');
      return;
    }
    setSavingVolume(true);
    try {
      await api(`/panel/volumes/${volumeId}`, {
        method: 'PATCH',
        body: { number: n, name: editVolName.trim() },
      });
      toast('Том обновлён');
      setEditingVolume(null);
      await onReload();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSavingVolume(false);
    }
  }

  async function deleteVolume(v: Volume) {
    try {
      await api(`/panel/volumes/${v.id}`, { method: 'DELETE' });
      toast('Том удалён');
      setVolumeToDelete(null);
      await onReload();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  function startEditChapter(c: ChapterRow) {
    setEditingChapter(c.id);
    setEditChName(c.name);
    setEditChNumber(chapterNoText(c.number, c.number_end));
    setEditChNarratorIds((c.narrators ?? []).map((n) => n.id));
  }

  async function saveChapter(e: React.FormEvent<HTMLFormElement>, chapterId: number) {
    e.preventDefault();
    const parsed = parseChapterNo(editChNumber, isMod);
    if (typeof parsed === 'string') {
      toast(parsed, 'error');
      return;
    }
    const { n, end: numberEnd } = parsed;
    setSavingChapter(true);
    try {
      const body: {
        name: string;
        number: number;
        narrator_ids: number[];
        number_end?: number | null;
      } = { name: editChName.trim(), number: n, narrator_ids: editChNarratorIds };
      if (isMod) body.number_end = numberEnd;
      const res = await api<{ applied?: boolean }>(`/panel/chapters/${chapterId}`, {
        method: 'PATCH',
        body,
      });
      toast(res && res.applied === false ? 'Отправлено на модерацию' : 'Изменения применены');
      setEditingChapter(null);
      await onReload();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSavingChapter(false);
    }
  }

  async function restoreChapter(c: ChapterRow) {
    try {
      await api(`/mod/trash/chapter/${c.id}/restore`, { method: 'POST', body: {} });
      toast('Глава восстановлена');
      await onReload();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  async function deleteChapter(c: ChapterRow) {
    try {
      const res = await api<{ applied?: boolean }>(`/panel/chapters/${c.id}`, {
        method: 'DELETE',
      });
      toast(res && res.applied === false ? 'Удаление отправлено на модерацию' : 'Глава удалена');
      setChapterToDelete(null);
      await onReload();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  async function purgeChapter(c: ChapterRow) {
    try {
      await api(`/mod/chapters/${c.id}/purge`, { method: 'DELETE' });
      toast('Глава удалена навсегда');
      setChapterToPurge(null);
      await onReload();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  // A deleted chapter is an administrator's business. Everyone else — the
  // owner included — should see the volume as if it were gone.
  const visibleChapters = (v: Volume) =>
    isAdmin ? v.chapters : v.chapters.filter((c) => !c.is_deleted);

  const pendingIn = (v: Volume) =>
    v.chapters.filter((c) => c.mod_status === 'pending' && !c.is_deleted).length;

  // The active version's chapters laid over the shared volume structure. The
  // main version reads straight from title.volumes; an alt version groups its
  // own chapters into the same volumes (missing slots simply show no chapter —
  // they fall back to the main version on the title page).
  const isAlt = currentVersion !== 0;

  // Both tabs render the main volume/chapter skeleton. On an alt tab each slot
  // is overlaid with its uploaded alt chapter (if any); empty slots become grey
  // placeholders with an upload button, and new volumes/chapters can't be made.
  const displayVolumes = title.volumes;

  const altByKey = useMemo(() => {
    const m = new Map<string, ChapterRow>();
    if (isAlt) {
      for (const c of title.alt_chapters?.[String(currentVersion)] ?? []) {
        if (!c.is_deleted) m.set(`${c.volume_id}:${c.number}`, c);
      }
    }
    return m;
  }, [title, currentVersion, isAlt]);

  const altSlot = (volumeId: number, number: number): ChapterRow | null =>
    altByKey.get(`${volumeId}:${number}`) ?? null;

  // A standalone volume in an alt version has its own chapter split instead of
  // mirroring the main slots.
  const canStandalone = can('versions.standalone_volume');
  const standaloneHere = (v: Volume) =>
    isAlt &&
    (title.versions.find((x) => x.id === currentVersion)?.standalone_volume_ids?.includes(v.id) ?? false);
  const ownAltChapters = (v: Volume) =>
    (title.alt_chapters?.[String(currentVersion)] ?? [])
      .filter((c) => c.volume_id === v.id && !c.is_deleted)
      .sort((a, b) => a.number - b.number);

  async function toggleStandalone(v: Volume) {
    const next = !standaloneHere(v);
    try {
      await api(`/panel/versions/${currentVersion}/volumes/${v.id}/standalone`, {
        method: 'PUT',
        body: { standalone: next },
      });
      toast(next ? 'Том стал отдельным — своя разбивка на главы' : 'Том снова повторяет главы основной версии');
      await onReload();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  const pendingTotal = isAlt ? 0 : title.volumes.reduce((n, v) => n + pendingIn(v), 0);

  const allChapters = useMemo(
    () =>
      isAlt
        ? title.alt_chapters?.[String(currentVersion)] ?? []
        : title.volumes.flatMap((v) => v.chapters),
    [title, currentVersion, isAlt]
  );

  // A deleted version drops back to the main tab; switching versions clears any
  // cross-version selection.
  useEffect(() => {
    if (currentVersion !== 0 && !title.versions.some((v) => v.id === currentVersion)) {
      setCurrentVersion(0);
    }
  }, [title.versions, currentVersion]);
  useEffect(() => {
    setSelected([]);
  }, [currentVersion]);

  useEffect(() => {
    setSelected((prev) => {
      const live = prev.filter((id) => allChapters.some((c) => c.id === id));
      return live.length === prev.length ? prev : live;
    });
  }, [allChapters]);

  function openVersionForm(kind: 'add' | 'rename' | 'main') {
    setVersionForm(kind);
    if (kind === 'main') setVersionName(title.version_name);
    else if (kind === 'rename') {
      setVersionName(title.versions.find((v) => v.id === currentVersion)?.name ?? '');
    } else setVersionName('');
  }

  async function submitVersionForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = versionName.trim();
    if (!name) {
      toast('Укажите название версии', 'error');
      return;
    }
    setVersionBusy(true);
    try {
      if (versionForm === 'add') {
        await api(`/panel/titles/${titleId}/versions`, { body: { name } });
        toast('Версия добавлена');
      } else if (versionForm === 'main') {
        await api(`/panel/titles/${titleId}/version-name`, { method: 'PUT', body: { name } });
        toast('Название версии обновлено');
      } else {
        await api(`/panel/versions/${currentVersion}`, { method: 'PATCH', body: { name } });
        toast('Версия переименована');
      }
      setVersionForm(null);
      setVersionName('');
      await onReload();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setVersionBusy(false);
    }
  }

  async function deleteVersion(v: TitleVersion) {
    try {
      await api(`/panel/versions/${v.id}`, { method: 'DELETE' });
      toast('Версия удалена');
      setVersionToDelete(null);
      setCurrentVersion(0);
      await onReload();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  const toggleSelected = (id: number) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  function toggleVolumeSelection(v: Volume) {
    const ids = visibleChapters(v).map((c) => c.id);
    const allOn = ids.every((id) => selected.includes(id));
    setSelected((prev) =>
      allOn ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]
    );
  }

  function openBulkReview(
    decision: 'approve' | 'reject',
    volume: Volume | null,
    ids: number[] | null = null
  ) {
    setReviewNote('');
    setBulkReview({ decision, volume, ids });
  }

  async function runOnSelection(path: (id: number) => string, method: string): Promise<number> {
    let done = 0;
    for (const id of selected) {
      await api(path(id), { method });
      done++;
    }
    return done;
  }

  async function submitSelectionAction() {
    if (!selectionAction || selected.length === 0) return;
    setBulkBusy(true);
    try {
      if (selectionAction === 'purge') {
        const n = await runOnSelection((id) => `/mod/chapters/${id}/purge`, 'DELETE');
        toast(`Удалено навсегда: ${n}`);
      } else {
        const n = await runOnSelection((id) => `/panel/chapters/${id}`, 'DELETE');
        toast(`Удалено глав: ${n}`);
      }
      setSelected([]);
      setSelectionAction(null);
      await onReload();
    } catch (err) {
      toast(errMsg(err), 'error');
      await onReload();
    } finally {
      setBulkBusy(false);
    }
  }

  async function submitBulkEdit() {
    if (selected.length === 0 || bulkMode === null) return;
    const body: { chapter_ids: number[]; volume_id?: number; narrator_ids?: number[] } = {
      chapter_ids: selected,
    };
    if (bulkMode === 'move') {
      if (!bulkMoveVolume) {
        toast('Выберите том', 'error');
        return;
      }
      body.volume_id = Number(bulkMoveVolume);
    } else {
      body.narrator_ids = bulkNarrIds;
    }
    setBulkBusy(true);
    try {
      const res = await api<{ updated: number }>(`/panel/titles/${titleId}/chapters/bulk-edit`, {
        method: 'POST',
        body,
      });
      toast(
        bulkMode === 'move'
          ? `Перемещено глав: ${res?.updated ?? selected.length}`
          : `Чтецы изменены у глав: ${res?.updated ?? selected.length}`
      );
      setBulkMode(null);
      setBulkMoveVolume('');
      setBulkNarrIds([]);
      setSelected([]);
      await onReload();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBulkBusy(false);
    }
  }

  async function submitBulkReview() {
    if (!bulkReview) return;
    const { decision, volume, ids } = bulkReview;
    const note = reviewNote.trim();
    if (decision === 'reject' && note.length < 3) {
      toast('Укажите причину отклонения', 'error');
      return;
    }
    setReviewing(true);
    try {
      const res = await api<{ count: number }>(`/mod/titles/${titleId}/chapters/moderate`, {
        method: 'POST',
        body: {
          decision,
          volume_id: ids === null && volume ? volume.id : undefined,
          chapter_ids: ids ?? undefined,
          note: note || undefined,
        },
      });
      const n = res?.count ?? 0;
      toast(decision === 'approve' ? `Одобрено глав: ${n}` : `Отклонено глав: ${n}`);
      setBulkReview(null);
      if (ids !== null) setSelected([]);
      await onReload();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setReviewing(false);
    }
  }

  function validAudio(f: File): string | null {
    if (!AUDIO_RE.test(f.name)) return `${f.name}: неподдерживаемый формат`;
    if (f.size > MAX_AUDIO_BYTES) return `${f.name}: файл слишком большой (макс. 2 ГБ)`;
    return null;
  }

  function pickAudio(chapterId: number) {
    uploadChapterRef.current = chapterId;
    audioInputRef.current?.click();
  }

  function onAudioPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    e.target.value = '';
    const chapterId = uploadChapterRef.current;
    uploadChapterRef.current = null;
    if (!f || chapterId == null) return;
    const bad = validAudio(f);
    if (bad) {
      toast(bad, 'error');
      return;
    }
    setUploads((u) => ({ ...u, [chapterId]: 0 }));
    uploadInChunks(f, (frac) => setUploads((u) => ({ ...u, [chapterId]: frac })))
      .then((uploadId) =>
        api(`/panel/chapters/${chapterId}/audio`, { body: { upload_id: uploadId } })
      )
      .then(async () => {
        toast('Аудио загружено — поставлено в очередь на конвертацию');
        await Promise.all([onReload(), loadJobs()]);
      })
      .catch((err) => toast(errMsg(err), 'error'))
      .finally(() =>
        setUploads((u) => {
          const rest = { ...u };
          delete rest[chapterId];
          return rest;
        })
      );
  }

  function pickAltSlot(volumeId: number, number: number, narratorIds: number[]) {
    altSlotTarget.current = { volumeId, number, narratorIds };
    altInputRef.current?.click();
  }

  function onAltSlotPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    e.target.value = '';
    const t = altSlotTarget.current;
    altSlotTarget.current = null;
    if (!f || !t) return;
    const bad = validAudio(f);
    if (bad) {
      toast(bad, 'error');
      return;
    }
    const key = `${t.volumeId}:${t.number}`;
    setAltUploads((u) => ({ ...u, [key]: 0 }));
    uploadInChunks(f, (frac) => setAltUploads((u) => ({ ...u, [key]: frac })))
      .then((uploadId) =>
        api(`/panel/titles/${titleId}/chapters`, {
          body: {
            volume_id: t.volumeId,
            number: t.number,
            narrator_ids: t.narratorIds,
            upload_id: uploadId,
            version_id: currentVersion,
          },
        })
      )
      .then(async () => {
        toast('Озвучка загружена — в очереди на конвертацию');
        await Promise.all([onReload(), loadJobs()]);
      })
      .catch((err) => toast(errMsg(err), 'error'))
      .finally(() =>
        setAltUploads((u) => {
          const rest = { ...u };
          delete rest[key];
          return rest;
        })
      );
  }

  const uploadVolumes = isAlt ? displayVolumes.filter((v) => standaloneHere(v)) : displayVolumes;

  const existingNumbers = (v: Volume | undefined): Set<number> =>
    new Set(
      (v ? (standaloneHere(v) ? ownAltChapters(v) : liveChapters(v)) : []).map((c) => c.number)
    );

  const nextFor = (v: Volume): number =>
    nextNumberIn(standaloneHere(v) ? { ...v, chapters: ownAltChapters(v) } : v);

  const stageTargetVolume = uploadVolumes.find((v) => String(v.id) === stageVolume) ?? null;
  const stageExisting = existingNumbers(stageTargetVolume ?? undefined);
  const stagePending = staged.filter((r) => r.state !== 'done');
  const stageHasError = staged.some((r) => r.state === 'error');

  const patchStaged = (key: string, patch: Partial<StagedFile>) =>
    setStaged((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const renumberFrom = (rows: StagedFile[], start: number): StagedFile[] => {
    let i = 0;
    return rows.map((r) => (r.state === 'done' ? r : { ...r, number: formatNumber(start + i++) }));
  };

  function addToStage(files: File[], volumeId?: number | null) {
    if (files.length === 0) return;
    for (const f of files) {
      const bad = validAudio(f);
      if (bad) {
        toast(bad, 'error');
        return;
      }
    }
    const vol =
      uploadVolumes.find((v) => v.id === volumeId) ??
      stageTargetVolume ??
      uploadVolumes[uploadVolumes.length - 1] ??
      null;
    if (!vol) {
      toast('Сначала добавьте том', 'error');
      return;
    }
    if (staged.length === 0 || String(vol.id) !== stageVolume) {
      setStageVolume(String(vol.id));
    }
    const sorted = [...files].sort((a, b) => naturalCompare(a.name, b.name));
    const keep = String(vol.id) === stageVolume ? staged : [];
    const start =
      keep.length > 0
        ? Math.floor(Math.max(...keep.map((r) => {
          const q = parseChapterNo(r.number, true);
          return typeof q === 'string' ? 0 : (q.end ?? q.n);
        }))) + 1
        : nextFor(vol);
    const added: StagedFile[] = sorted.map((f, i) => ({
      key: `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
      file: f,
      number: formatNumber(start + i),
      name: stageNames ? stripExt(f.name) : '',
      state: 'queued',
      progress: 0,
    }));
    setStaged([...keep, ...added]);
    setStageStart('');
    if (stageNarrators.length === 0 && title.narrators.length === 1) {
      setStageNarrators([title.narrators[0].id]);
    }
  }

  function onStagePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    const target = stageTarget.current;
    stageTarget.current = null;
    addToStage(files, target);
  }

  function pickForStage(volumeId: number | null = null) {
    stageTarget.current = volumeId;
    stageInputRef.current?.click();
  }

  function onStageDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    addToStage(Array.from(e.dataTransfer.files).filter((f) => AUDIO_RE.test(f.name) || f.type.startsWith('audio/')));
  }

  function changeStageVolume(id: string) {
    const vol = uploadVolumes.find((v) => String(v.id) === id);
    setStageVolume(id);
    setStageStart('');
    if (vol) setStaged((rows) => renumberFrom(rows, nextFor(vol)));
  }

  function changeStageStart(val: string) {
    setStageStart(val);
    const n = Number(val);
    if (val.trim() !== '' && Number.isFinite(n) && n >= 0) {
      setStaged((rows) => renumberFrom(rows, n));
    }
  }

  function toggleStageNames(on: boolean) {
    setStageNames(on);
    setStaged((rows) =>
      rows.map((r) => (r.state === 'done' ? r : { ...r, name: on ? stripExt(r.file.name) : '' }))
    );
  }

  async function runStage() {
    const volId = Number(stageVolume);
    if (!Number.isInteger(volId) || volId <= 0) {
      toast('Выберите том', 'error');
      return;
    }
    if (title.narrators.length > 0 && stageNarrators.length === 0) {
      toast('Отметьте, кто читает эти главы', 'error');
      return;
    }
    const todo = staged.filter((r) => r.state !== 'done');
    const parsedNo = new Map<string, { n: number; end: number | null }>();
    for (const r of todo) {
      const q = parseChapterNo(r.number, isMod);
      if (typeof q === 'string') {
        toast(`${r.file.name}: ${q}`, 'error');
        return;
      }
      parsedNo.set(r.key, q);
    }
    setStageRunning(true);
    let ok = 0;
    let failed = 0;
    let pending = false;
    for (const r of todo) {
      patchStaged(r.key, { state: 'uploading', progress: 0, error: undefined });
      try {
        const uploadId = await uploadInChunks(r.file, (p) => patchStaged(r.key, { progress: p }));
        const row = await api<ChapterRow & { mod_status: string }>(
          `/panel/titles/${titleId}/chapters`,
          {
            body: {
              volume_id: volId,
              number: parsedNo.get(r.key)?.n,
              number_end: parsedNo.get(r.key)?.end ?? null,
              name: r.name.trim(),
              narrator_ids: stageNarrators,
              upload_id: uploadId,
              version_id: currentVersion,
            },
          }
        );
        if (row?.mod_status && row.mod_status !== 'approved') pending = true;
        patchStaged(r.key, { state: 'done', progress: 1 });
        ok++;
      } catch (err) {
        patchStaged(r.key, { state: 'error', error: errMsg(err) });
        failed++;
      }
    }
    setStageRunning(false);
    if (ok > 0) {
      toast(
        pending
          ? `Добавлено глав: ${ok} — отправлены на модерацию`
          : `Добавлено глав: ${ok} — аудио в очереди на конвертацию`
      );
    }
    if (failed > 0) toast(`Не загрузилось: ${failed}. Нажмите «Повторить»`, 'error');
    else setStaged([]);
    await Promise.all([onReload(), loadJobs()]);
  }


  const activeAltVersion = title.versions.find((v) => v.id === currentVersion) ?? null;

  return (
    <div className={styles.manager}>
      <section className={styles.section}>
        {canManageVersions ? (
          <div className={styles.versionTabs}>
            <button
              type="button"
              className={currentVersion === 0 ? `${styles.versionTab} ${styles.versionTabActive}` : styles.versionTab}
              onClick={() => setCurrentVersion(0)}
            >
              {title.version_name}
            </button>
            {title.versions.map((v) => (
              <button
                key={v.id}
                type="button"
                className={currentVersion === v.id ? `${styles.versionTab} ${styles.versionTabActive}` : styles.versionTab}
                onClick={() => setCurrentVersion(v.id)}
              >
                {v.name}
              </button>
            ))}
            {canManageVersions ? (
              <span className={styles.versionActions}>
                {currentVersion === 0 ? (
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => openVersionForm('main')}
                    title="Переименовать основную версию"
                    aria-label="Переименовать основную версию"
                  >
                    <Pencil size={14} />
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => openVersionForm('rename')}
                      title="Переименовать версию"
                      aria-label="Переименовать версию"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      className={styles.iconBtnDanger}
                      onClick={() => activeAltVersion && setVersionToDelete(activeAltVersion)}
                      title="Удалить версию"
                      aria-label="Удалить версию"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => openVersionForm('add')}
                  title="Добавить версию"
                  aria-label="Добавить версию"
                >
                  <Plus size={14} />
                </button>
              </span>
            ) : null}
          </div>
        ) : null}

        {versionForm ? (
          <form className={`glass-panel ${styles.inlinePanel}`} onSubmit={submitVersionForm} noValidate>
            <div className={styles.growField}>
              <label className={styles.label} htmlFor="version-name">
                {versionForm === 'add' ? 'Название новой версии' : 'Название версии'}
              </label>
              <input
                id="version-name"
                className="input"
                type="text"
                value={versionName}
                maxLength={100}
                onChange={(e) => setVersionName(e.target.value)}
                placeholder="Напр. «Мужской голос»"
                autoFocus
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={versionBusy}>
              {versionBusy ? 'Сохраняем…' : 'Сохранить'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setVersionForm(null)}>
              Отмена
            </button>
          </form>
        ) : null}

        {currentVersion !== 0 ? (
          <p className={styles.bulkHint}>
            Альтернативная версия: загружайте аудио для тех же глав, что и в основной. Главы без
            своего аудио будут проигрываться из основной версии.
          </p>
        ) : null}

        <div className={styles.sectionHead}>
          <span className={styles.sectionLabel}>Главы</span>
          {isMod && pendingTotal > 0 ? (
            <span className={styles.bulkReviewRow}>
              <span className={styles.pendingCount}>{`На проверке: ${pendingTotal}`}</span>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => openBulkReview('approve', null)}
              >
                <Check size={15} />
                Одобрить все
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => openBulkReview('reject', null)}
              >
                <X size={15} />
                Отклонить все
              </button>
            </span>
          ) : null}
          {!isAlt ? (
            <button type="button" className="btn btn-primary" onClick={openAddVolume}>
              <Plus size={15} />
              Добавить том
            </button>
          ) : null}
        </div>

        {selected.length > 0 ? (
          <div className={`glass-panel ${styles.selectionBar}`}>
            <span className={styles.selectionCount}>{`Выбрано глав: ${selected.length}`}</span>
            {isMod && !isAlt ? (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={bulkBusy}
                  onClick={() => openBulkReview('approve', null, selected)}
                >
                  <Check size={15} />
                  Одобрить
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={bulkBusy}
                  onClick={() => openBulkReview('reject', null, selected)}
                >
                  <X size={15} />
                  Отклонить
                </button>
              </>
            ) : null}
            {!isAlt ? (
              <button
                type="button"
                className="btn"
                disabled={bulkBusy}
                onClick={() => {
                  setBulkMoveVolume('');
                  setBulkMode('move');
                }}
              >
                <Layers size={15} />
                Переместить в том
              </button>
            ) : null}
            {title.narrators.length > 0 ? (
              <button
                type="button"
                className="btn"
                disabled={bulkBusy}
                onClick={() => {
                  setBulkNarrIds([]);
                  setBulkMode('narrators');
                }}
              >
                <Users size={15} />
                Назначить чтецов
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-danger"
              disabled={bulkBusy}
              onClick={() => setSelectionAction('delete')}
            >
              <Trash2 size={15} />
              Удалить
            </button>
            {isAdmin ? (
              <button
                type="button"
                className="btn btn-danger"
                disabled={bulkBusy}
                onClick={() => setSelectionAction('purge')}
              >
                <Flame size={15} />
                Стереть навсегда
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-ghost"
              disabled={bulkBusy}
              onClick={() => setSelected([])}
            >
              Снять выделение
            </button>
          </div>
        ) : null}

        {showAddVolume ? (
          <form className={`glass-panel ${styles.inlinePanel}`} onSubmit={addVolume} noValidate>
            <div className={styles.numField}>
              <label className={styles.label} htmlFor="v-number">
                Номер
              </label>
              <input
                id="v-number"
                className="input"
                type="number"
                min={0}
                value={volNumber}
                onChange={(e) => setVolNumber(e.target.value)}
              />
            </div>
            <div className={styles.growField}>
              <label className={styles.label} htmlFor="v-name">
                Название <span className={styles.optional}>необязательно</span>
              </label>
              <input
                id="v-name"
                className="input"
                type="text"
                value={volName}
                maxLength={200}
                onChange={(e) => setVolName(e.target.value)}
                placeholder="Часть первая"
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={savingVolume}>
              {savingVolume ? 'Добавляем…' : 'Добавить'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowAddVolume(false)}>
              Отмена
            </button>
          </form>
        ) : null}

        {displayVolumes.length > 0 && uploadVolumes.length > 0 ? (
          staged.length === 0 ? (
            <div
              className={dragOver ? `${styles.drop} ${styles.dropOver}` : styles.drop}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onStageDrop}
            >
              <Upload size={26} className={styles.dropIcon} aria-hidden="true" />
              <p className={styles.dropTitle}>Перетащите аудио сюда</p>
              <p className={styles.dropHint}>
                Один файл — одна глава. Несколько файлов встанут по порядку имён.
              </p>
              <button type="button" className="btn btn-primary" onClick={() => pickForStage()}>
                Выбрать файлы
              </button>
            </div>
          ) : (
            <div
              className={`glass-panel ${styles.stage}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onStageDrop}
            >
              <div className={styles.stageGrid}>
                <div className={styles.bulkField}>
                  <label className={styles.label} htmlFor="stage-volume">
                    Том
                  </label>
                  <Select
                    id="stage-volume"
                    block
                    value={stageVolume}
                    disabled={stageRunning}
                    options={uploadVolumes.map((v) => ({
                      value: String(v.id),
                      label: `${title.volume_label} ${v.number}${v.name ? ` — ${v.name}` : ''}`,
                    }))}
                    onChange={changeStageVolume}
                  />
                </div>
                <div className={styles.bulkField}>
                  <label className={styles.label} htmlFor="stage-start">
                    Первая глава
                  </label>
                  <input
                    id="stage-start"
                    className="input"
                    type="number"
                    step="0.1"
                    min={0}
                    value={stageStart}
                    disabled={stageRunning}
                    onChange={(e) => changeStageStart(e.target.value)}
                    placeholder={stageTargetVolume ? String(nextFor(stageTargetVolume)) : '1'}
                  />
                </div>
              </div>

              {title.narrators.length > 0 ? (
                <div className={styles.bulkField}>
                  <span className={styles.label}>
                    Кто читает <span className={styles.required}>обязательно</span>
                  </span>
                  <ChapterNarratorPicker
                    all={title.narrators}
                    value={stageNarrators}
                    onChange={setStageNarrators}
                  />
                </div>
              ) : null}

              <Toggle
                checked={stageNames}
                onChange={toggleStageNames}
                label="Названия глав из имён файлов"
              />

              <div className={styles.stageList}>
                {staged.map((r) => {
                  const parsed = parseChapterNo(r.number, isMod);
                  const noError = typeof parsed === 'string' && r.number.trim() !== '' ? parsed : null;
                  const dup =
                    r.state !== 'done' &&
                    typeof parsed !== 'string' &&
                    (stageExisting.has(parsed.n) ||
                      staged.some((o) => o !== r && o.state !== 'done' && o.number.trim() === r.number.trim()));
                  const locked = stageRunning || r.state === 'done';
                  return (
                    <div key={r.key} className={styles.stageRow} data-state={r.state}>
                      <div className={styles.stageNum}>
                        <input
                          className="input"
                          type="text"
                          inputMode="decimal"
                          value={r.number}
                          disabled={locked}
                          onChange={(e) => patchStaged(r.key, { number: e.target.value })}
                          placeholder={isMod ? '25 или 30–35' : '25'}
                          aria-label={`Номер главы: ${r.file.name}`}
                          aria-invalid={noError ? true : undefined}
                        />
                        {noError ? (
                          <span className={styles.noErr}>{noError}</span>
                        ) : typeof parsed !== 'string' && parsed.end !== null ? (
                          <span className={styles.noHint}>{`Главы ${formatNumber(parsed.n)}–${formatNumber(parsed.end)}`}</span>
                        ) : null}
                      </div>
                      <div className={styles.stageFile}>
                        <span className={styles.stageFileName}>{r.file.name}</span>
                        <span className={styles.stageFileSize}>{formatSize(r.file.size)}</span>
                      </div>
                      <input
                        className={`input ${styles.stageName}`}
                        type="text"
                        value={r.name}
                        maxLength={300}
                        disabled={locked}
                        onChange={(e) => patchStaged(r.key, { name: e.target.value })}
                        placeholder="Название — необязательно"
                        aria-label={`Название главы: ${r.file.name}`}
                      />
                      <div className={styles.stageState}>
                        {r.state === 'uploading' ? (
                          <>
                            <span className={styles.progress}>
                              <span
                                className={styles.progressFill}
                                style={{ width: `${Math.round(r.progress * 100)}%` }}
                              />
                            </span>
                            <span className={styles.progressPct}>{Math.round(r.progress * 100)}%</span>
                          </>
                        ) : r.state === 'done' ? (
                          <span className={styles.okTag}>
                            <Check size={12} /> Загружено
                          </span>
                        ) : r.state === 'error' ? (
                          <span className={styles.errTag}>Ошибка</span>
                        ) : dup ? (
                          <span className={styles.warnTag}>Номер занят</span>
                        ) : stageRunning ? (
                          <span className={styles.stageWait}>В очереди</span>
                        ) : null}
                        {!stageRunning && r.state !== 'done' ? (
                          <button
                            type="button"
                            className={styles.iconBtn}
                            onClick={() => setStaged((rows) => rows.filter((x) => x.key !== r.key))}
                            title="Убрать из списка"
                            aria-label={`Убрать файл ${r.file.name}`}
                          >
                            <X size={14} />
                          </button>
                        ) : null}
                      </div>
                      {r.state === 'error' && r.error ? (
                        <p className={styles.stageErr}>{r.error}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className={styles.stageFoot}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void runStage()}
                  disabled={stageRunning || stagePending.length === 0}
                >
                  <Upload size={15} />
                  {stageRunning
                    ? 'Загружаем…'
                    : stageHasError
                      ? `Повторить (${stagePending.length})`
                      : `Загрузить глав: ${stagePending.length}`}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => pickForStage(stageTargetVolume?.id ?? null)}
                  disabled={stageRunning}
                >
                  <Plus size={15} />
                  Ещё файлы
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setStaged([])}
                  disabled={stageRunning}
                >
                  Очистить
                </button>
                <span className={styles.stageTotal}>
                  {formatSize(staged.reduce((s, r) => s + r.file.size, 0))}
                </span>
              </div>
            </div>
          )
        ) : null}

        {displayVolumes.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="Томов пока нет"
            body="Сначала добавьте том — главы живут внутри томов."
          />
        ) : (
          displayVolumes.map((v) => (
            <div key={v.id} className={`glass-panel ${styles.volume}`}>
              <div className={styles.volumeHead}>
                {editingVolume === v.id ? (
                  <form
                    className={styles.volumeEditForm}
                    onSubmit={(e) => saveVolume(e, v.id)}
                    noValidate
                  >
                    <input
                      className={`input ${styles.numInput}`}
                      type="number"
                      min={0}
                      value={editVolNumber}
                      onChange={(e) => setEditVolNumber(e.target.value)}
                      aria-label="Номер тома"
                    />
                    <input
                      className={`input ${styles.volNameInput}`}
                      type="text"
                      value={editVolName}
                      maxLength={200}
                      onChange={(e) => setEditVolName(e.target.value)}
                      placeholder="Название тома"
                      aria-label="Название тома"
                    />
                    <button type="submit" className="btn btn-primary" disabled={savingVolume}>
                      Сохранить
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setEditingVolume(null)}
                    >
                      Отмена
                    </button>
                  </form>
                ) : (
                  <>
                    <div className={styles.volumeTitle}>
                      {!isAlt && visibleChapters(v).length > 0 ? (
                        <input
                          type="checkbox"
                          className={styles.selectBox}
                          checked={visibleChapters(v).every((c) => selected.includes(c.id))}
                          onChange={() => toggleVolumeSelection(v)}
                          aria-label={`Выбрать все главы тома ${v.number}`}
                          title="Выбрать все главы тома"
                        />
                      ) : null}
                      <span className={styles.volumeNum}>{`${title.volume_label} ${v.number}`}</span>
                      {v.name ? <span className={styles.volumeName}>{v.name}</span> : null}
                      <span className={styles.volumeCount}>
                        {standaloneHere(v)
                          ? `Глав: ${ownAltChapters(v).length} · отдельный том`
                          : isAlt
                            ? `Озвучено: ${liveChapters(v).filter((c) => altSlot(v.id, c.number)).length} из ${liveChapters(v).length}`
                            : `Глав: ${liveChapters(v).length}`}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.volumeHit}
                      onClick={() => toggleVolume(v.id)}
                      aria-expanded={openVolumes.has(v.id)}
                      aria-label={
                        openVolumes.has(v.id)
                          ? `Свернуть том ${v.number}`
                          : `Развернуть том ${v.number}`
                      }
                    />
                    <div className={styles.volumeActions}>
                      {isAlt && canStandalone ? (
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => toggleStandalone(v)}
                          title={
                            standaloneHere(v)
                              ? 'Снова привязать главы тома к основной версии'
                              : 'Своя разбивка на главы в этом томе, без привязки к основной версии'
                          }
                        >
                          {standaloneHere(v) ? 'Привязать к основной' : 'Отдельный том'}
                        </button>
                      ) : null}
                      {!isAlt || standaloneHere(v) ? (
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => pickForStage(v.id)}
                          disabled={stageRunning}
                        >
                          <Plus size={14} />
                          Добавить главы
                        </button>
                      ) : null}
                      {!isAlt && isMod && pendingIn(v) > 0 ? (
                        <>
                          <span className={styles.pendingCount}>
                            {`На проверке: ${pendingIn(v)}`}
                          </span>
                          <button
                            type="button"
                            className={styles.iconBtn}
                            onClick={() => openBulkReview('approve', v)}
                            title={`Одобрить все главы тома ${v.number}`}
                            aria-label={`Одобрить все главы тома ${v.number}`}
                          >
                            <Check size={15} />
                          </button>
                          <button
                            type="button"
                            className={styles.iconBtnDanger}
                            onClick={() => openBulkReview('reject', v)}
                            title={`Отклонить все главы тома ${v.number}`}
                            aria-label={`Отклонить все главы тома ${v.number}`}
                          >
                            <X size={15} />
                          </button>
                        </>
                      ) : null}
                      {!isAlt ? (
                        <>
                          <button
                            type="button"
                            className={styles.iconBtn}
                            onClick={() => startEditVolume(v)}
                            title="Переименовать том"
                            aria-label={`Переименовать том ${v.number}`}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className={styles.iconBtnDanger}
                            onClick={() => setVolumeToDelete(v)}
                            title="Удалить том"
                            aria-label={`Удалить том ${v.number}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      ) : null}
                      <span
                        className={
                          openVolumes.has(v.id)
                            ? `${styles.volumeChev} ${styles.volumeChevOpen}`
                            : styles.volumeChev
                        }
                        aria-hidden="true"
                      >
                        <ChevronRight size={16} />
                      </span>
                    </div>
                  </>
                )}
              </div>

              {!openVolumes.has(v.id) ? null : standaloneHere(v) ? (
                ownAltChapters(v).length === 0 ? (
                  <p className={styles.noChapters}>
                  В этом томе пока нет глав.{' '}
                  <button type="button" className={styles.linkBtn} onClick={() => pickForStage(v.id)}>
                    Загрузить аудио
                  </button>
                </p>
                ) : (
                  ownAltChapters(v).map((c) => (
                    <div key={c.id} className={styles.chapterRow}>
                      <input
                        type="checkbox"
                        className={styles.selectBox}
                        checked={selected.includes(c.id)}
                        onChange={() => toggleSelected(c.id)}
                        aria-label={`Выбрать главу ${c.number}`}
                      />
                      <span className={styles.chNum}>{chapterNumberLabel(c.number, c.number_end)}</span>
                      <span className={styles.chName}>{chapterLabel(c.number, c.number_end, c.name)}</span>
                      {c.duration_seconds > 0 ? (
                        <span className={styles.chDuration}>{formatDuration(c.duration_seconds)}</span>
                      ) : null}
                      <span className={styles.chBadges}>
                        <StatusBadge status={c.audio_status} />
                        {c.mod_status !== 'approved' ? <StatusBadge status={c.mod_status} /> : null}
                      </span>
                      <span className={styles.chActions}>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() => pickAudio(c.id)}
                          disabled={uploads[c.id] !== undefined}
                          title="Заменить аудио"
                          aria-label={`Заменить аудио главы ${c.number}`}
                        >
                          <RefreshCw size={14} />
                        </button>
                        <button
                          type="button"
                          className={styles.iconBtnDanger}
                          onClick={() => setChapterToDelete(c)}
                          title="Удалить главу"
                          aria-label={`Удалить главу ${c.number}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </span>
                      {uploads[c.id] !== undefined ? (
                        <span className={styles.progressWrap}>
                          <span className={styles.progress}>
                            <span
                              className={styles.progressFill}
                              style={{ width: `${Math.round(uploads[c.id] * 100)}%` }}
                            />
                          </span>
                          <span className={styles.progressPct}>{Math.round(uploads[c.id] * 100)}%</span>
                        </span>
                      ) : null}
                    </div>
                  ))
                )
              ) : isAlt ? (
                liveChapters(v).length === 0 ? (
                  <p className={styles.noChapters}>В основной версии нет глав.</p>
                ) : (
                  liveChapters(v).map((mainCh) => {
                    const alt = altSlot(v.id, mainCh.number);
                    const slotKey = `${v.id}:${mainCh.number}`;
                    if (alt) {
                      return (
                        <div key={slotKey} className={styles.chapterRow}>
                          <input
                            type="checkbox"
                            className={styles.selectBox}
                            checked={selected.includes(alt.id)}
                            onChange={() => toggleSelected(alt.id)}
                            aria-label={`Выбрать главу ${mainCh.number}`}
                          />
                          <span className={styles.chNum}>{chapterNumberLabel(mainCh.number, mainCh.number_end)}</span>
                          <span className={styles.chName}>{chapterLabel(mainCh.number, mainCh.number_end, mainCh.name)}</span>
                          {alt.duration_seconds > 0 ? (
                            <span className={styles.chDuration}>{formatDuration(alt.duration_seconds)}</span>
                          ) : null}
                          <span className={styles.chBadges}>
                            <StatusBadge status={alt.audio_status} />
                            {alt.mod_status !== 'approved' ? <StatusBadge status={alt.mod_status} /> : null}
                          </span>
                          <span className={styles.chActions}>
                            <button
                              type="button"
                              className={styles.iconBtn}
                              onClick={() => pickAudio(alt.id)}
                              disabled={uploads[alt.id] !== undefined}
                              title="Заменить аудио"
                              aria-label={`Заменить аудио главы ${mainCh.number}`}
                            >
                              <RefreshCw size={14} />
                            </button>
                            <button
                              type="button"
                              className={styles.iconBtnDanger}
                              onClick={() => setChapterToDelete(alt)}
                              title="Удалить озвучку этой главы"
                              aria-label={`Удалить озвучку главы ${mainCh.number}`}
                            >
                              <Trash2 size={14} />
                            </button>
                            {isAdmin ? (
                              <button
                                type="button"
                                className={styles.iconBtnDanger}
                                onClick={() => setChapterToPurge(alt)}
                                title="Удалить навсегда — вместе с аудио"
                                aria-label={`Удалить навсегда озвучку главы ${mainCh.number}`}
                              >
                                <Flame size={14} />
                              </button>
                            ) : null}
                          </span>
                          {uploads[alt.id] !== undefined ? (
                            <span className={styles.progressWrap}>
                              <span className={styles.progress}>
                                <span
                                  className={styles.progressFill}
                                  style={{ width: `${Math.round(uploads[alt.id] * 100)}%` }}
                                />
                              </span>
                              <span className={styles.progressPct}>{Math.round(uploads[alt.id] * 100)}%</span>
                            </span>
                          ) : null}
                        </div>
                      );
                    }
                    const busy = altUploads[slotKey] !== undefined;
                    return (
                      <div key={slotKey} className={`${styles.chapterRow} ${styles.altPlaceholder}`}>
                        <span className={styles.chNum}>{chapterNumberLabel(mainCh.number, mainCh.number_end)}</span>
                        <span className={styles.chName}>{chapterLabel(mainCh.number, mainCh.number_end, mainCh.name)}</span>
                        <span className={styles.altMissing}>нет озвучки — играет из основной</span>
                        <span className={styles.chActions}>
                          <button
                            type="button"
                            className={`btn ${styles.altUploadBtn}`}
                            disabled={busy}
                            onClick={() =>
                              pickAltSlot(v.id, mainCh.number, (mainCh.narrators ?? []).map((n) => n.id))
                            }
                          >
                            <Upload size={14} />
                            {busy ? `${Math.round((altUploads[slotKey] ?? 0) * 100)}%` : 'Загрузить'}
                          </button>
                        </span>
                        {busy ? (
                          <span className={styles.progressWrap}>
                            <span className={styles.progress}>
                              <span
                                className={styles.progressFill}
                                style={{ width: `${Math.round((altUploads[slotKey] ?? 0) * 100)}%` }}
                              />
                            </span>
                          </span>
                        ) : null}
                      </div>
                    );
                  })
                )
              ) : visibleChapters(v).length === 0 ? (
                <p className={styles.noChapters}>
                  В этом томе пока нет глав.{' '}
                  <button type="button" className={styles.linkBtn} onClick={() => pickForStage(v.id)}>
                    Загрузить аудио
                  </button>
                </p>
              ) : (
                visibleChapters(v).map((c) => (
                  <div key={c.id} className={styles.chapterRow}>
                      <>
                        <input
                          type="checkbox"
                          className={styles.selectBox}
                          checked={selected.includes(c.id)}
                          onChange={() => toggleSelected(c.id)}
                          aria-label={`Выбрать главу ${c.number}`}
                        />
                        <span className={styles.chNum}>{chapterNumberLabel(c.number, c.number_end)}</span>
                        <span
                          className={
                            c.is_deleted ? `${styles.chName} ${styles.chDeleted}` : styles.chName
                          }
                        >
                          {chapterLabel(c.number, c.number_end, c.name)}
                        </span>
                        {c.duration_seconds > 0 ? (
                          <span className={styles.chDuration}>
                            {formatDuration(c.duration_seconds)}
                          </span>
                        ) : null}
                        {(c.narrators ?? []).length > 0 ? (
                          <span
                            className={styles.chNarrators}
                            title={c.narrators.map((n) => n.name).join(', ')}
                          >
                            {c.narrators[0].name}
                            {c.narrators.length > 1 ? ` +${c.narrators.length - 1}` : ''}
                          </span>
                        ) : null}
                        <span className={styles.chBadges}>
                          {c.is_deleted ? <span className={styles.deletedTag}>удалена</span> : null}
                          <StatusBadge status={c.audio_status} />
                          {c.mod_status !== 'approved' ? (
                            <StatusBadge status={c.mod_status} />
                          ) : null}
                        </span>
                        <span className={styles.chActions}>
                          {c.is_deleted && isAdmin ? (
                            <button
                              type="button"
                              className={styles.iconBtn}
                              onClick={() => void restoreChapter(c)}
                              title="Восстановить главу"
                              aria-label={`Восстановить главу ${c.number}`}
                            >
                              <RotateCcw size={14} />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className={styles.iconBtn}
                            onClick={() => pickAudio(c.id)}
                            disabled={uploads[c.id] !== undefined}
                            title={c.audio_status === 'none' ? 'Загрузить аудио' : 'Заменить аудио'}
                            aria-label={
                              c.audio_status === 'none'
                                ? `Загрузить аудио для главы ${c.number}`
                                : `Заменить аудио главы ${c.number}`
                            }
                          >
                            {c.audio_status === 'none' ? (
                              <Upload size={14} />
                            ) : (
                              <RefreshCw size={14} />
                            )}
                          </button>
                          <button
                            type="button"
                            className={styles.iconBtn}
                            onClick={() => startEditChapter(c)}
                            title="Редактировать главу"
                            aria-label={`Редактировать главу ${c.number}`}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className={styles.iconBtnDanger}
                            onClick={() => setChapterToDelete(c)}
                            title="Удалить главу"
                            aria-label={`Удалить главу ${c.number}`}
                          >
                            <Trash2 size={14} />
                          </button>
                          {isAdmin ? (
                            <button
                              type="button"
                              className={styles.iconBtnDanger}
                              onClick={() => setChapterToPurge(c)}
                              title="Удалить навсегда — вместе с аудио"
                              aria-label={`Удалить навсегда главу ${c.number}`}
                            >
                              <Flame size={14} />
                            </button>
                          ) : null}
                        </span>
                        {uploads[c.id] !== undefined ? (
                          <span className={styles.progressWrap}>
                            <span className={styles.progress}>
                              <span
                                className={styles.progressFill}
                                style={{ width: `${Math.round(uploads[c.id] * 100)}%` }}
                              />
                            </span>
                            <span className={styles.progressPct}>
                              {Math.round(uploads[c.id] * 100)}%
                            </span>
                          </span>
                        ) : null}
                      </>
                  </div>
                ))
              )}
            </div>
          ))
        )}
      </section>

      <section className={styles.section}>
        <span className={styles.sectionLabel}>Задачи конвертации</span>
        {!jobs ? (
          <div className={styles.center}>
            <Spinner />
          </div>
        ) : jobs.items.length === 0 ? (
          <p className={styles.noJobs}>
            Задач конвертации пока нет — загрузите аудио, и они появятся здесь.
          </p>
        ) : (
          <div className={`glass-panel ${styles.tableWrap}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Глава</th>
                  <th>Статус</th>
                  <th className={styles.num}>Попытки</th>
                  <th>Ошибка</th>
                  <th>Создана</th>
                  <th>Завершена</th>
                </tr>
              </thead>
              <tbody>
                {jobs.items.map((j) => (
                  <tr key={j.id}>
                    <td className={styles.jobChapter}>{j.chapter_name || `#${j.chapter_id}`}</td>
                    <td>
                      <StatusBadge status={j.status} />
                    </td>
                    <td className={styles.num}>{j.attempts}</td>
                    <td className={styles.jobError}>{j.error || '—'}</td>
                    <td className={styles.jobTime} title={formatDateTime(j.created_at)}>
                      {timeAgo(j.created_at)}
                    </td>
                    <td className={styles.jobTime}>
                      {j.finished_at ? timeAgo(j.finished_at) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {jobs ? (
          <Pagination
            page={jobs.page}
            total={jobs.total}
            perPage={jobs.per_page}
            onPage={setJobsPage}
          />
        ) : null}
      </section>

      <input
        ref={audioInputRef}
        type="file"
        accept={AUDIO_ACCEPT}
        className={styles.hiddenInput}
        onChange={onAudioPicked}
        aria-hidden="true"
        tabIndex={-1}
      />
      <input
        ref={stageInputRef}
        type="file"
        multiple
        accept={AUDIO_ACCEPT}
        className={styles.hiddenInput}
        onChange={onStagePicked}
        aria-hidden="true"
        tabIndex={-1}
      />
      <input
        ref={altInputRef}
        type="file"
        accept={AUDIO_ACCEPT}
        className={styles.hiddenInput}
        onChange={onAltSlotPicked}
        aria-hidden="true"
        tabIndex={-1}
      />

      <ConfirmDialog
        open={versionToDelete !== null}
        onClose={() => setVersionToDelete(null)}
        onConfirm={() => {
          if (versionToDelete) void deleteVersion(versionToDelete);
        }}
        title="Удалить версию"
        body={
          versionToDelete
            ? `Удалить версию «${versionToDelete.name}» вместе со всеми загруженными в неё главами? Слушатели, выбравшие её, вернутся к основной версии.`
            : ''
        }
        danger
      />

      <ConfirmDialog
        open={volumeToDelete !== null}
        onClose={() => setVolumeToDelete(null)}
        onConfirm={() => {
          if (volumeToDelete) void deleteVolume(volumeToDelete);
        }}
        title="Удалить том"
        body={
          volumeToDelete
            ? `Удалить том ${volumeToDelete.number}${
                volumeToDelete.name ? ` (${volumeToDelete.name})` : ''
              }? Тома с главами удалить нельзя.`
            : ''
        }
        danger
      />

      <ConfirmDialog
        open={chapterToDelete !== null}
        onClose={() => setChapterToDelete(null)}
        onConfirm={() => {
          if (chapterToDelete) void deleteChapter(chapterToDelete);
        }}
        title="Удалить главу"
        body={
          chapterToDelete
            ? `Удалить главу ${chapterToDelete.number} — ${
                chapterToDelete.name || 'без названия'
              }? Аудио будет удалено, когда удаление вступит в силу.`
            : ''
        }
        danger
      />

      <ConfirmDialog
        open={chapterToPurge !== null}
        onClose={() => setChapterToPurge(null)}
        onConfirm={() => {
          if (chapterToPurge) void purgeChapter(chapterToPurge);
        }}
        title="Удалить навсегда"
        body={
          chapterToPurge
            ? `Глава ${chapterToPurge.number} — ${
                chapterToPurge.name || 'без названия'
              } и её аудиофайл будут удалены окончательно, минуя корзину. Восстановить будет нечего.`
            : ''
        }
        danger
      />

      <ConfirmDialog
        open={selectionAction === 'delete' || selectionAction === 'purge'}
        onClose={() => setSelectionAction(null)}
        onConfirm={() => void submitSelectionAction()}
        title={selectionAction === 'purge' ? 'Стереть выбранные навсегда' : 'Удалить выбранные'}
        body={
          selectionAction === 'purge'
            ? `Выбранные главы (${selected.length}) и их аудиофайлы будут удалены окончательно, минуя корзину.`
            : `Выбранные главы (${selected.length}) будут удалены. Восстановить их можно из корзины.`
        }
        danger
      />

      <Modal
        open={bulkMode === 'move'}
        onClose={() => setBulkMode(null)}
        title={`Переместить главы: ${selected.length}`}
        size="sheet"
      >
        <div className={styles.reviewDialog}>
          <div className={styles.volOptions} role="radiogroup" aria-label="Том">
            {title.volumes.map((v) => (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={bulkMoveVolume === String(v.id)}
                className={
                  bulkMoveVolume === String(v.id)
                    ? `${styles.volOpt} ${styles.volOptOn}`
                    : styles.volOpt
                }
                onClick={() => setBulkMoveVolume(String(v.id))}
              >
                {`${title.volume_label} ${v.number}${v.name ? ` — ${v.name}` : ''}`}
                {bulkMoveVolume === String(v.id) ? <Check size={15} /> : null}
              </button>
            ))}
          </div>
          <div className={styles.reviewActions}>
            <button type="button" className="btn btn-ghost" onClick={() => setBulkMode(null)}>
              Отмена
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={bulkBusy || !bulkMoveVolume}
              onClick={() => void submitBulkEdit()}
            >
              Переместить
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={bulkMode === 'narrators'}
        onClose={() => setBulkMode(null)}
        title={`Чтецы для глав: ${selected.length}`}
        size="sheet"
      >
        <div className={styles.reviewDialog}>
          <p className={styles.reviewBody}>Заменит список чтецов у выбранных глав.</p>
          <NarratorChecklist all={title.narrators} value={bulkNarrIds} onChange={setBulkNarrIds} />
          <div className={styles.reviewActions}>
            <button type="button" className="btn btn-ghost" onClick={() => setBulkMode(null)}>
              Отмена
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={bulkBusy}
              onClick={() => void submitBulkEdit()}
            >
              {`Применить (${bulkNarrIds.length})`}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={editingChapter !== null}
        onClose={() => setEditingChapter(null)}
        title="Редактирование главы"
        size="sheet"
      >
        {editingChapter !== null ? (
          <form
            className={styles.reviewDialog}
            onSubmit={(e) => saveChapter(e, editingChapter)}
            noValidate
          >
            <div className={styles.bulkField}>
              <label className={styles.label} htmlFor="ec-number">
                {isMod ? 'Глава или диапазон' : 'Номер главы'}
              </label>
              <input
                id="ec-number"
                className="input"
                type="text"
                inputMode="decimal"
                value={editChNumber}
                onChange={(e) => setEditChNumber(e.target.value)}
                placeholder={isMod ? '25 или 30–35' : '25'}
              />
              {(() => {
                const q = parseChapterNo(editChNumber, isMod);
                if (typeof q === 'string')
                  return editChNumber.trim() ? <span className={styles.noErr}>{q}</span> : null;
                return q.end !== null ? (
                  <span className={styles.noHint}>{`Главы ${formatNumber(q.n)}–${formatNumber(q.end)}`}</span>
                ) : (
                  <span className={styles.noHint}>Может быть дробным: 4.1 встанет между 4 и 5</span>
                );
              })()}
            </div>
            <div className={styles.bulkField}>
              <label className={styles.label} htmlFor="ec-name">
                Название <span className={styles.optional}>необязательно</span>
              </label>
              <input
                id="ec-name"
                className="input"
                type="text"
                value={editChName}
                maxLength={300}
                onChange={(e) => setEditChName(e.target.value)}
                placeholder="Название главы"
              />
            </div>
            {title.narrators.length > 0 ? (
              <div className={styles.bulkField}>
                <span className={styles.label}>Кто читает</span>
                <ChapterNarratorPicker
                  all={title.narrators}
                  value={editChNarratorIds}
                  onChange={setEditChNarratorIds}
                />
              </div>
            ) : null}
            <div className={styles.reviewActions}>
              <button type="button" className="btn btn-ghost" onClick={() => setEditingChapter(null)}>
                Отмена
              </button>
              <button type="submit" className="btn btn-primary" disabled={savingChapter}>
                {savingChapter ? 'Сохраняем…' : 'Сохранить'}
              </button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal
        open={bulkReview !== null}
        onClose={() => setBulkReview(null)}
        title={
          bulkReview?.decision === 'reject' ? 'Отклонить все главы' : 'Одобрить все главы'
        }
      >
        {bulkReview ? (
          <div className={styles.reviewDialog}>
            <p className={styles.reviewBody}>
              {bulkReview.ids !== null
                ? `Решение применится к выбранным главам (${bulkReview.ids.length}) — в том числе к уже рассмотренным.`
                : bulkReview.volume
                  ? `Решение применится ко всем главам тома ${bulkReview.volume.number}, ожидающим проверки (${pendingIn(bulkReview.volume)}).`
                  : `Решение применится ко всем главам тайтла, ожидающим проверки (${pendingTotal}).`}
              {bulkReview.decision === 'approve'
                ? ' Одобренные главы появятся на странице тайтла, как только их аудио будет сконвертировано.'
                : ' Отклонённые главы останутся скрытыми, а загрузивший получит уведомление с причиной.'}
            </p>
            <textarea
              className="textarea"
              rows={2}
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              maxLength={1000}
              placeholder={
                bulkReview.decision === 'reject'
                  ? 'Причина отклонения (обязательно)…'
                  : 'Комментарий — необязательно'
              }
              aria-label="Комментарий модератора"
            />
            <div className={styles.reviewActions}>
              <button
                type="button"
                className={bulkReview.decision === 'reject' ? 'btn btn-danger' : 'btn btn-primary'}
                disabled={reviewing}
                onClick={() => void submitBulkReview()}
              >
                {reviewing
                  ? 'Применяем…'
                  : bulkReview.decision === 'reject'
                    ? 'Отклонить'
                    : 'Одобрить'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={reviewing}
                onClick={() => setBulkReview(null)}
              >
                Отмена
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
