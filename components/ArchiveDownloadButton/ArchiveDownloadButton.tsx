'use client';

import React, { useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import { API_URL } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { ZipBuilder, safeEntryName, saveBlob } from '@/lib/zip';
import styles from './ArchiveDownloadButton.module.css';

export interface ArchiveItem {
  id: number;
  name: string;
  folder?: string;
}

export default function ArchiveDownloadButton({
  items,
  archiveName,
  label = 'Скачать всё',
  className = 'btn',
  title,
  iconOnly = false,
}: {
  items: ArchiveItem[];
  archiveName: string;
  label?: string;
  className?: string;
  title?: string;
  iconOnly?: boolean;
}) {
  const { toast } = useToast();
  const [progress, setProgress] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const busy = progress !== null;

  function cancel() {
    abortRef.current?.abort();
    abortRef.current = null;
    setProgress(null);
    setNote('');
  }

  async function run() {
    if (busy || items.length === 0) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setProgress(0);

    const zip = new ZipBuilder();
    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        setNote(`${i + 1} / ${items.length}`);

        const res = await fetch(`${API_URL}/download/chapters/${item.id}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Глава ${item.name}: ошибка ${res.status}`);

        const total = Number(res.headers.get('content-length') ?? 0);
        const reader = res.body?.getReader();
        let bytes: Uint8Array<ArrayBuffer>;

        if (reader) {
          const chunks: Uint8Array[] = [];
          let loaded = 0;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            loaded += value.length;
            if (total > 0) setProgress((i + loaded / total) / items.length);
          }
          bytes = new Uint8Array(loaded);
          let at = 0;
          for (const c of chunks) {
            bytes.set(c, at);
            at += c.length;
          }
        } else {
          bytes = new Uint8Array(await res.arrayBuffer());
        }

        const entry = item.folder
          ? `${safeEntryName(item.folder, 'Том')}/${safeEntryName(item.name, 'chapter')}`
          : safeEntryName(item.name, 'chapter');
        zip.add(entry, bytes);
        setProgress((i + 1) / items.length);
      }

      setNote('Собираем архив…');
      saveBlob(zip.build(), `${safeEntryName(archiveName, 'audiobook')}.zip`);
      toast('Архив готов');
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        toast(e instanceof Error ? e.message : 'Не удалось скачать архив', 'error');
      }
    } finally {
      abortRef.current = null;
      setProgress(null);
      setNote('');
    }
  }

  if (items.length === 0) return null;

  const pct = Math.round((progress ?? 0) * 100);

  return (
    <span className={styles.wrap}>
      <button
        type="button"
        className={className}
        onClick={() => void run()}
        disabled={busy}
        title={title ?? (iconOnly ? label : undefined)}
        aria-label={iconOnly ? label : undefined}
      >
        {iconOnly && busy ? (
          <span className={styles.pct}>{pct}%</span>
        ) : (
          <>
            <Download size={14} />
            {busy ? `${pct}%` : iconOnly ? null : label}
          </>
        )}
      </button>

      {busy ? (
        <>
          {iconOnly ? null : (
            <span className={styles.bar} aria-hidden="true">
              <span className={styles.fill} style={{ width: `${pct}%` }} />
            </span>
          )}
          <span className={styles.note}>{note}</span>
          <button
            type="button"
            className={styles.cancel}
            onClick={cancel}
            title="Отменить"
            aria-label="Отменить загрузку"
          >
            <X size={13} />
          </button>
        </>
      ) : null}
    </span>
  );
}
