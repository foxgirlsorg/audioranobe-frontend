'use client';

import React, { useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import { API_URL } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { ZipBuilder, safeEntryName, saveBlob } from '@/lib/zip';
import styles from './ArchiveDownloadButton.module.css';

export interface ArchiveItem {
  /** Chapter id — the file comes from /download/chapters/{id}. */
  id: number;
  /** File name inside the archive, without a folder. */
  name: string;
  /** Optional folder, used to split a multi-volume title. */
  folder?: string;
}

/**
 * Downloads several chapters and zips them in the browser.
 *
 * The server only ever serves one file per request, so the archive is assembled
 * here — which is also what makes a real progress bar possible: we know how many
 * files there are and how far the current one has got.
 */
export default function ArchiveDownloadButton({
  items,
  archiveName,
  label = 'Скачать всё',
  className = 'btn',
  title,
}: {
  items: ArchiveItem[];
  /** Base name for the .zip (extension added here). */
  archiveName: string;
  label?: string;
  className?: string;
  title?: string;
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

        // Stream so the bar moves within a file, not just between files.
        const total = Number(res.headers.get('content-length') ?? 0);
        const reader = res.body?.getReader();
        // Explicitly ArrayBuffer-backed: that is what the zip builder (and the
        // Blob constructor behind it) accepts.
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
      // An abort is the user's own doing — no need to shout about it.
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

  return (
    <span className={styles.wrap}>
      <button
        type="button"
        className={className}
        onClick={() => void run()}
        disabled={busy}
        title={title}
      >
        <Download size={14} />
        {busy ? `${Math.round((progress ?? 0) * 100)}%` : label}
      </button>

      {busy ? (
        <>
          <span className={styles.bar} aria-hidden="true">
            <span
              className={styles.fill}
              style={{ width: `${Math.round((progress ?? 0) * 100)}%` }}
            />
          </span>
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
