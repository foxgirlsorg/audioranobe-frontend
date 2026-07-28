'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Library, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import type { CollectionCard, CollectionFull, Paginated } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { errMsg, useToast } from '@/lib/toast';
import CardGrid from '@/components/CardGrid';
import CollectionCardC from '@/components/CollectionCardC';
import Pagination from '@/components/Pagination';
import Tabs from '@/components/Tabs';
import Modal from '@/components/Modal';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';
import styles from './page.module.css';

export default function CollectionsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'popular' | 'new'>('popular');
  const [page, setPage] = useState(1);

  const [data, setData] = useState<Paginated<CollectionCard> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  // create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [creating, setCreating] = useState(false);

  // debounce the search box
  useEffect(() => {
    const t = window.setTimeout(() => {
      const trimmed = qInput.trim();
      if (trimmed !== q) {
        setQ(trimmed);
        setPage(1);
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [qInput, q]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    api<Paginated<CollectionCard>>('/collections', { params: { q, sort, page } })
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (alive) setError(errMsg(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [q, sort, page, nonce]);

  const openCreate = () => {
    setName('');
    setDescription('');
    setIsPublic(true);
    setCreateOpen(true);
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 100) {
      toast('Название коллекции — от 1 до 100 символов', 'error');
      return;
    }
    if (creating) return;
    setCreating(true);
    try {
      const created = await api<CollectionFull>('/collections', {
        method: 'POST',
        body: { name: trimmed, description: description.trim(), is_public: isPublic },
      });
      toast('Коллекция создана');
      router.push(`/collections/${created.id}`);
    } catch (err) {
      toast(errMsg(err), 'error');
      setCreating(false);
    }
  };

  const onPage = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div>
      <header className={styles.pageHead}>
        <div className="eyebrow">Собрано слушателями</div>
        <h1 className={styles.pageTitle}>
          Коллекции <span>сообщества</span>
        </h1>
      </header>

      <div className={styles.toolbar}>
        <input
          type="search"
          className={`input ${styles.search}`}
          placeholder="Поиск коллекций…"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          aria-label="Поиск коллекций"
        />
        <Tabs
          tabs={[
            { key: 'popular', label: 'Популярное' },
            { key: 'new', label: 'Новые' },
          ]}
          active={sort}
          onChange={(key) => {
            setSort(key as 'popular' | 'new');
            setPage(1);
          }}
        />
        <div className={styles.spacer} />
        {user ? (
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Plus />
            Новая коллекция
          </button>
        ) : null}
      </div>

      {loading && !data ? (
        <div className={styles.center}>
          <Spinner size={34} />
        </div>
      ) : error ? (
        <div className={styles.center}>
          <EmptyState icon={AlertTriangle} title="Не удалось загрузить коллекции" body={error} />
          <button type="button" className="btn" onClick={() => setNonce((n) => n + 1)}>
            Попробовать ещё раз
          </button>
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={Library}
          title="Коллекции не найдены"
          body={
            q
              ? 'По этому запросу ничего не нашлось.'
              : user
                ? 'Станьте первым — соберите коллекцию из любимых тайтлов.'
                : 'Войдите, чтобы создать первую коллекцию.'
          }
        />
      ) : (
        <>
          <div className={loading ? `${styles.gridWrap} ${styles.gridLoading}` : styles.gridWrap}>
            <CardGrid>
              {data.items.map((c) => (
                <CollectionCardC key={c.id} collection={c} />
              ))}
            </CardGrid>
          </div>
          <div className={styles.pagerWrap}>
            <Pagination page={data.page} total={data.total} perPage={data.per_page} onPage={onPage} />
          </div>
        </>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Новая коллекция">
        <form className={styles.form} onSubmit={submitCreate}>
          <div className={styles.field}>
            <label className={styles.fLabel} htmlFor="col-name">
              Название
            </label>
            <input
              id="col-name"
              type="text"
              className="input"
              maxLength={100}
              required
              autoFocus
              placeholder="Например: Уютная осенняя подборка"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fLabel} htmlFor="col-desc">
              Описание
            </label>
            <textarea
              id="col-desc"
              className="textarea"
              rows={4}
              maxLength={2000}
              placeholder="Что объединяет эти тайтлы? (необязательно)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            <span>
              <span className={styles.checkTitle}>Публичная коллекция</span>
              <span className={styles.checkHint}>Любой сможет найти её и поставить лайк</span>
            </span>
          </label>
          <div className={styles.formActions}>
            <button type="button" className="btn btn-ghost" onClick={() => setCreateOpen(false)}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={creating || !name.trim()}>
              {creating ? 'Создаём…' : 'Создать'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
