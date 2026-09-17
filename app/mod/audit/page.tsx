'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  Ban,
  BookMarked,
  FilePenLine,
  Image as ImageIcon,
  MessageSquare,
  MessageSquareX,
  Radio,
  ScrollText,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  User as UserIcon,
  UserCog,
  UserX,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { errMsg } from '@/lib/toast';
import type { AuditEntry, Paginated } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import Pagination from '@/components/Pagination/Pagination';
import { ModShell, ErrorPanel, splitHeading } from '@/app/mod/modnav';
import styles from './page.module.css';

const LABELS: Record<string, string> = {
  'comment.edit': 'Содержимое комментария изменено',
  'comment.delete': 'Комментарий удалён',
  'comment.purge': 'Комментарий стёрт навсегда',
  'user.ban': 'Пользователь ограничен',
  'user.unban': 'Ограничение снято',
  'user.role': 'Роль пользователя изменена',
  'user.edit': 'Профиль изменён',
  'user.delete': 'Пользователь удалён',
  'user.image': 'Изображение профиля изменено',
  'user.email_change': 'Email изменён',
  'user.password_reset': 'Сброшен пароль',
  'user.totp_reset': 'Сброшена 2FA',
  'user.skip_moderation': 'Право пропуска модерации изменено',
  'title.edit': 'Тайтл изменён',
  'title.delete': 'Тайтл удалён',
  'title.hide': 'Тайтл скрыт',
  'title.unhide': 'Тайтл показан',
  'title.review_check': 'Проверка тайтла',
  'chapter.create': 'Глава создана',
  'chapter.edit': 'Глава изменена',
  'chapter.delete': 'Глава удалена',
  'chapter.purge': 'Глава стёрта навсегда',
  'chapter.audio': 'Загружено аудио главы',
  'chapter.bulk_edit': 'Массовое изменение глав',
  'chapter.bulk_upload': 'Массовая загрузка глав',
  'volume.edit': 'Том изменён',
  'volume.delete': 'Том удалён',
  'volume.cover': 'Обложка тома заменена',
  'volume.cover_delete': 'Обложка тома удалена',
  'version.create': 'Альт-озвучка создана',
  'version.edit': 'Альт-озвучка изменена',
  'version.delete': 'Альт-озвучка удалена',
  'version.rename_main': 'Название основной озвучки изменено',
  'title.cover': 'Обложка тайтла заменена',
  'title.bg': 'Фон тайтла заменён',
  'narrator.avatar': 'Аватар чтеца заменён',
  'narrator.cover': 'Обложка чтеца заменена',
  'node.create': 'Нода авторизована',
  'node.enable': 'Нода включена',
  'node.disable': 'Нода отключена',
  'node.delete': 'Нода удалена',
  'post.edit': 'Пост чтеца изменён',
  'post.delete': 'Пост чтеца удалён',
  'post.hide': 'Пост чтеца скрыт',
  'post.unhide': 'Пост чтеца показан',
  'illustration.add': 'Иллюстрация добавлена',
  'illustration.edit': 'Иллюстрация изменена',
  'illustration.delete': 'Иллюстрация удалена',
  'genre.edit': 'Тег изменён',
  'genre.delete': 'Тег удалён',
  'role.create': 'Роль создана',
  'role.update': 'Роль изменена',
  'role.delete': 'Роль удалена',
  'word.create': 'Стоп-слово добавлено',
  'word.update': 'Стоп-слово изменено',
  'word.delete': 'Стоп-слово удалено',
  'request.approve': 'Заявка одобрена',
  'request.reject': 'Заявка отклонена',
  'report.resolve': 'Жалоба обработана',
  'dmca.resolve': 'DMCA-обращение обработано',
  'broadcast.send': 'Рассылка отправлена',
  'narrator.edit': 'Озвучка изменена',
  'narrator.delete': 'Озвучка удалена',
  'author.update': 'Автор изменён',
  'author.delete': 'Автор удалён',
};

