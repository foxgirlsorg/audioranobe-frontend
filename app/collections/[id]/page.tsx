'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  Globe,
  Heart,
  Library,
  Lock,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { CollectionFull, SearchSuggest } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { errMsg, useToast } from '@/lib/toast';
import { formatDate } from '@/lib/format';
import { usePageTitle } from '@/lib/usePageTitle';
import TitleCardC from '@/components/TitleCardC/TitleCardC';
import UserAvatar from '@/components/UserAvatar/UserAvatar';
import Modal from '@/components/Modal/Modal';
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import styles from './page.module.css';

export default function CollectionDetailPage() {
  const params = useParams<{ id: string }>();
  const rawId = Array.isArray(params?.id) ? params?.id[0] : params?.id;
  const id = rawId && /^\d+$/.test(rawId) ? rawId : null;

  const router = useRouter();
  const { user, isMod } = useAuth();
  const { toast } = useToast();

  const [col, setCol] = useState<CollectionFull | null>(null);
  usePageTitle(col?.name);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [nonce, setNonce] = useState(0);

  const [likeBusy, setLikeBusy] = useState(false);
  const [visBusy, setVisBusy] = useState(false);
  const [moveBusy, setMoveBusy] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addQuery, setAddQuery] = useState('');
  const [addResults, setAddResults] = useState<SearchSuggest['titles']>([]);
  const [addSearching, setAddSearching] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const searchSeq = useRef(0);

  const [noteFor, setNoteFor] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    setNotFound(false);
    api<CollectionFull>(`/collections/${id}`)
      .then((d) => {
        if (alive) setCol(d);
      })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        else setError(errMsg(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id, nonce]);

  useEffect(() => {
    if (!addOpen) return;
    const q = addQuery.trim();
    if (q.length < 2) {
      setAddResults([]);
      setAddSearching(false);
      return;
    }
    const seq = ++searchSeq.current;
    const timer = window.setTimeout(() => {
      setAddSearching(true);
      api<SearchSuggest>('/search/suggest', { params: { q } })
        .then((r) => {
          if (searchSeq.current === seq) setAddResults(r.titles);
        })
        .catch(() => {
          if (searchSeq.current === seq) setAddResults([]);
        })
        .finally(() => {
          if (searchSeq.current === seq) setAddSearching(false);
        });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [addQuery, addOpen]);

  const isOwner = !!(user && col && user.id === col.user.id);
  const canEditMeta = isOwner || isMod;

  const toggleLike = async () => {
    if (!col || likeBusy) return;
    if (!user) {
      toast('Войдите, чтобы лайкать коллекции', 'error');
      return;
    }
    setLikeBusy(true);
    try {
      const res = await api<{ my_like: boolean; likes_count: number }>(
        `/collections/${col.id}/like`,
        { method: col.my_like ? 'DELETE' : 'PUT' }
      );
      setCol((prev) =>
        prev ? { ...prev, my_like: res.my_like, likes_count: res.likes_count } : prev
      );
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setLikeBusy(false);
    }
  };

  const openEdit = () => {
    if (!col) return;
    setEditName(col.name);
    setEditDesc(col.description);
    setEditOpen(true);
  };

  const saveMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!col || saving) return;
    const trimmed = editName.trim();
    if (trimmed.length < 1 || trimmed.length > 100) {
      toast('Название коллекции — от 1 до 100 символов', 'error');
      return;
    }
    setSaving(true);
    try {
      const fresh = await api<CollectionFull>(`/collections/${col.id}`, {
        method: 'PATCH',
        body: { name: trimmed, description: editDesc.trim() },
      });
      setCol(fresh);
      setEditOpen(false);
      toast('Коллекция обновлена');
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleVisibility = async () => {
    if (!col || visBusy) return;
    setVisBusy(true);
    try {
      const fresh = await api<CollectionFull>(`/collections/${col.id}`, {
        method: 'PATCH',
        body: { is_public: !col.is_public },
      });
      setCol(fresh);
      toast(fresh.is_public ? 'Коллекция теперь публичная' : 'Коллекция теперь приватная');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setVisBusy(false);
    }
  };

  const doDelete = async () => {
    if (!col) return;
    try {
      await api<{ ok: boolean }>(`/collections/${col.id}`, { method: 'DELETE' });
      toast('Коллекция удалена');
      router.push('/collections');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  const addTitle = async (titleId: number) => {
    if (!col || addingId !== null) return;
    setAddingId(titleId);
    try {
      const fresh = await api<CollectionFull>(`/collections/${col.id}/items/${titleId}`, {
        method: 'PUT',
        body: {},
      });
      setCol(fresh);
      toast('Добавлено в коллекцию');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setAddingId(null);
    }
  };

  const removeItem = async (titleId: number) => {
    if (!col) return;
    try {
      const fresh = await api<CollectionFull>(`/collections/${col.id}/items/${titleId}`, {
        method: 'DELETE',
      });
      setCol(fresh);
      if (noteFor === titleId) setNoteFor(null);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  const startNote = (titleId: number, current: string) => {
    setNoteFor(titleId);
    setNoteDraft(current);
  };

  const saveNote = async () => {
    if (!col || noteFor === null || noteSaving) return;
    setNoteSaving(true);
    try {
      const fresh = await api<CollectionFull>(`/collections/${col.id}/items/${noteFor}`, {
        method: 'PUT',
        body: { note: noteDraft.trim() },
      });
      setCol(fresh);
      setNoteFor(null);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setNoteSaving(false);
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    if (!col || moveBusy) return;
    const j = index + dir;
    if (j < 0 || j >= col.items.length) return;
    const a = col.items[index];
    const b = col.items[j];
    setMoveBusy(true);
    try {
      if (a.position === b.position) {
        const fresh = await api<CollectionFull>(
          `/collections/${col.id}/items/${a.title.id}`,
          { method: 'PUT', body: { position: b.position + dir } }
        );
        setCol(fresh);
      } else {
        await api<CollectionFull>(`/collections/${col.id}/items/${a.title.id}`, {
          method: 'PUT',
          body: { position: b.position },
        });
        const fresh = await api<CollectionFull>(
          `/collections/${col.id}/items/${b.title.id}`,
          { method: 'PUT', body: { position: a.position } }
        );
        setCol(fresh);
      }
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setMoveBusy(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.center}>
        <Spinner size={34} />
      </div>
    );
  }

  if (notFound || error || !col) {
    return (
      <div className={styles.center}>
        <EmptyState
          icon={Library}
          title={notFound ? 'Коллекция не найдена' : 'Не удалось загрузить эту коллекцию'}
          body={notFound ? 'Возможно, она приватная или удалена.' : error ?? undefined}
        />
        {!notFound ? (
          <button type="button" className="btn" onClick={() => setNonce((n) => n + 1)}>
            {'Попробовать ещё раз'}
          </button>
        ) : null}
        <Link href="/collections" className="btn btn-ghost">
          {'Назад к коллекциям'}
        </Link>
      </div>
    );
  }

  const inCollection = new Set(col.items.map((i) => i.title.id));

  return (
    <div>
      <header className={`glass-panel ${styles.head}`}>
        <div className={styles.headMain}>
          <div className="eyebrow">{'Коллекция'}</div>
          <h1 className={styles.name}>{col.name}</h1>
          {col.description ? <p className={styles.desc}>{col.description}</p> : null}
          <div className={styles.metaRow}>
            <span className={styles.owner}>
              <UserAvatar user={col.user} size={22} />
              <Link
                href={`/user/${col.user.id}`}
                className={styles.ownerName}
              >
                {col.user.display_name || col.user.username}
              </Link>
            </span>
            <span className={styles.metaDot} aria-hidden="true">
              ·
            </span>
            <span>
              {col.items_count === 1
                ? `Тайтлов: ${col.items_count}`
                : `Тайтлов: ${col.items_count}`}
            </span>
            <span className={styles.metaDot} aria-hidden="true">
              ·
            </span>
            <span>{`Обновлено ${formatDate(col.updated_at)}`}</span>
            {!col.is_public ? (
              <span className="badge">
                <Lock size={10} />
                {'Приватная'}
              </span>
            ) : null}
          </div>
        </div>

        <div className={styles.headActions}>
          <button
            type="button"
            className={col.my_like ? `${styles.likeBtn} ${styles.liked}` : styles.likeBtn}
            onClick={toggleLike}
            disabled={likeBusy}
            aria-pressed={col.my_like}
            title={col.my_like ? 'Убрать лайк' : 'Лайкнуть коллекцию'}
          >
            <Heart size={14} className={styles.heartIcon} />
            {col.likes_count}
          </button>
          {isOwner ? (
            <button type="button" className="btn btn-primary" onClick={() => setAddOpen(true)}>
              <Plus />
              {'Добавить тайтлы'}
            </button>
          ) : null}
          {canEditMeta ? (
            <>
              <button type="button" className="btn" onClick={openEdit}>
                <Pencil />
                {'Изменить'}
              </button>
              <button
                type="button"
                className="btn"
                onClick={toggleVisibility}
                disabled={visBusy}
                title={col.is_public ? 'Сделать приватной' : 'Сделать публичной'}
              >
                {col.is_public ? <Globe /> : <Lock />}
                {col.is_public ? 'Публичная' : 'Приватная'}
              </button>
              <button type="button" className="btn btn-danger" onClick={() => setDeleteOpen(true)}>
                <Trash2 />
                {'Удалить'}
              </button>
            </>
          ) : null}
        </div>
      </header>

      {col.items.length === 0 ? (
        <EmptyState
          icon={Library}
          title={'Пока нет тайтлов'}
          body={
            isOwner
              ? 'Нажмите «Добавить тайтлы», чтобы начать собирать коллекцию.'
              : 'Владелец пока не добавил ни одного тайтла.'
          }
        />
      ) : (
        <div className={styles.items}>
          {col.items.map((item, index) => (
            <div key={item.title.id} className={styles.item}>
              <TitleCardC title={item.title} />
              {noteFor === item.title.id ? (
                <div className={styles.noteEditor}>
                  <textarea
                    className="textarea"
                    rows={3}
                    maxLength={1000}
                    autoFocus
                    placeholder={'Короткая заметка об этом тайтле…'}
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                  />
                  <div className={styles.noteBtns}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={saveNote}
                      disabled={noteSaving}
                    >
                      {noteSaving ? 'Сохраняем…' : 'Сохранить'}
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => setNoteFor(null)}>
                      {'Отмена'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {item.note ? <div className={styles.note}>{item.note}</div> : null}
                  {isOwner ? (
                    <div className={styles.itemTools}>
                      <button
                        type="button"
                        className={styles.tool}
                        title={'Переместить вверх'}
                        aria-label={'Переместить вверх'}
                        disabled={index === 0 || moveBusy}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        className={styles.tool}
                        title={'Переместить вниз'}
                        aria-label={'Переместить вниз'}
                        disabled={index === col.items.length - 1 || moveBusy}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        className={styles.tool}
                        title={item.note ? 'Изменить заметку' : 'Добавить заметку'}
                        aria-label={item.note ? 'Изменить заметку' : 'Добавить заметку'}
                        onClick={() => startNote(item.title.id, item.note)}
                      >
                        <StickyNote size={14} />
                      </button>
                      <button
                        type="button"
                        className={`${styles.tool} ${styles.toolDanger}`}
                        title={'Убрать из коллекции'}
                        aria-label={'Убрать из коллекции'}
                        onClick={() => removeItem(item.title.id)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={'Изменить коллекцию'}>
        <form className={styles.form} onSubmit={saveMeta}>
          <div className={styles.field}>
            <label className={styles.fLabel} htmlFor="edit-name">
              {'Название'}
            </label>
            <input
              id="edit-name"
              type="text"
              className="input"
              maxLength={100}
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fLabel} htmlFor="edit-desc">
              {'Описание'}
            </label>
            <textarea
              id="edit-desc"
              className="textarea"
              rows={4}
              maxLength={2000}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
            />
          </div>
          <div className={styles.formActions}>
            <button type="button" className="btn btn-ghost" onClick={() => setEditOpen(false)}>
              {'Отмена'}
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !editName.trim()}>
              {saving ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={'Добавить тайтлы'}>
        <div className={styles.addBox}>
          <input
            type="search"
            className="input"
            autoFocus
            placeholder={'Поиск тайтлов… (минимум 2 символа)'}
            value={addQuery}
            onChange={(e) => setAddQuery(e.target.value)}
            aria-label={'Поиск тайтлов для добавления'}
          />
          <div className={styles.addResults}>
            {addSearching ? (
              <div className={styles.addStatus}>
                <Spinner size={20} inline />
              </div>
            ) : addQuery.trim().length < 2 ? (
              <div className={styles.addStatus}>{'Введите хотя бы 2 символа для поиска.'}</div>
            ) : addResults.length === 0 ? (
              <div className={styles.addStatus}>{'Ничего не найдено.'}</div>
            ) : (
              addResults.map((st) => {
                const already = inCollection.has(st.id);
                return (
                  <div key={st.id} className={styles.addRow}>
                    <span className={styles.addCover}>
                      {st.cover_url ? (
                        <img src={st.cover_url} alt="" loading="lazy" />
                      ) : (
                        <Library size={14} />
                      )}
                    </span>
                    <span className={styles.addInfo}>
                      <span className={styles.addName}>{st.name}</span>
                      {st.author ? <span className={styles.addAuthor}>{st.author.name}</span> : null}
                    </span>
                    {already ? (
                      <span className={styles.addedTag}>{'Добавлено'}</span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={addingId !== null}
                        onClick={() => addTitle(st.id)}
                      >
                        {addingId === st.id ? 'Добавляем…' : 'Добавить'}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={doDelete}
        title={'Удалить коллекцию?'}
        body={`Коллекция «${col.name}» будет удалена навсегда. Это действие нельзя отменить.`}
        danger
      />
    </div>
  );
}
