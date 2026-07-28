'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookPlus, Mic2, PenLine } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errMsg, useToast } from '@/lib/toast';
import {
  RELEASE_STATUS_LABELS,
  STATUS_VALUES,
  type Author,
  type NarratorCard,
  type NarratorFull,
  type Paginated,
  type ReleaseStatus,
  type TitleFull,
} from '@/lib/types';
import Modal from '@/components/Modal';
import SocialsEditor from '@/components/SocialsEditor';
import GenrePicker from '@/components/GenrePicker';
import AuthorPicker from '@/components/AuthorPicker';
import styles from './AddContentDialog.module.css';

type Kind = 'menu' | 'title' | 'narrator' | 'author';

/**
 * "Add" entry point that replaces the old narrator panel: pick what to create,
 * then fill it in without leaving the dialog. Books can create their author
 * inline, so a missing author never blocks the flow.
 */
export default function AddContentDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<Kind>('menu');

  useEffect(() => {
    if (open) setKind('menu');
  }, [open]);

  const titles: Record<Kind, string> = {
    menu: 'Что добавить?',
    title: 'Новая книга',
    narrator: 'Новый чтец',
    author: 'Новый автор',
  };

  return (
    <Modal open={open} onClose={onClose} title={titles[kind]}>
      {kind === 'menu' ? (
        <div className={styles.menu}>
          <button type="button" className={styles.choice} onClick={() => setKind('title')}>
            <BookPlus size={20} />
            <span className={styles.choiceBody}>
              <span className={styles.choiceName}>{'Книга'}</span>
              <span className={styles.choiceHint}>
                {'Новый тайтл, привязанный к одному из ваших чтецов'}
              </span>
            </span>
          </button>
          <button type="button" className={styles.choice} onClick={() => setKind('narrator')}>
            <Mic2 size={20} />
            <span className={styles.choiceBody}>
              <span className={styles.choiceName}>{'Чтец'}</span>
              <span className={styles.choiceHint}>{'Профиль озвучки с описанием и контактами'}</span>
            </span>
          </button>
          <button type="button" className={styles.choice} onClick={() => setKind('author')}>
            <PenLine size={20} />
            <span className={styles.choiceBody}>
              <span className={styles.choiceName}>{'Автор'}</span>
              <span className={styles.choiceHint}>{'Автор оригинального произведения'}</span>
            </span>
          </button>
        </div>
      ) : kind === 'title' ? (
        <TitleForm onDone={onClose} onBack={() => setKind('menu')} />
      ) : kind === 'narrator' ? (
        <NarratorForm onDone={onClose} onBack={() => setKind('menu')} />
      ) : (
        <AuthorForm onDone={onClose} onBack={() => setKind('menu')} />
      )}
    </Modal>
  );
}