const PREFIX_ICONS: [string, LucideIcon][] = [
  ['comment.delete', MessageSquareX],
  ['comment.purge', Trash2],
  ['comment', MessageSquare],
  ['user.ban', Ban],
  ['user.unban', ShieldCheck],
  ['user.role', UserCog],
  ['user.delete', UserX],
  ['user.image', ImageIcon],
  ['user', UserIcon],
  ['title.cover', ImageIcon],
  ['title.bg', ImageIcon],
  ['title', BookMarked],
  ['chapter.audio', Radio],
  ['chapter', BookMarked],
  ['volume', BookMarked],
  ['version', BookMarked],
  ['genre', BookMarked],
  ['illustration', ImageIcon],
  ['post', MessageSquare],
  ['narrator.avatar', ImageIcon],
  ['narrator.cover', ImageIcon],
  ['node', Radio],
  ['word', Shield],
  ['role', Users],
  ['request', ShieldCheck],
  ['report', Shield],
  ['dmca', Shield],
  ['broadcast', Radio],
  ['narrator', UserIcon],
  ['author', UserIcon],
  ['banner', ImageIcon],
  ['badge', ImageIcon],
];

/** Keys rendered on their own (before/after, per-field changes, link, target). */
const HANDLED_KEYS = new Set(['old_body', 'new_body', 'source', 'author_id', 'changes', 'fields', 'username']);

const FIELD_LABELS: Record<string, string> = {
  username: 'Имя пользователя',
  displayName: 'Отображаемое имя',
  email: 'Email',
  bio: 'Био',
  role: 'Роль',
  name: 'Название',
  slug: 'Ссылка (slug)',
  year: 'Год',
  releaseStatus: 'Статус выпуска',
  country: 'Страна',
  isNsfw: 'NSFW',
  isAi: 'AI-озвучка',
  isSensitive: 'Чувствительный тег',
  isHidden: 'Скрыт',
  isVerified: 'Верифицирован',
  modStatus: 'Статус модерации',
  description: 'Описание',
  altNames: 'Альт. названия',
  links: 'Ссылки',
  socials: 'Соцсети',
  word: 'Слово',
  caption: 'Подпись',
  number: 'Номер',
  numberEnd: 'Конец диапазона',
  versionName: 'Название озвучки',
  title: 'Заголовок',
  volume: 'Том',
  skipModeration: 'Пропуск модерации',
};

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

function formatValue(v: unknown): string {
  if (v === null || v === '') return '∅';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '∅';
  return String(v);
}

type Change = { old: unknown; new: unknown };

function parseChanges(details: Record<string, unknown>): [string, Change][] {
  const raw = details.changes;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  return Object.entries(raw as Record<string, Change>).filter(
    ([, c]) => c && typeof c === 'object' && 'new' in c
  );
}

function label(action: string): string {
  return LABELS[action] ?? action;
}

function icon(action: string): LucideIcon {
  for (const [prefix, Ic] of PREFIX_ICONS) {
    if (action === prefix || action.startsWith(prefix + '.')) return Ic;
  }
  return Activity;
}

function reasonBits(details: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(details)) {
    if (HANDLED_KEYS.has(k)) continue;
    if (v === null || typeof v === 'object') continue;
    out.push(Array.isArray(v) ? `${k}: ${v.join(', ')}` : `${k}: ${String(v)}`);
  }
  return out;
}

