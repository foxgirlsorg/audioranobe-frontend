'use client';

import { useEffect, useState } from 'react';
import { Feather, Search, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errMsg, useToast } from '@/lib/toast';
import type { Author, Paginated } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import Pagination from '@/components/Pagination/Pagination';
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog';
import { ModShell, ErrorPanel, splitHeading } from '@/app/mod/modnav';
import styles from './page.module.css';

function toSlug(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '');
}

function AuthorsContent() {
  const { toast } = useToast();

  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<Author> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const [toDelete, setToDelete] = useState<Author | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(q.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api<Paginated<Author>>('/authors', { params: { q: query, page, per_page: 50 } })
      .then((d) => {
        if (alive) {
          setData(d);
          setError('');
        }
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
  }, [query, page, reload]);

  const createAuthor = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await api('/authors', {
        method: 'POST',
        body: { name, slug: toSlug(name) },
      });
      toast('Автор создан');
      setNewName('');
      setReload((n) => n + 1);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setCreating(false);
  };

  const deleteAuthor = async (a: Author) => {
    setBusyId(a.id);
    try {
      await api(`/mod/authors/${a.id}`, { method: 'DELETE' });
      toast('Автор удалён');
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.filter((x) => x.id !== a.id),
              total: Math.max(0, prev.total - 1),
            }
          : prev
      );
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setBusyId(null);
  };

  return (
    <div>
      <div className={`glass-panel ${styles.createForm}`}>
        <h3 className={styles.formTitle}>{'Новый автор'}</h3>
        <div className={styles.formRow}>
          <input
            className={`input ${styles.nameInput}`}
            type="text"
            placeholder={'Имя автора'}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') createAuthor();
            }}
          />
          {newName.trim() ? (
            <span className={styles.slugPreview}>
              {' slug: '}{toSlug(newName)}
            </span>
          ) : null}
          <button
            type="button"
            className="btn btn-primary"
            disabled={creating || !newName.trim()}
            onClick={createAuthor}
          >
            {'Создать'}
          </button>
        </div>
      </div>

      <div className={styles.searchRow}>
        <Search size={16} className={styles.searchIcon} aria-hidden="true" />
        <input
          className={`input ${styles.searchInput}`}
          type="search"
          placeholder={'Поиск по имени…'}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label={'Поиск авторов'}
        />
      </div>

      {error ? (
        <ErrorPanel message={error} onRetry={() => setReload((n) => n + 1)} />
      ) : loading || !data ? (
        <div className={styles.loading}>
          <Spinner />
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={Feather}
          title={'Авторов пока нет'}
          body={'Создайте первого автора выше.'}
        />
      ) : (
        <>
          <div className={`glass-panel ${styles.tableWrap}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{'Имя'}</th>
                  <th>{'Slug'}</th>
                  <th>{'Тайтлов'}</th>
                  <th aria-label={'Действия'} />
                </tr>
              </thead>
              <tbody>
                {data.items.map((a) => {
                  const busy = busyId === a.id;
                  return (
                    <tr key={a.id}>
                      <td className={styles.authorName}>{a.name}</td>
                      <td className={styles.slug}>{a.slug}</td>
                      <td className={styles.count}>{a.titles_count}</td>
                      <td>
                        <button
                          type="button"
                          className={`btn btn-ghost ${styles.smallBtn}`}
                          disabled={busy}
                          onClick={() => setToDelete(a)}
                          title={'Удалить'}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={data.page}
            total={data.total}
            perPage={data.per_page}
            onPage={setPage}
          />
        </>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) void deleteAuthor(toDelete);
        }}
        title={'Удалить автора'}
        body={
          toDelete
            ? `Удалить автора «${toDelete.name}»? Тайтлы с этим автором не будут удалены.`
            : ''
        }
        danger
      />
    </div>
  );
}

export default function ModAuthorsPage() {
  const h = splitHeading('Управление авторами');
  return (
    <ModShell title={h.title} accent={h.accent} adminOnly>
      <AuthorsContent />
    </ModShell>
  );
}
