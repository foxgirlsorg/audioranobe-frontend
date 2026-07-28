'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ImagePlus,
  Layers,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { api, API_URL, ApiError, getToken } from '@/lib/api';
import { useToast, errMsg } from '@/lib/toast';
import { formatDuration, formatDateTime, timeAgo } from '@/lib/format';
import type { ChapterRow, Job, TitleFull, Volume } from '@/lib/types';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';
import StatusBadge from '@/components/StatusBadge';
import ImageCropper from '@/components/ImageCropper';
import ConfirmDialog from '@/components/ConfirmDialog';
import styles from './TitleContentManager.module.css';

const AUDIO_RE = /\.(mp3|m4a|m4b|aac|wav|ogg|opus|flac)$/i;
const MAX_AUDIO_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB
const AUDIO_ACCEPT = '.mp3,.m4a,.m4b,.aac,.wav,.ogg,.opus,.flac,audio/*';

/** Same "2 before 10" ordering the backend applies to a batch. */
const naturalCompare = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

function xhrUpload(
  path: string,
  form: FormData,
  onProgress: (frac: number) => void
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', API_URL + path);
    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      let data: any;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        data = undefined;
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else {
        reject(
          new ApiError(
            xhr.status,
            data && typeof data.error === 'string' && data.error
              ? data.error
              : `Загрузка не удалась (${xhr.status})`
          )
        );
      }
    };
    xhr.onerror = () => reject(new ApiError(0, 'Ошибка сети при загрузке'));
    xhr.send(form);
  });
}

/**
 * Chapter-level narrator credits: pick one or several of the title's narrators.
 * Renders nothing when the title only has one — the credit is unambiguous then.
 */