function EventCard({ en }: { en: AuditEntry }) {
  const Ic = icon(en.action);
  const oldBody = typeof en.details.old_body === 'string' ? en.details.old_body : null;
  const newBody = typeof en.details.new_body === 'string' ? en.details.new_body : null;
  const changes = parseChanges(en.details);
  const bits = reasonBits(en.details);

  return (
    <div className={`glass-panel ${styles.card}`}>
      <div className={styles.head}>
        <span className={styles.icon}>
          <Ic size={17} />
        </span>
        <div className={styles.headMain}>
          <span className={styles.eventId}>{`Событие #${en.id}`}</span>
          <span className={styles.title}>{label(en.action)}</span>
          {bits.length > 0 ? <span className={styles.reason}>{bits.join(' · ')}</span> : null}
        </div>
        <span className={styles.time}>{formatDateTime(en.created_at)}</span>
      </div>

      <div className={styles.chips}>
        {en.actor ? (
          <Link href={`/user/${en.actor.id}`} className={styles.chip}>
            <Shield size={12} />
            {en.actor.username}
          </Link>
        ) : (
          <span className={`${styles.chip} ${styles.chipMuted}`}>
            <Shield size={12} />
            {'модератор удалён'}
          </span>
        )}
        {en.target ? (
          <Link href={`/user/${en.target.id}`} className={styles.chip}>
            <UserIcon size={12} />
            {en.target.username}
          </Link>
        ) : null}
        {en.source ? (
          <Link href={en.source.href} className={`${styles.chip} ${styles.chipLink}`}>
            {en.source.label}
            {' →'}
          </Link>
        ) : null}
      </div>

      {changes.length > 0 ? (
        <ul className={styles.changes}>
          {changes.map(([field, c]) => (
            <li key={field} className={styles.change}>
              <span className={styles.changeField}>{fieldLabel(field)}</span>
              {typeof c.new === 'boolean' ? (
                <span className={c.new ? styles.on : styles.off}>
                  {c.new ? 'включено' : 'выключено'}
                </span>
              ) : (
                <span className={styles.changeVal}>
                  {c.old !== null && c.old !== '' ? (
                    <>
                      <span className={styles.was}>{formatValue(c.old)}</span>
                      <span className={styles.arrow}>{' → '}</span>
                    </>
                  ) : null}
                  <span className={styles.now}>{formatValue(c.new)}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {oldBody !== null || newBody !== null ? (
        <div className={styles.diff}>
          {oldBody !== null ? (
            <div className={styles.diffCol}>
              <span className={styles.diffLabel}>{'Было'}</span>
              <p className={styles.diffText}>{oldBody || '—'}</p>
            </div>
          ) : null}
          {newBody !== null ? (
            <div className={styles.diffCol}>
              <span className={`${styles.diffLabel} ${styles.diffLabelNew}`}>{'Стало'}</span>
              <p className={styles.diffText}>{newBody || '—'}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AuditContent() {
  const [actorInput, setActorInput] = useState('');
  const [actor, setActor] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<AuditEntry> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setActor(actorInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [actorInput]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api<Paginated<AuditEntry>>('/mod/audit', { params: actor ? { page, actor } : { page } })
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
  }, [page, actor, reload]);

  return (
    <>
      <div className={styles.filter}>
        <Search size={15} className={styles.filterIcon} />
        <input
          className={styles.filterInput}
          type="text"
          value={actorInput}
          placeholder={'Фильтр по модератору…'}
          onChange={(e) => setActorInput(e.target.value)}
          aria-label={'Фильтр по модератору'}
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
          icon={ScrollText}
          title={actor ? 'Ничего не найдено' : 'Пока ничего не записано'}
          body={actor ? 'Попробуйте другое имя модератора.' : 'Действия модераторов будут появляться здесь.'}
        />
      ) : (
        <>
          <Pagination page={data.page} total={data.total} perPage={data.per_page} onPage={setPage} />
          <div className={styles.feed}>
            {data.items.map((en) => (
              <EventCard key={en.id} en={en} />
            ))}
          </div>
          <Pagination page={data.page} total={data.total} perPage={data.per_page} onPage={setPage} />
        </>
      )}
    </>
  );
}

export default function ModAuditPage() {
  const h = splitHeading('Аудит действий');
  return (
    <ModShell title={h.title} accent={h.accent} perm="audit.view">
      <AuditContent />
    </ModShell>
  );
}
