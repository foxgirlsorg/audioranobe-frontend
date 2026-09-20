'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, DownloadCloud, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { errMsg, useToast } from '@/lib/toast';
import type { TitleCard } from '@/lib/types';
import { ModShell } from '../modnav';
import Modal from '@/components/Modal/Modal';
import Spinner from '@/components/Spinner/Spinner';
import styles from './page.module.css';

interface ExternalItem {
  ref: string;
  name: string;
  cover_url: string | null;
  year: number | null;
  status: string;
}

function Content() {
  const { toast } = useToast();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<TitleCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api<{ items: TitleCard[] }>('/titles', { params: { q: q.trim() || undefined, per_page: 30, sort: 'new' } })
      .then((d) => alive && setItems(d.items))
      .catch((e) => alive && toast(errMsg(e), 'error'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, nonce]);

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <label className={styles.searchBox}>
          <Search size={15} aria-hidden="true" />
          <input
            className={styles.searchInput}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по каталогу"
          />
        </label>
        <button type="button" className="btn btn-primary" onClick={() => setImportOpen(true)}>
          <DownloadCloud size={15} />
          {'Импортировать тайтл'}
        </button>
      </div>

      {loading ? (
        <div className={styles.center}>
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <p className={styles.empty}>{'Ничего не найдено.'}</p>
      ) : (
        <div className={styles.list}>
          {items.map((t) => (
            <Link key={t.id} href={`/title/${t.slug}`} className={styles.row}>
              {t.cover_thumb_url ? (
                <img src={t.cover_thumb_url} alt="" className={styles.cover} loading="lazy" />
              ) : (
                <span className={styles.cover} />
              )}
              <span className={styles.rowMain}>
                <span className={styles.rowName}>{t.name}</span>
                <span className={styles.rowMeta}>
                  {[t.year, t.chapters_count ? `${t.chapters_count} гл.` : null].filter(Boolean).join(' · ')}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          setImportOpen(false);
          setNonce((n) => n + 1);
        }}
      />
    </div>
  );
}

function ImportModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const { toast } = useToast();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<ExternalItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyRef, setBusyRef] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) {
      setQ('');
      setItems([]);
    }
  }, [open]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setItems([]);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(() => {
      api<{ items: ExternalItem[] }>('/admin/titles/import-search', { params: { q: q.trim() } })
        .then((d) => setItems(d.items))
        .catch((e) => toast(errMsg(e), 'error'))
        .finally(() => setSearching(false));
    }, 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const doImport = async (it: ExternalItem) => {
    setBusyRef(it.ref);
    try {
      const res = await api<{ name: string; already: boolean }>('/admin/titles/import', {
        method: 'POST',
        body: { ref: it.ref },
      });
      toast(res.already ? `«${res.name}» уже в каталоге` : `«${res.name}» импортирован`, 'ok');
      onImported();
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setBusyRef(null);
  };

  return (
    <Modal open={open} onClose={onClose} title="Импорт тайтла">
      <label className={styles.searchBox}>
        <Search size={15} aria-hidden="true" />
        <input
          className={styles.searchInput}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Название тайтла в источнике"
          autoFocus
        />
      </label>
      <p className={styles.modalHint}>{'Импортируются только метаданные — без озвучки и глав.'}</p>

      <div className={styles.results}>
        {searching ? (
          <div className={styles.center}>
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <p className={styles.empty}>{q.trim().length < 2 ? 'Введите запрос.' : 'Ничего не найдено.'}</p>
        ) : (
          items.map((it) => (
            <div key={it.ref} className={styles.resultRow}>
              {it.cover_url ? (
                <img src={it.cover_url} alt="" className={styles.cover} loading="lazy" />
              ) : (
                <span className={styles.cover} />
              )}
              <span className={styles.rowMain}>
                <span className={styles.rowName}>{it.name}</span>
                <span className={styles.rowMeta}>{[it.year, it.status].filter(Boolean).join(' · ')}</span>
              </span>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busyRef !== null}
                onClick={() => void doImport(it)}
              >
                {busyRef === it.ref ? <Loader2 size={15} className={styles.spin} /> : <DownloadCloud size={15} />}
                {'Импорт'}
              </button>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}

export default function ModTitlesPage() {
  return (
    <ModShell title="Тайтлы" perm="titles.import">
      <Content />
    </ModShell>
  );
}
