'use client';

import { useEffect, useRef, useState } from 'react';
import { Code2, FolderPlus, GripVertical, Layers, Trash2, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { errMsg, useToast } from '@/lib/toast';
import type { Banner } from '@/lib/types';
import { ModShell, ErrorPanel } from '../modnav';
import Toggle from '@/components/Toggle/Toggle';
import Select, { type SelectOption } from '@/components/Select/Select';
import Spinner from '@/components/Spinner/Spinner';
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog';
import { Modal } from '@/components/Modal/Modal';
import { ImageCropper } from '@/components/ImageCropper/ImageCropper';
import AddCard from '@/components/AddCard/AddCard';
import styles from './page.module.css';

const PLACEMENTS: SelectOption[] = [
  { value: 'both', label: 'Сайт и приложение' },
  { value: 'site', label: 'Только сайт' },
  { value: 'app', label: 'Только приложение' },
];

const BANNER_WIDTH = 2048;
const BANNER_HEIGHT = Math.round(BANNER_WIDTH / 3);

interface BannerGroup {
  id: number;
  name: string;
  url: string;
  modal_title: string;
  modal_html: string;
  is_enabled: boolean;
  is_public: boolean;
  placement: NonNullable<Banner['placement']>;
  sort_order: number;
}

type Action = Pick<Banner, 'url' | 'modal_title' | 'modal_html'>;
type BannerPatch = Partial<Action & Pick<Banner, 'is_enabled' | 'is_public' | 'placement' | 'group_id'>>;
type Entry = { type: 'banner'; banner: Banner; sort: number } | { type: 'group'; group: BannerGroup; sort: number };
type ActionTarget = { kind: 'banner' | 'group'; id: number; title: string; html: string };

function imageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('load-failed'));
    };
    img.src = url;
  });
}

const entryKey = (e: Entry) => (e.type === 'group' ? `g${e.group.id}` : `b${e.banner.id}`);
const groupLabel = (g: BannerGroup) => g.name || `Группа ${g.id}`;

export default function BannersPage() {
  return (
    <ModShell title="Баннеры" perm="banners.manage">
      <BannersInner />
    </ModShell>
  );
}

