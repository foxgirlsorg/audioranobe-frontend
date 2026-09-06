'use client';

import { useEffect, useRef, useState } from 'react';
import { GripVertical, Trash2, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { errMsg, useToast } from '@/lib/toast';
import type { Banner } from '@/lib/types';
import { ModShell, ErrorPanel } from '../modnav';
import Toggle from '@/components/Toggle/Toggle';
import Spinner from '@/components/Spinner/Spinner';
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog';
import { ImageCropper } from '@/components/ImageCropper/ImageCropper';
import AddCard from '@/components/AddCard/AddCard';
import styles from './page.module.css';

const BANNER_WIDTH = 2048;
const BANNER_HEIGHT = Math.round(BANNER_WIDTH / 3);

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pickFile, setPickFile] = useState<File | null>(null);
  const [toDelete, setToDelete] = useState<Banner | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api<{ items: Banner[] }>('/mod/banners')
      .then((d) => alive && setItems(d.items))
      .catch((e) => alive && setError(errMsg(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

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

  const patch = async (b: Banner, body: Partial<Pick<Banner, 'url' | 'is_enabled' | 'is_public'>>) => {
    try {
      const next = await api<Banner>(`/mod/banners/${b.id}`, { method: 'PATCH', body });
      setItems((xs) => xs.map((x) => (x.id === b.id ? next : x)));
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

  const drop = async (targetId: number) => {
    if (dragId === null || dragId === targetId) return;
    const from = items.findIndex((x) => x.id === dragId);
    const to = items.findIndex((x) => x.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
    setDragId(null);
    try {
      await api('/mod/banners/reorder', { method: 'POST', body: { ids: next.map((x) => x.id) } });
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

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
        Карусель на главной под блоком «Новые тайтлы». Формат 3:1, {BANNER_WIDTH}×{BANNER_HEIGHT}.
      </p>

      {items.length === 0 ? null : (
        <div className={styles.rows}>
          {items.map((b) => (
            <div
              key={b.id}
              className={styles.row}
              draggable
              onDragStart={() => setDragId(b.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => drop(b.id)}
              style={dragId === b.id ? { opacity: 0.5 } : undefined}
            >
              <span className={styles.grip} title="Перетащить">
                <GripVertical size={16} />
              </span>
              <img src={b.image_url} alt="" className={styles.thumb} />
              <input
                className="input"
                defaultValue={b.url}
                placeholder="ссылка (необязательно)"
                onBlur={(e) => {
                  if (e.target.value !== b.url) void patch(b, { url: e.target.value });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
              />
              <label className={styles.flag}>
                <Toggle checked={b.is_public ?? false} onChange={(on) => void patch(b, { is_public: on })} />
                Публичный
              </label>
              <label className={styles.flag}>
                <Toggle checked={b.is_enabled ?? false} onChange={(on) => void patch(b, { is_enabled: on })} />
                Включён
              </label>
              <button type="button" className={`btn btn-ghost ${styles.del}`} onClick={() => setToDelete(b)} aria-label="Удалить">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <AddCard
        icon={Upload}
        label="Добавить баннер"
        loading={uploading}
        onClick={() => fileInput.current?.click()}
        onDropFile={(f) => void pick(f)}
      />
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
    </div>
  );
}