function BackRow({ onBack, busy, submitLabel }: { onBack: () => void; busy: boolean; submitLabel: string }) {
  return (
    <div className={styles.foot}>
      <button type="button" className="btn btn-ghost" onClick={onBack} disabled={busy}>
        {'Назад'}
      </button>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'Создаём…' : submitLabel}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------

function TitleForm({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const router = useRouter();
  const { toast } = useToast();

  const [narrators, setNarrators] = useState<NarratorCard[]>([]);
  const [narratorIds, setNarratorIds] = useState<number[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [author, setAuthor] = useState<Author | null>(null);
  const [description, setDescription] = useState('');
  const [year, setYear] = useState('');
  const [status, setStatus] = useState<ReleaseStatus>('ongoing');
  const [genreIds, setGenreIds] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<NarratorCard[]>('/panel/narrators')
      .then((list) => {
        const arr = Array.isArray(list) ? list : [];
        setNarrators(arr);
        if (arr.length > 0) setNarratorIds([arr[0].id]);
      })
      .catch((e) => setError(errMsg(e)));
  }, []);

  const toggleNarrator = (id: number) =>
    setNarratorIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Укажите название');
      return;
    }
    if (narratorIds.length === 0) {
      setError('Выберите хотя бы одного чтеца');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const res = await api<{ title: TitleFull; applied: boolean }>('/panel/titles', {
        method: 'POST',
        body: {
          narrator_ids: narratorIds,
          name: name.trim(),
          ...(slug.trim() ? { slug: slug.trim() } : {}),
          author_id: author?.id ?? null,
          description,
          year: year.trim() ? Number(year.trim()) : null,
          release_status: status,
          genre_ids: genreIds,
        },
      });
      toast(res.applied ? 'Книга создана' : 'Книга отправлена на модерацию');
      onDone();
      // Straight into the content tab — a fresh title needs volumes/chapters next.
      router.push(`/title/${res.title.slug}/edit?tab=content`);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  if (narrators.length === 0) {
    return (
      <div className={styles.empty}>
        <p>
          {'Сначала создайте чтеца — книга всегда привязана к профилю озвучки.'}
        </p>
        <div className={styles.foot}>
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            {'Назад'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.field}>
        <span className={styles.label}>{'Чтецы'}</span>
        <div className={styles.pillRow}>
          {narrators.map((n) => (
            <button
              key={n.id}
              type="button"
              className={narratorIds.includes(n.id) ? 'pill pill-active' : 'pill'}
              onClick={() => toggleNarrator(n.id)}
              aria-pressed={narratorIds.includes(n.id)}
            >
              {n.name}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="add-title-name">
          {'Название'}
        </label>
        <input
          id="add-title-name"
          className="input"
          value={name}
          maxLength={300}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="add-title-slug">
          {'Slug'} <span className={styles.optional}>{'необязательно'}</span>
        </label>
        <input
          id="add-title-slug"
          className="input"
          value={slug}
          maxLength={200}
          placeholder="my-book-slug"
          onChange={(e) => setSlug(e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <span className={styles.label}>{'Автор'}</span>
        <AuthorPicker value={author} onChange={setAuthor} />
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="add-title-year">
            {'Год'}
          </label>
          <input
            id="add-title-year"
            className="input"
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="add-title-status">
            {'Статус тайтла'}
          </label>
          <select
            id="add-title-status"
            className="select"
            value={status}
            onChange={(e) => setStatus(e.target.value as ReleaseStatus)}
          >
            {STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {RELEASE_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>{'Жанры'}</span>
        <GenrePicker value={genreIds} onChange={setGenreIds} />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="add-title-desc">
          {'Описание'}
        </label>
        <textarea
          id="add-title-desc"
          className="textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <BackRow onBack={onBack} busy={busy} submitLabel="Создать книгу" />
    </form>
  );
}

// ---------------------------------------------------------------------------

function NarratorForm({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [bio, setBio] = useState('');
  const [socials, setSocials] = useState<string[]>([]);
  const [isSelf, setIsSelf] = useState(false);
  const [adminContact, setAdminContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Укажите название');
      return;
    }
    if (!bio.trim()) {
      setError('Добавьте описание — оно видно слушателям');
      return;
    }
    const links = socials.map((s) => s.trim()).filter(Boolean);
    // Social links are optional decoration; a contact is only needed when the
    // profile represents the user themselves.
    if (isSelf && !adminContact.trim()) {
      setError('Укажите контакт для администрации — он нужен для своего профиля');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const created = await api<NarratorFull>('/narrators', {
        method: 'POST',
        body: {
          name: name.trim(),
          ...(slug.trim() ? { slug: slug.trim() } : {}),
          bio: bio.trim(),
          socials: links,
          is_self: isSelf,
          admin_contact: isSelf ? adminContact.trim() : '',
        },
      });
      toast(
        created.mod_status === 'approved' ? 'Чтец создан' : 'Чтец отправлен на модерацию'
      );
      onDone();
      router.push(`/narrator/${created.slug}/edit`);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="add-narr-name">
          {'Название'}
        </label>
        <input
          id="add-narr-name"
          className="input"
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="add-narr-slug">
          {'Slug'} <span className={styles.optional}>{'необязательно'}</span>
        </label>
        <input
          id="add-narr-slug"
          className="input"
          value={slug}
          maxLength={200}
          placeholder="my-narrator-slug"
          onChange={(e) => setSlug(e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="add-narr-bio">
          {'Описание'}
        </label>
        <textarea
          id="add-narr-bio"
          className="textarea"
          value={bio}
          maxLength={10000}
          placeholder="Расскажите слушателям об этом чтеце…"
          onChange={(e) => setBio(e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <span className={styles.label}>
          {'Соцсети'} <span className={styles.optional}>{'необязательно'}</span>
        </span>
        <SocialsEditor value={socials} onChange={setSocials} />
      </div>

      <div className={styles.field}>
        <label className={styles.checkLabel}>
          <input type="checkbox" checked={isSelf} onChange={(e) => setIsSelf(e.target.checked)} />
          <span>{'Это мой собственный профиль'}</span>
        </label>
      </div>

      {isSelf ? (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="add-narr-contact">
            {'Контакт для администрации'}
          </label>
          <textarea
            id="add-narr-contact"
            className="textarea"
            value={adminContact}
            maxLength={2000}
            placeholder="Telegram, почта — как с вами связаться…"
            onChange={(e) => setAdminContact(e.target.value)}
          />
          <p className={styles.hint}>
            {'Виден только модераторам и администраторам, не публикуется.'}
          </p>
        </div>
      ) : null}

      <BackRow onBack={onBack} busy={busy} submitLabel="Создать чтеца" />
    </form>
  );
}

// ---------------------------------------------------------------------------

function AuthorForm({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [links, setLinks] = useState<string[]>(['']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Укажите имя автора');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const created = await api<{ id: number; slug: string; name: string }>('/authors', {
        method: 'POST',
        body: { name: name.trim() },
      });
      const cleanLinks = links.map((l) => l.trim()).filter(Boolean);
      if (bio.trim() || cleanLinks.length > 0) {
        await api(`/authors/${created.id}`, {
          method: 'PATCH',
          body: { bio: bio.trim(), links: cleanLinks },
        });
      }
      toast('Автор создан');
      onDone();
      router.push(`/author/${created.id}`);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="add-author-name">
          {'Имя автора'}
        </label>
        <input
          id="add-author-name"
          className="input"
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="add-author-bio">
          {'Описание'} <span className={styles.optional}>{'необязательно'}</span>
        </label>
        <textarea
          id="add-author-bio"
          className="textarea"
          value={bio}
          maxLength={10000}
          onChange={(e) => setBio(e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <span className={styles.label}>{'Ссылки'}</span>
        <SocialsEditor value={links} onChange={setLinks} />
      </div>

      <BackRow onBack={onBack} busy={busy} submitLabel="Создать автора" />
    </form>
  );
}