function BannersInner() {
  const { toast } = useToast();
  const [items, setItems] = useState<Banner[]>([]);
  const [groups, setGroups] = useState<BannerGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pickFile, setPickFile] = useState<File | null>(null);
  const [toDelete, setToDelete] = useState<Banner | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<BannerGroup | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [action, setAction] = useState<ActionTarget | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api<{ items: Banner[]; groups: BannerGroup[] }>('/mod/banners')
      .then((d) => {
        if (!alive) return;
        setItems(d.items);
        setGroups(d.groups);
      })
      .catch((e) => alive && setError(errMsg(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const entries: Entry[] = [
    ...groups.map((g): Entry => ({ type: 'group', group: g, sort: g.sort_order })),
    ...items.filter((b) => !b.group_id).map((b): Entry => ({ type: 'banner', banner: b, sort: b.sort_order ?? 0 })),
  ].sort((a, b) => a.sort - b.sort || (a.type === b.type ? 0 : a.type === 'group' ? -1 : 1));

  const groupOptions: SelectOption[] = [
    { value: '', label: 'Без группы' },
    ...groups.map((g) => ({ value: String(g.id), label: groupLabel(g) })),
  ];

  const upload = async (blob: Blob) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', blob, 'banner.webp');
      const created = await api<Banner>('/mod/banners', { formData: fd });
      setItems((xs) => [...xs, created]);
      toast('Баннер добавлен', 'ok');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setUploading(false);
    }
  };

  const patch = async (b: Banner, body: BannerPatch) => {
    try {
      const next = await api<Banner>(`/mod/banners/${b.id}`, { method: 'PATCH', body });
      setItems((xs) => xs.map((x) => (x.id === b.id ? next : x)));
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  const patchGroup = async (g: BannerGroup, body: Partial<Omit<BannerGroup, 'id' | 'sort_order'>>) => {
    try {
      const next = await api<BannerGroup>(`/mod/banner-groups/${g.id}`, { method: 'PATCH', body });
      setGroups((xs) => xs.map((x) => (x.id === g.id ? next : x)));
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  const addGroup = async () => {
    try {
      const created = await api<BannerGroup>('/mod/banner-groups', { body: { name: '' } });
      setGroups((xs) => [...xs, created]);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  const removeGroup = async (g: BannerGroup) => {
    try {
      await api(`/mod/banner-groups/${g.id}`, { method: 'DELETE' });
      setGroups((xs) => xs.filter((x) => x.id !== g.id));
      setItems((xs) => xs.map((x) => (x.group_id === g.id ? { ...x, group_id: null, sort_order: g.sort_order } : x)));
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  const pick = async (f: File) => {
    try {
      const { width, height } = await imageSize(f);
      if (width === BANNER_WIDTH && height === BANNER_HEIGHT) {
        void upload(f);
        return;
      }
    } catch {
    }
    setPickFile(f);
  };

  const remove = async (b: Banner) => {
    try {
      await api(`/mod/banners/${b.id}`, { method: 'DELETE' });
      setItems((xs) => xs.filter((x) => x.id !== b.id));
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  const drop = async (targetKey: string) => {
    if (dragKey === null || dragKey === targetKey) return;
    const from = entries.findIndex((e) => entryKey(e) === dragKey);
    const to = entries.findIndex((e) => entryKey(e) === targetKey);
    setDragKey(null);
    if (from < 0 || to < 0) return;
    const next = [...entries];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const order = new Map(next.map((e, i) => [entryKey(e), i]));
    setGroups((xs) => xs.map((g) => ({ ...g, sort_order: order.get(`g${g.id}`) ?? g.sort_order })));
    setItems((xs) => xs.map((b) => (b.group_id ? b : { ...b, sort_order: order.get(`b${b.id}`) ?? b.sort_order })));
    try {
      await api('/mod/banners/reorder', {
        method: 'POST',
        body: { items: next.map((e) => (e.type === 'group' ? { type: 'group', id: e.group.id } : { type: 'banner', id: e.banner.id })) },
      });
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  const saveAction = () => {
    if (!action) return;
    const body = { modal_title: action.title.trim(), modal_html: action.html.trim() };
    if (action.kind === 'group') {
      const g = groups.find((x) => x.id === action.id);
      if (g) void patchGroup(g, body);
    } else {
      const b = items.find((x) => x.id === action.id);
      if (b) void patch(b, body);
    }
    setAction(null);
  };

  const dragProps = (key: string) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.stopPropagation();
      setDragKey(key);
    },
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDrop: (e: React.DragEvent) => {
      e.stopPropagation();
      void drop(key);
    },
    style: dragKey === key ? { opacity: 0.5 } : undefined,
  });

  const actionInputs = (row: Action, onUrl: (url: string) => void, open: () => void) => (
    <>
      <input
        className={`input ${styles.url}`}
        defaultValue={row.url}
        placeholder={row.modal_html ? 'открывает окно' : 'ссылка (необязательно)'}
        disabled={!!row.modal_html}
        onBlur={(e) => {
          if (e.target.value !== row.url) onUrl(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
      <button
        type="button"
        className={`btn btn-ghost ${styles.iconBtn} ${row.modal_html ? styles.htmlOn : ''}`}
        onClick={open}
        aria-label="Окно"
        title={row.modal_html ? `Открывает окно «${row.modal_title || 'без заголовка'}»` : 'Открывать окно вместо ссылки'}
      >
        <Code2 size={14} />
      </button>
    </>
  );

  const visibility = (
    v: { placement?: Banner['placement']; is_public?: boolean; is_enabled?: boolean },
    set: (body: { placement?: Banner['placement']; is_public?: boolean; is_enabled?: boolean }) => void
  ) => (
    <>
      <Select
        size="sm"
        className={styles.fixed}
        value={v.placement ?? 'both'}
        options={PLACEMENTS}
        onChange={(p) => set({ placement: p as Banner['placement'] })}
        ariaLabel="Где показывать"
      />
      <label className={styles.flag}>
        <Toggle checked={v.is_public ?? false} onChange={(on) => set({ is_public: on })} />
        Публичный
      </label>
      <label className={styles.flag}>
        <Toggle checked={v.is_enabled ?? false} onChange={(on) => set({ is_enabled: on })} />
        Включён
      </label>
    </>
  );

  const bannerRow = (b: Banner, inGroup: boolean) => (
    <div key={b.id} className={styles.row} {...(inGroup ? {} : dragProps(`b${b.id}`))}>
      {inGroup ? null : (
        <span className={styles.grip} title="Перетащить">
          <GripVertical size={16} />
        </span>
      )}
      <img src={b.image_url} alt="" className={styles.thumb} />
      {inGroup ? (
        <span className={styles.inherit}>настройки и действие группы</span>
      ) : (
        actionInputs(
          { url: b.url, modal_title: b.modal_title ?? '', modal_html: b.modal_html ?? '' },
          (url) => void patch(b, { url }),
          () => setAction({ kind: 'banner', id: b.id, title: b.modal_title ?? '', html: b.modal_html ?? '' })
        )
      )}
      <Select
        size="sm"
        className={styles.fixed}
        value={b.group_id ? String(b.group_id) : ''}
        options={groupOptions}
        onChange={(v) => void patch(b, { group_id: v ? Number(v) : null })}
        ariaLabel="Группа"
      />
      {inGroup ? null : visibility(b, (body) => void patch(b, body))}
      <button type="button" className={`btn btn-ghost ${styles.iconBtn}`} onClick={() => setToDelete(b)} aria-label="Удалить">
        <Trash2 size={14} />
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className={styles.center}>
        <Spinner />
      </div>
    );
  }
  if (error) {
    return <ErrorPanel message={error} />;
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.lead}>
        Карусель на главной под блоком «Новые тайтлы». Формат 3:1, {BANNER_WIDTH}×{BANNER_HEIGHT}. Группа занимает одно
        место в карусели: каждому посетителю показывается случайный баннер из неё. Видимость (включена, публичная,
        сайт или приложение) и клик (ссылка или окно) задаются у группы. Порядок групп и баннеров меняется перетаскиванием.
      </p>

      <div className={styles.rows}>
        {entries.map((e) => {
          if (e.type === 'banner') return bannerRow(e.banner, false);
          const g = e.group;
          const members = items.filter((b) => b.group_id === g.id);
          return (
            <div key={`g${g.id}`} className={`glass-panel ${styles.group}`} {...dragProps(`g${g.id}`)}>
              <div className={styles.groupHead}>
                <span className={styles.grip} title="Перетащить">
                  <GripVertical size={16} />
                </span>
                <Layers size={15} className={styles.groupIcon} aria-hidden="true" />
                <input
                  className={`input ${styles.groupName}`}
                  defaultValue={g.name}
                  placeholder={groupLabel(g)}
                  maxLength={80}
                  aria-label="Название группы"
                  onBlur={(ev) => {
                    if (ev.target.value.trim() !== g.name) void patchGroup(g, { name: ev.target.value.trim() });
                  }}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur();
                  }}
                />
                {actionInputs(
                  g,
                  (url) => void patchGroup(g, { url }),
                  () => setAction({ kind: 'group', id: g.id, title: g.modal_title, html: g.modal_html })
                )}
                {visibility(g, (body) => void patchGroup(g, body))}
                <span className={styles.count}>{members.length}</span>
                <button
                  type="button"
                  className={`btn btn-ghost ${styles.iconBtn}`}
                  onClick={() => setGroupToDelete(g)}
                  aria-label="Удалить группу"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className={styles.groupBody}>
                {members.length === 0 ? (
                  <p className={styles.hint}>Пусто. Выберите эту группу в поле «Группа» у баннера.</p>
                ) : (
                  members.map((b) => bannerRow(b, true))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.addRow}>
        <AddCard
          icon={Upload}
          label="Добавить баннер"
          loading={uploading}
          onClick={() => fileInput.current?.click()}
          onDropFile={(f) => void pick(f)}
        />
        <button type="button" className={`btn ${styles.addGroup}`} onClick={() => void addGroup()}>
          <FolderPlus size={15} />
          Новая группа
        </button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          if (f) void pick(f);
          e.target.value = '';
        }}
      />

      <ImageCropper
        open={!!pickFile}
        onClose={() => setPickFile(null)}
        file={pickFile}
        aspect={3}
        title="Кадрируйте баннер (3:1)"
        maxWidth={BANNER_WIDTH}
        onCropped={(blob) => {
          setPickFile(null);
          void upload(blob);
        }}
      />

      <Modal open={!!action} onClose={() => setAction(null)} title="Окно по клику" size="wide">
        <p className={styles.htmlHint}>
          Если HTML заполнен, клик по {action?.kind === 'group' ? 'любому баннеру группы' : 'баннеру'} открывает окно с
          этим заголовком и содержимым вместо перехода по ссылке. HTML вставляется в страницу как есть, скрипты
          выполняются; давайте своим классам уникальные имена, чтобы не задеть стили сайта.
          Очистите HTML, чтобы вернуть ссылку.
        </p>
        <label className={styles.htmlField}>
          <span className={styles.htmlLabel}>Заголовок окна</span>
          <input
            className="input"
            value={action?.title ?? ''}
            maxLength={200}
            placeholder="Приложение для Android"
            onChange={(e) => action && setAction({ ...action, title: e.target.value })}
          />
        </label>
        <label className={styles.htmlField}>
          <span className={styles.htmlLabel}>HTML</span>
          <textarea
            className={`input ${styles.htmlArea}`}
            value={action?.html ?? ''}
            onChange={(e) => action && setAction({ ...action, html: e.target.value })}
            spellCheck={false}
            placeholder="<p>Текст…</p>"
          />
        </label>
        <div className={styles.htmlActions}>
          <button type="button" className="btn btn-ghost" onClick={() => setAction(null)}>
            Отмена
          </button>
          <button type="button" className="btn btn-primary" onClick={saveAction}>
            Сохранить
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) void remove(toDelete);
        }}
        title="Удалить баннер"
        body="Удалить этот баннер?"
        danger
      />
      <ConfirmDialog
        open={!!groupToDelete}
        onClose={() => setGroupToDelete(null)}
        onConfirm={() => {
          if (groupToDelete) void removeGroup(groupToDelete);
        }}
        title="Удалить группу"
        body="Удалить группу? Её баннеры останутся и станут обычными."
        danger
      />
    </div>
  );
}