function ChapterNarratorPicker({
  all,
  value,
  onChange,
}: {
  all: { id: number; name: string }[];
  value: number[];
  onChange: (ids: number[]) => void;
}) {
  if (all.length < 2) return null;
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

/**
 * Artwork, volumes, chapters, audio uploads and conversion jobs for one title.
 * Lives inside /title/[slug]/edit — this replaced the old /panel/titles/[id].
 */
export default function TitleContentManager({
  title,
  onReload,
}: {
  title: TitleFull;
  /** Re-fetch the title after a change that alters it. */
  onReload: () => Promise<void> | void;
}) {
  const titleId = title.id;
  const { toast } = useToast();

  // Artwork
  const [cropper, setCropper] = useState<'cover' | 'bg' | null>(null);

  // Volumes
  const [showAddVolume, setShowAddVolume] = useState(false);
  const [volNumber, setVolNumber] = useState('');
  const [volName, setVolName] = useState('');
  const [savingVolume, setSavingVolume] = useState(false);
  const [editingVolume, setEditingVolume] = useState<number | null>(null);
  const [editVolNumber, setEditVolNumber] = useState('');
  const [editVolName, setEditVolName] = useState('');
  const [volumeToDelete, setVolumeToDelete] = useState<Volume | null>(null);

  // Chapters
  const [addChapterVol, setAddChapterVol] = useState<number | null>(null);
  const [chName, setChName] = useState('');
  const [chNumber, setChNumber] = useState('');
  const [savingChapter, setSavingChapter] = useState(false);
  const [editingChapter, setEditingChapter] = useState<number | null>(null);
  const [editChName, setEditChName] = useState('');
  const [editChNumber, setEditChNumber] = useState('');
  const [chNarratorIds, setChNarratorIds] = useState<number[]>([]);
  // A chapter cannot exist without audio, so the file is picked up front.
  const [chFile, setChFile] = useState<File | null>(null);
  const [chProgress, setChProgress] = useState<number | null>(null);
  const newChapterInputRef = useRef<HTMLInputElement | null>(null);
  const [editChNarratorIds, setEditChNarratorIds] = useState<number[]>([]);
  const [chapterToDelete, setChapterToDelete] = useState<ChapterRow | null>(null);

  // Uploads
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const uploadChapterRef = useRef<number | null>(null);
  const [uploads, setUploads] = useState<Record<number, number>>({});
  const bulkInputRef = useRef<HTMLInputElement | null>(null);
  const [bulkVolume, setBulkVolume] = useState('');
  const [bulkStart, setBulkStart] = useState('');
  const [bulkNarratorIds, setBulkNarratorIds] = useState<number[]>([]);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkProgress, setBulkProgress] = useState<number | null>(null);

  // Jobs
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoaded, setJobsLoaded] = useState(false);

  const loadJobs = useCallback(async () => {
    try {
      setJobs(await api<Job[]>(`/panel/titles/${titleId}/jobs`));
    } catch {
      // jobs are auxiliary — keep whatever we have
    } finally {
      setJobsLoaded(true);
    }
  }, [titleId]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  // Default bulk-upload target: the first volume.
  useEffect(() => {
    if (title.volumes.length > 0) {
      setBulkVolume((prev) =>
        prev && title.volumes.some((v) => String(v.id) === prev)
          ? prev
          : String(title.volumes[0].id)
      );
    }
  }, [title]);

  useEffect(() => {
    setBulkNarratorIds((prev) =>
      prev.length > 0 ? prev : (title.narrators ?? []).map((n) => n.id)
    );
  }, [title]);

  // Poll while any job is queued/processing; refresh the title when jobs
  // finish so chapter audio statuses update.
  const activeJobs = useMemo(
    () => jobs.filter((j) => j.status === 'queued' || j.status === 'processing').length,
    [jobs]
  );

  useEffect(() => {
    if (activeJobs === 0) return;
    const t = window.setInterval(async () => {
      try {
        const next = await api<Job[]>(`/panel/titles/${titleId}/jobs`);
        setJobs(next);
        const nextActive = next.filter(
          (j) => j.status === 'queued' || j.status === 'processing'
        ).length;
        if (nextActive < activeJobs) void onReload();
      } catch {
        // transient poll failure — try again next tick
      }
    }, 5000);
    return () => window.clearInterval(t);
  }, [activeJobs, titleId, onReload]);

  // ---------- artwork ----------

  async function onCropped(blob: Blob) {
    const kind = cropper;
    if (!kind) return;
    const fd = new FormData();
    fd.append('file', blob, `${kind}.jpg`);
    try {
      await api(`/panel/titles/${titleId}/${kind}`, { formData: fd });
      toast(kind === 'cover' ? 'Обложка обновлена' : 'Фон обновлён');
      await onReload();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  // ---------- volumes ----------

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

  // ---------- chapters ----------

  function openAddChapter(v: Volume) {
    const maxNum = Math.max(0, ...v.chapters.map((c) => c.number));
    setAddChapterVol(v.id);
    setChNumber(String(maxNum + 1));
    setChName('');
    setChFile(null);
    // Default to every narrator on the title; most chapters credit all of them.
    setChNarratorIds((title.narrators ?? []).map((n) => n.id));
  }

  async function addChapter(e: React.FormEvent<HTMLFormElement>, volumeId: number) {
    e.preventDefault();
    const n = Number(chNumber);
    if (!Number.isInteger(n) || n < 0) {
      toast('Номер главы должен быть целым числом', 'error');
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

    const fd = new FormData();
    fd.append('volume_id', String(volumeId));
    fd.append('number', String(n));
    fd.append('name', chName.trim());
    if (chNarratorIds.length > 0) fd.append('narrator_ids', chNarratorIds.join(','));
    fd.append('file', chFile);

    setSavingChapter(true);
    setChProgress(0);
    try {
      const row = await xhrUpload(`/panel/titles/${titleId}/chapters`, fd, setChProgress);
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
    if (!Number.isInteger(n) || n < 0) {
      toast('Номер главы должен быть целым числом', 'error');
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

  // ---------- audio uploads ----------

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
    const fd = new FormData();
    fd.append('file', f);
    setUploads((u) => ({ ...u, [chapterId]: 0 }));
    xhrUpload(`/panel/chapters/${chapterId}/audio`, fd, (frac) =>
      setUploads((u) => ({ ...u, [chapterId]: frac }))
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

  /** Staging step: validate + sort, then show the preview before uploading. */
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

  /** Number the first staged file will get, mirroring the backend default. */
  const bulkFirstNumber = useMemo(() => {
    const typed = bulkStart.trim();
    if (typed !== '') {
      const n = Number(typed);
      return Number.isInteger(n) && n >= 0 ? n : null;
    }
    const last = bulkTargetVolume
      ? Math.max(0, ...bulkTargetVolume.chapters.map((c) => c.number))
      : 0;
    return last + 1;
  }, [bulkStart, bulkTargetVolume]);

  function startBulkUpload() {
    const volId = Number(bulkVolume);
    if (!Number.isInteger(volId) || volId <= 0) {
      toast('Сначала выберите том', 'error');
      return;
    }
    if (bulkFiles.length === 0) return;
    if (bulkFirstNumber === null) {
      toast('Начальный номер должен быть целым неотрицательным числом', 'error');
      return;
    }

    const fd = new FormData();
    fd.append('volume_id', String(volId));
    fd.append('start_number', String(bulkFirstNumber));
    if (bulkNarratorIds.length > 0) fd.append('narrator_ids', bulkNarratorIds.join(','));
    for (const f of bulkFiles) fd.append('files[]', f);

    setBulkProgress(0);
    xhrUpload(`/panel/titles/${titleId}/chapters/bulk`, fd, setBulkProgress)
      .then(async (res: { chapters: ChapterRow[] }) => {
        const n = res?.chapters?.length ?? bulkFiles.length;
        toast(`Создано глав: ${n} — аудио в очереди на конвертацию`);
        setBulkFiles([]);
        setBulkStart('');
        await Promise.all([onReload(), loadJobs()]);
      })
      .catch((err) => toast(errMsg(err), 'error'))
      .finally(() => setBulkProgress(null));
  }

  // ---------- render ----------

  return (
    <div className={styles.manager}>
      {/* ---------- artwork ---------- */}
      <section className={styles.section}>
        <span className={styles.sectionLabel}>Оформление</span>
        <div className={styles.artworkRow}>
          <div className={`glass-panel ${styles.artCard}`}>
            <span className={styles.label}>Обложка · 2:3</span>
            <span className={styles.coverPreview}>
              {title.cover_url ? (
                <img src={title.cover_url} alt="" className={styles.previewImg} />
              ) : (
                <ImagePlus size={24} />
              )}
            </span>
            <button type="button" className="btn" onClick={() => setCropper('cover')}>
              <ImagePlus size={15} />
              Сменить обложку
            </button>
          </div>
          <div className={`glass-panel ${styles.artCard} ${styles.artCardWide}`}>
            <span className={styles.label}>Фоновый баннер · 3:1</span>
            <span className={styles.bgPreview}>
              {title.bg_url ? (
                <img src={title.bg_url} alt="" className={styles.previewImg} />
              ) : (
                <ImagePlus size={24} />
              )}
            </span>
            <button type="button" className="btn" onClick={() => setCropper('bg')}>
              <ImagePlus size={15} />
              Сменить фон
            </button>
          </div>
        </div>
      </section>

      {/* ---------- volumes & chapters ---------- */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionLabel}>Тома и главы</span>
          <button type="button" className="btn btn-primary" onClick={openAddVolume}>
            <Plus size={15} />
            Добавить том
          </button>
        </div>

        <p className={styles.sectionHint}>
          {title.narrators.length > 1
            ? 'Отмечайте чтецов у каждой главы — по умолчанию засчитываются все чтецы тайтла.'
            : 'Чтобы отмечать чтецов по главам, добавьте к тайтлу ещё одного чтеца во вкладке «Инфо».'}
        </p>

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
                      <span className={styles.volumeNum}>{`Том ${v.number}`}</span>
                      {v.name ? <span className={styles.volumeName}>{v.name}</span> : null}
                      <span className={styles.volumeCount}>{`Глав: ${v.chapters.length}`}</span>
                    </div>
                    <div className={styles.volumeActions}>
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
                    </div>
                  </>
                )}
              </div>

              {addChapterVol === v.id ? (
                <form className={styles.inlineForm} onSubmit={(e) => addChapter(e, v.id)} noValidate>
                  <input
                    className={`input ${styles.numInput}`}
                    type="number"
                    value={chNumber}
                    onChange={(e) => setChNumber(e.target.value)}
                    aria-label="Номер главы"
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

              {v.chapters.length === 0 ? (
                <p className={styles.noChapters}>В этом томе пока нет глав.</p>
              ) : (
                v.chapters.map((c) => (
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
                          value={editChNumber}
                          onChange={(e) => setEditChNumber(e.target.value)}
                          aria-label="Номер главы"
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
                          {c.is_deleted ? (
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

      {/* ---------- bulk upload ---------- */}
      <section className={styles.section}>
        <span className={styles.sectionLabel}>Массовая загрузка</span>
        <div className={`glass-panel ${styles.bulkPanel}`}>
          <p className={styles.bulkHint}>
            Файлы сортируются по имени и добавляются в выбранный том одной пачкой. Имя файла
            становится названием главы.
          </p>

          <div className={styles.bulkGrid}>
            <div className={styles.bulkField}>
              <label className={styles.label} htmlFor="bulk-volume">
                Целевой том
              </label>
              <select
                id="bulk-volume"
                className="select"
                value={bulkVolume}
                onChange={(e) => setBulkVolume(e.target.value)}
                disabled={title.volumes.length === 0}
              >
                {title.volumes.length === 0 ? <option value="">Томов пока нет</option> : null}
                {title.volumes.map((v) => (
                  <option key={v.id} value={String(v.id)}>
                    {`Том ${v.number}`}
                    {v.name ? ` — ${v.name}` : ''}
                  </option>
                ))}
              </select>
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
                min={0}
                value={bulkStart}
                onChange={(e) => setBulkStart(e.target.value)}
                placeholder={
                  bulkTargetVolume
                    ? String(Math.max(0, ...bulkTargetVolume.chapters.map((c) => c.number)) + 1)
                    : '1'
                }
              />
            </div>
          </div>

          {title.narrators.length > 1 ? (
            <div className={styles.bulkField}>
              <span className={styles.label}>Чтецы этих глав</span>
              <ChapterNarratorPicker
                all={title.narrators}
                value={bulkNarratorIds}
                onChange={setBulkNarratorIds}
              />
            </div>
          ) : null}

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

          {/* Show exactly which number each file will land on before committing. */}
          {bulkFiles.length > 0 ? (
            <ol className={styles.bulkList}>
              {bulkFiles.map((f, i) => (
                <li key={`${f.name}-${i}`} className={styles.bulkItem}>
                  <span className={styles.bulkItemNum}>
                    {bulkFirstNumber === null ? '?' : bulkFirstNumber + i}
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

      {/* ---------- jobs ---------- */}
      <section className={styles.section}>
        <span className={styles.sectionLabel}>Задачи конвертации</span>
        {!jobsLoaded ? (
          <div className={styles.center}>
            <Spinner />
          </div>
        ) : jobs.length === 0 ? (
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
                {jobs.map((j) => (
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
      </section>

      {/* hidden file inputs */}
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

      <ImageCropper
        open={cropper !== null}
        onClose={() => setCropper(null)}
        aspect={cropper === 'bg' ? 3 : 2 / 3}
        title={cropper === 'bg' ? 'Обрезка фона' : 'Обрезка обложки'}
        onCropped={onCropped}
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
    </div>
  );
}
