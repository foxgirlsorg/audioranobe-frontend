'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronRight,
  Flame,
  Layers,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { uploadInChunks } from '@/lib/upload';
import { useAuth } from '@/lib/auth';
import { useToast, errMsg } from '@/lib/toast';
import { formatDuration, formatDateTime, timeAgo } from '@/lib/format';
import type { ChapterRow, JobsPage, TitleFull, Volume } from '@/lib/types';
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

const nextNumberIn = (v: Volume): number =>
  Math.floor(Math.max(0, ...v.chapters.map((c) => c.number))) + 1;

const formatNumber = (n: number): string => String(Math.round(n * 1000) / 1000);

function ChapterNarratorPicker({
  all,
  value,
  onChange,
}: {
  all: { id: number; name: string }[];
  value: number[];
  onChange: (ids: number[]) => void;
}) {
  if (all.length === 0) return null;
  const toggle = (id: number) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
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

export default function TitleContentManager({
  title,
  onReload,
}: {
  title: TitleFull;
  onReload: () => Promise<void> | void;
}) {
  const titleId = title.id;
  const { toast } = useToast();
  const { user, isMod } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [showAddVolume, setShowAddVolume] = useState(false);
  const [volNumber, setVolNumber] = useState('');
  const [volName, setVolName] = useState('');
  const [savingVolume, setSavingVolume] = useState(false);
  const [editingVolume, setEditingVolume] = useState<number | null>(null);
  const [editVolNumber, setEditVolNumber] = useState('');
  const [editVolName, setEditVolName] = useState('');
  const [volumeToDelete, setVolumeToDelete] = useState<Volume | null>(null);
  const [openVolumes, setOpenVolumes] = useState<Set<number>>(new Set());

  const toggleVolume = (id: number) =>
    setOpenVolumes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const [addChapterVol, setAddChapterVol] = useState<number | null>(null);
  const [chName, setChName] = useState('');
  const [chNumber, setChNumber] = useState('');
  const [savingChapter, setSavingChapter] = useState(false);
  const [editingChapter, setEditingChapter] = useState<number | null>(null);
  const [editChName, setEditChName] = useState('');
  const [editChNumber, setEditChNumber] = useState('');
  const [chNarratorIds, setChNarratorIds] = useState<number[]>([]);
  const [chFile, setChFile] = useState<File | null>(null);
  const [chProgress, setChProgress] = useState<number | null>(null);
  const newChapterInputRef = useRef<HTMLInputElement | null>(null);
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
  const bulkInputRef = useRef<HTMLInputElement | null>(null);
  const [bulkVolume, setBulkVolume] = useState('');
  const [bulkStart, setBulkStart] = useState('');
  const [bulkNarratorIds, setBulkNarratorIds] = useState<number[]>([]);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkProgress, setBulkProgress] = useState<number | null>(null);
  const [bulkUseFileNames, setBulkUseFileNames] = useState(false);

  const [selected, setSelected] = useState<number[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditVolume, setBulkEditVolume] = useState('');
  const [bulkEditChangeNarr, setBulkEditChangeNarr] = useState(false);
  const [bulkEditNarrIds, setBulkEditNarrIds] = useState<number[]>([]);
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

  useEffect(() => {
    if (title.volumes.length > 0) {
      setBulkVolume((prev) =>
        prev && title.volumes.some((v) => String(v.id) === prev)
          ? prev
          : String(title.volumes[0].id)
      );
    }
  }, [title]);

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
    if (!Number.isInteger(n) || n < 0) {
      toast('Номер тома должен быть целым числом', 'error');
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
    if (!Number.isInteger(n) || n < 0) {
      toast('Номер тома должен быть целым числом', 'error');
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

  function openAddChapter(v: Volume) {
    setOpenVolumes((prev) => new Set(prev).add(v.id));
    setAddChapterVol(v.id);
    setChNumber(String(nextNumberIn(v)));
    setChName('');
    setChFile(null);
    setChNarratorIds([]);
  }

  async function addChapter(e: React.FormEvent<HTMLFormElement>, volumeId: number) {
    e.preventDefault();
    const n = Number(chNumber);
    if (!Number.isFinite(n) || n < 0) {
      toast('Номер главы должен быть числом не меньше 0', 'error');
      return;
    }
    if (title.narrators.length > 0 && chNarratorIds.length === 0) {
      toast('Отметьте чтеца главы', 'error');
      return;
    }
    if (!chFile) {
      toast('Выберите аудиофайл — глава без аудио не создаётся', 'error');
      return;
    }
    const bad = validAudio(chFile);
    if (bad) {
      toast(bad, 'error');
      return;
    }

    setSavingChapter(true);
    setChProgress(0);
    try {
      const uploadId = await uploadInChunks(chFile, setChProgress);
      const row = await api<ChapterRow & { mod_status: string }>(
        `/panel/titles/${titleId}/chapters`,
        {
          body: {
            volume_id: volumeId,
            number: n,
            name: chName.trim(),
            narrator_ids: chNarratorIds,
            upload_id: uploadId,
          },
        }
      );
      toast(
        row?.mod_status === 'approved'
          ? 'Глава добавлена — аудио в очереди на конвертацию'
          : 'Глава добавлена — отправлена на модерацию'
      );
      setAddChapterVol(null);
      setChFile(null);
      await Promise.all([onReload(), loadJobs()]);
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSavingChapter(false);
      setChProgress(null);
    }
  }

  function startEditChapter(c: ChapterRow) {
    setEditingChapter(c.id);
    setEditChName(c.name);
    setEditChNumber(String(c.number));
    setEditChNarratorIds((c.narrators ?? []).map((n) => n.id));
  }

  async function saveChapter(e: React.FormEvent<HTMLFormElement>, chapterId: number) {
    e.preventDefault();
    const n = Number(editChNumber);
    if (!Number.isFinite(n) || n < 0) {
      toast('Номер главы должен быть числом не меньше 0', 'error');
      return;
    }
    setSavingChapter(true);
    try {
      const res = await api<{ applied?: boolean }>(`/panel/chapters/${chapterId}`, {
        method: 'PATCH',
        body: { name: editChName.trim(), number: n, narrator_ids: editChNarratorIds },
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
  const pendingTotal = title.volumes.reduce((n, v) => n + pendingIn(v), 0);

  const allChapters = useMemo(
    () => title.volumes.flatMap((v) => v.chapters),
    [title]
  );

  useEffect(() => {
    setSelected((prev) => {
      const live = prev.filter((id) => allChapters.some((c) => c.id === id));
      return live.length === prev.length ? prev : live;
    });
  }, [allChapters]);

  const toggleSelected = (id: number) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  function toggleVolumeSelection(v: Volume) {
    const ids = v.chapters.map((c) => c.id);
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
    if (selected.length === 0) return;
    const body: { chapter_ids: number[]; volume_id?: number; narrator_ids?: number[] } = {
      chapter_ids: selected,
    };
    if (bulkEditVolume) body.volume_id = Number(bulkEditVolume);
    if (bulkEditChangeNarr) body.narrator_ids = bulkEditNarrIds;
    if (body.volume_id === undefined && body.narrator_ids === undefined) {
      toast('Выберите том или отметьте смену чтецов', 'error');
      return;
    }
    setBulkBusy(true);
    try {
      const res = await api<{ updated: number }>(`/panel/titles/${titleId}/chapters/bulk-edit`, {
        method: 'POST',
        body,
      });
      toast(`Изменено глав: ${res?.updated ?? selected.length}`);
      setBulkEditOpen(false);
      setBulkEditVolume('');
      setBulkEditChangeNarr(false);
      setBulkEditNarrIds([]);
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

  function onBulkPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    for (const f of files) {
      const bad = validAudio(f);
      if (bad) {
        toast(bad, 'error');
        return;
      }
    }
    setBulkFiles([...files].sort((a, b) => naturalCompare(a.name, b.name)));
  }

  const bulkTargetVolume = title.volumes.find((v) => String(v.id) === bulkVolume) ?? null;

  const bulkFirstNumber = useMemo(() => {
    const typed = bulkStart.trim();
    if (typed !== '') {
      const n = Number(typed);
      return Number.isFinite(n) && n >= 0 ? n : null;
    }
    return bulkTargetVolume ? nextNumberIn(bulkTargetVolume) : 1;
  }, [bulkStart, bulkTargetVolume]);

  function startBulkUpload() {
    const volId = Number(bulkVolume);
    if (!Number.isInteger(volId) || volId <= 0) {
      toast('Сначала выберите том', 'error');
      return;
    }
    if (bulkFiles.length === 0) return;
    if (bulkFirstNumber === null) {
      toast('Начальный номер должен быть числом не меньше 0', 'error');
      return;
    }
    if (title.narrators.length > 0 && bulkNarratorIds.length === 0) {
      toast('Отметьте чтецов этих глав', 'error');
      return;
    }

    const files = bulkFiles;
    const total = files.reduce((sum, f) => sum + f.size, 0) || 1;
    let done = 0;

    setBulkProgress(0);
    (async () => {
      const uploadIds: number[] = [];
      for (const f of files) {
        const id = await uploadInChunks(f, (frac) =>
          setBulkProgress(Math.min(1, (done + frac * f.size) / total))
        );
        uploadIds.push(id);
        done += f.size;
        setBulkProgress(Math.min(1, done / total));
      }
      return api<{ chapters: ChapterRow[] }>(`/panel/titles/${titleId}/chapters/bulk`, {
        body: {
          volume_id: volId,
          start_number: bulkFirstNumber,
          use_file_names: bulkUseFileNames,
          narrator_ids: bulkNarratorIds,
          upload_ids: uploadIds,
        },
      });
    })()
      .then(async (res: { chapters: ChapterRow[] }) => {
        const n = res?.chapters?.length ?? files.length;
        toast(`Создано глав: ${n} — аудио в очереди на конвертацию`);
        setBulkFiles([]);
        setBulkStart('');
        await Promise.all([onReload(), loadJobs()]);
      })
      .catch((err) => toast(errMsg(err), 'error'))
      .finally(() => setBulkProgress(null));
  }

  return (
    <div className={styles.manager}>
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionLabel}>Тома и главы</span>
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
          <button type="button" className="btn btn-primary" onClick={openAddVolume}>
            <Plus size={15} />
            Добавить том
          </button>
        </div>

        {selected.length > 0 ? (
          <div className={`glass-panel ${styles.selectionBar}`}>
            <span className={styles.selectionCount}>{`Выбрано глав: ${selected.length}`}</span>
            {isMod ? (
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
            <button
              type="button"
              className="btn"
              disabled={bulkBusy}
              onClick={() => {
                setBulkEditVolume('');
                setBulkEditChangeNarr(false);
                setBulkEditNarrIds([]);
                setBulkEditOpen(true);
              }}
            >
              <Layers size={15} />
              Том / чтецы
            </button>
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

        {title.volumes.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="Томов пока нет"
            body="Сначала добавьте том — главы живут внутри томов."
          />
        ) : (
          title.volumes.map((v) => (
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
                      {v.chapters.length > 0 ? (
                        <input
                          type="checkbox"
                          className={styles.selectBox}
                          checked={v.chapters.every((c) => selected.includes(c.id))}
                          onChange={() => toggleVolumeSelection(v)}
                          aria-label={`Выбрать все главы тома ${v.number}`}
                          title="Выбрать все главы тома"
                        />
                      ) : null}
                      <span className={styles.volumeNum}>{`Том ${v.number}`}</span>
                      {v.name ? <span className={styles.volumeName}>{v.name}</span> : null}
                      <span className={styles.volumeCount}>{`Глав: ${v.chapters.length}`}</span>
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
                      {isMod && pendingIn(v) > 0 ? (
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
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => openAddChapter(v)}
                        title="Добавить главу"
                        aria-label={`Добавить главу в том ${v.number}`}
                      >
                        <Plus size={15} />
                      </button>
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

              {openVolumes.has(v.id) && addChapterVol === v.id ? (
                <form className={styles.inlineForm} onSubmit={(e) => addChapter(e, v.id)} noValidate>
                  <input
                    className={`input ${styles.numInput}`}
                    type="number"
                    step="0.1"
                    min={0}
                    value={chNumber}
                    onChange={(e) => setChNumber(e.target.value)}
                    aria-label="Номер главы"
                    title="Может быть дробным: 4.1 встанет между 4 и 5"
                  />
                  <input
                    className={`input ${styles.growInput}`}
                    type="text"
                    value={chName}
                    maxLength={300}
                    onChange={(e) => setChName(e.target.value)}
                    placeholder="Название главы — необязательно"
                    aria-label="Название главы"
                  />
                  <ChapterNarratorPicker
                    all={title.narrators}
                    value={chNarratorIds}
                    onChange={setChNarratorIds}
                  />
                  <button
                    type="button"
                    className="btn"
                    onClick={() => newChapterInputRef.current?.click()}
                    disabled={savingChapter}
                  >
                    <Upload size={14} />
                    {chFile ? chFile.name : 'Выбрать аудио'}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={savingChapter || !chFile}
                  >
                    {savingChapter
                      ? chProgress !== null
                        ? `Загружаем… ${Math.round(chProgress * 100)}%`
                        : 'Добавляем…'
                      : 'Добавить главу'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setAddChapterVol(null)}
                  >
                    Отмена
                  </button>
                </form>
              ) : null}

              {!openVolumes.has(v.id) ? null : visibleChapters(v).length === 0 ? (
                <p className={styles.noChapters}>В этом томе пока нет глав.</p>
              ) : (
                visibleChapters(v).map((c) => (
                  <div key={c.id} className={styles.chapterRow}>
                    {editingChapter === c.id ? (
                      <form
                        className={styles.chapterEditForm}
                        onSubmit={(e) => saveChapter(e, c.id)}
                        noValidate
                      >
                        <input
                          className={`input ${styles.numInput}`}
                          type="number"
                          step="0.1"
                          min={0}
                          value={editChNumber}
                          onChange={(e) => setEditChNumber(e.target.value)}
                          aria-label="Номер главы"
                          title="Может быть дробным: 4.1 встанет между 4 и 5"
                        />
                        <input
                          className={`input ${styles.growInput}`}
                          type="text"
                          value={editChName}
                          maxLength={300}
                          onChange={(e) => setEditChName(e.target.value)}
                          placeholder="Название главы — необязательно"
                          aria-label="Название главы"
                        />
                        <ChapterNarratorPicker
                          all={title.narrators}
                          value={editChNarratorIds}
                          onChange={setEditChNarratorIds}
                        />
                        <button type="submit" className="btn btn-primary" disabled={savingChapter}>
                          Сохранить
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => setEditingChapter(null)}
                        >
                          <X size={14} />
                        </button>
                      </form>
                    ) : (
                      <>
                        <input
                          type="checkbox"
                          className={styles.selectBox}
                          checked={selected.includes(c.id)}
                          onChange={() => toggleSelected(c.id)}
                          aria-label={`Выбрать главу ${c.number}`}
                        />
                        <span className={styles.chNum}>{c.number}</span>
                        <span
                          className={
                            c.is_deleted ? `${styles.chName} ${styles.chDeleted}` : styles.chName
                          }
                        >
                          {c.name || `Глава ${c.number}`}
                        </span>
                        {c.duration_seconds > 0 ? (
                          <span className={styles.chDuration}>
                            {formatDuration(c.duration_seconds)}
                          </span>
                        ) : null}
                        {(c.narrators ?? []).length > 0 ? (
                          <span className={styles.chNarrators} title="Чтецы главы">
                            {c.narrators.map((n) => n.name).join(', ')}
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
                            aria-label={`Загрузить аудио для главы ${c.number}`}
                          >
                            <Upload size={14} />
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
                    )}
                  </div>
                ))
              )}
            </div>
          ))
        )}
      </section>

      <section className={styles.section}>
        <span className={styles.sectionLabel}>Массовая загрузка</span>
        <div className={`glass-panel ${styles.bulkPanel}`}>
          <p className={styles.bulkHint}>
            Файлы сортируются по имени и добавляются в выбранный том одной пачкой. Названия
            глав по умолчанию не задаются — главы показываются как «Глава N».
          </p>

          <div className={styles.bulkGrid}>
            <div className={styles.bulkField}>
              <label className={styles.label} htmlFor="bulk-volume">
                Целевой том
              </label>
              <Select
                id="bulk-volume"
                block
                value={bulkVolume}
                placeholder="Томов пока нет"
                disabled={title.volumes.length === 0}
                options={title.volumes.map((v) => ({
                  value: String(v.id),
                  label: `Том ${v.number}${v.name ? ` — ${v.name}` : ''}`,
                }))}
                onChange={setBulkVolume}
              />
            </div>

            <div className={styles.bulkField}>
              <label className={styles.label} htmlFor="bulk-start">
                Начать с главы{' '}
                <span className={styles.optional}>
                  {bulkTargetVolume && bulkTargetVolume.chapters.length > 0
                    ? `сейчас ${bulkTargetVolume.chapters.length}`
                    : 'том пуст'}
                </span>
              </label>
              <input
                id="bulk-start"
                className="input"
                type="number"
                step="0.1"
                min={0}
                value={bulkStart}
                onChange={(e) => setBulkStart(e.target.value)}
                placeholder={bulkTargetVolume ? String(nextNumberIn(bulkTargetVolume)) : '1'}
              />
            </div>
          </div>

          {title.narrators.length > 0 ? (
            <div className={styles.bulkField}>
              <span className={styles.label}>
                Чтецы этих глав <span className={styles.required}>обязательно</span>
              </span>
              <ChapterNarratorPicker
                all={title.narrators}
                value={bulkNarratorIds}
                onChange={setBulkNarratorIds}
              />
            </div>
          ) : null}

          <Toggle
            checked={bulkUseFileNames}
            onChange={setBulkUseFileNames}
            label="Использовать имена файлов как названия глав"
          />

          <div className={styles.bulkRow}>
            <button
              type="button"
              className="btn"
              onClick={() => bulkInputRef.current?.click()}
              disabled={bulkProgress !== null || title.volumes.length === 0}
            >
              <Plus size={15} />
              {bulkFiles.length > 0 ? 'Выбрать другие файлы' : 'Выбрать файлы'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={startBulkUpload}
              disabled={bulkProgress !== null || bulkFiles.length === 0}
            >
              <Upload size={15} />
              {bulkProgress !== null
                ? 'Загружаем…'
                : bulkFiles.length > 0
                  ? `Загрузить (${bulkFiles.length})`
                  : 'Загрузить'}
            </button>
            {bulkFiles.length > 0 && bulkProgress === null ? (
              <button type="button" className="btn btn-ghost" onClick={() => setBulkFiles([])}>
                Очистить
              </button>
            ) : null}
          </div>

          {bulkFiles.length > 0 ? (
            <ol className={styles.bulkList}>
              {bulkFiles.map((f, i) => (
                <li key={`${f.name}-${i}`} className={styles.bulkItem}>
                  <span className={styles.bulkItemNum}>
                    {bulkFirstNumber === null ? '?' : formatNumber(bulkFirstNumber + i)}
                  </span>
                  <span className={styles.bulkItemName}>{f.name}</span>
                </li>
              ))}
            </ol>
          ) : null}

          {bulkProgress !== null ? (
            <div className={styles.bulkProgressRow}>
              <span className={styles.progress}>
                <span
                  className={styles.progressFill}
                  style={{ width: `${Math.round(bulkProgress * 100)}%` }}
                />
              </span>
              <span className={styles.progressPct}>{Math.round(bulkProgress * 100)}%</span>
            </div>
          ) : null}
        </div>
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
        ref={newChapterInputRef}
        type="file"
        accept={AUDIO_ACCEPT}
        className={styles.hiddenInput}
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          e.target.value = '';
          if (!f) return;
          const bad = validAudio(f);
          if (bad) {
            toast(bad, 'error');
            return;
          }
          setChFile(f);
        }}
        aria-hidden="true"
        tabIndex={-1}
      />
      <input
        ref={bulkInputRef}
        type="file"
        multiple
        accept={AUDIO_ACCEPT}
        className={styles.hiddenInput}
        onChange={onBulkPicked}
        aria-hidden="true"
        tabIndex={-1}
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
        open={bulkEditOpen}
        onClose={() => setBulkEditOpen(false)}
        title="Изменить выбранные главы"
      >
        <div className={styles.reviewDialog}>
          <p className={styles.reviewBody}>
            {`Изменения применятся к выбранным главам (${selected.length}) одним запросом.`}
          </p>
          <div className={styles.bulkField}>
            <label className={styles.label} htmlFor="be-volume">
              Переместить в том
            </label>
            <Select
              id="be-volume"
              block
              value={bulkEditVolume}
              placeholder="— не менять —"
              disabled={title.volumes.length === 0}
              options={title.volumes.map((v) => ({
                value: String(v.id),
                label: `Том ${v.number}${v.name ? ` — ${v.name}` : ''}`,
              }))}
              onChange={setBulkEditVolume}
            />
          </div>
          {title.narrators.length > 0 ? (
            <div className={styles.bulkField}>
              <Toggle
                checked={bulkEditChangeNarr}
                onChange={setBulkEditChangeNarr}
                label="Изменить чтецов"
                hint="Заменит список чтецов у выбранных глав"
              />
              {bulkEditChangeNarr ? (
                <ChapterNarratorPicker
                  all={title.narrators}
                  value={bulkEditNarrIds}
                  onChange={setBulkEditNarrIds}
                />
              ) : null}
            </div>
          ) : null}
          <div className={styles.bulkRow}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={bulkBusy}
              onClick={() => void submitBulkEdit()}
            >
              <Check size={15} />
              Применить
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setBulkEditOpen(false)}>
              Отмена
            </button>
          </div>
        </div>
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
