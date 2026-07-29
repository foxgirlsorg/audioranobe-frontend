'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowBigDown,
  ArrowBigUp,
  CornerDownRight,
  EyeOff,
  LogIn,
  MessageSquare,
  Pencil,
  Trash2,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Comment, CommentTargetType, Paginated } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { useToast, errMsg } from '@/lib/toast';
import Tabs from '@/components/Tabs';
import UserAvatar from '@/components/UserAvatar';
import ReportButton from '@/components/ReportButton';
import ConfirmDialog from '@/components/ConfirmDialog';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';
import Markdown from '@/components/Markdown';
import styles from './CommentSection.module.css';

const PER_PAGE = 20;
const MAX_BODY = 5000;
const MAX_DEPTH = 8;
const INITIAL_REPLIES_SHOWN = 3;

type Sort = 'new' | 'old' | 'top';

const SORT_TABS = [
  { key: 'new', label: 'Новые' },
  { key: 'old', label: 'Старые' },
  { key: 'top', label: 'Топ' },
];

/* ------------------------------------------------------------------ helpers */

function timeAgo(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '';
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return 'только что';
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)} мин назад`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)} ч назад`;
  const d = h / 24;
  if (d < 7) return `${Math.floor(d)} дн назад`;
  if (d < 30) return `${Math.floor(d / 7)} нед назад`;
  if (d < 365) return `${Math.floor(d / 30)} мес назад`;
  return `${Math.floor(d / 365)} г. назад`;
}

function parseSpoilers(body: string): { text: string; spoiler: boolean }[] {
  const out: { text: string; spoiler: boolean }[] = [];
  const re = /\|\|([\s\S]+?)\|\|/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    if (m.index > last) out.push({ text: body.slice(last, m.index), spoiler: false });
    out.push({ text: m[1], spoiler: true });
    last = m.index + m[0].length;
  }
  if (last < body.length) out.push({ text: body.slice(last), spoiler: false });
  return out;
}

/* ------------------------------------------------------ small subcomponents */

function SpoilerSpan({ text }: { text: string }) {
  const [shown, setShown] = useState(false);
  return (
    <span
      className={shown ? styles.spoilerShown : styles.spoiler}
      role={shown ? undefined : 'button'}
      tabIndex={shown ? undefined : 0}
      title={shown ? undefined : 'Показать спойлер'}
      onClick={() => setShown(true)}
      onKeyDown={(e) => {
        if (!shown && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          setShown(true);
        }
      }}
    >
      {text}
    </span>
  );
}


/**
 * A comment body: markdown, with ||spoilers|| kept as a site-specific extension
 * on top. Spoiler segments are rendered separately so their content stays
 * hidden until clicked; everything between them goes through Markdown.
 */
function CommentBody({ body, mention }: { body: string; mention: Comment | null }) {
  const parts = useMemo(() => parseSpoilers(body), [body]);
  return (
    <div className={styles.body}>
      {mention ? (
        mention.user ? (
          <>
            <Link href={`/user/${mention.user.id}`} className={styles.mention}>
              @{mention.user.username}
            </Link>{' '}
          </>
        ) : (
          <span className={styles.mention}>@удалён </span>
        )
      ) : null}
      {parts.map((p, i) =>
        p.spoiler ? (
          <SpoilerSpan key={i} text={p.text} />
        ) : (
          <Markdown key={i} source={p.text} compact />
        ),
      )}
    </div>
  );
}

/* ------------------------------------------------------------ mention menu */

function MentionDropdown({
  users,
  query,
  activeIndex,
  onSelect,
  position,
}: {
  users: { id: number; username: string; avatar_url: string | null }[];
  query: string;
  activeIndex: number;
  onSelect: (username: string) => void;
  position: { top: number; left: number };
}) {
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return q ? users.filter((u) => u.username.toLowerCase().includes(q)) : users;
  }, [users, query]);

  if (filtered.length === 0) return null;

  return (
    <div className={styles.mentionDropdown} style={{ top: position.top, left: position.left }}>
      {filtered.slice(0, 8).map((u, i) => {
        const q = query.toLowerCase();
        const idx = u.username.toLowerCase().indexOf(q);
        return (
          <div
            key={u.id}
            className={`${styles.mentionItem} ${i === activeIndex ? styles.mentionItemActive : ''}`}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(u.username);
            }}
          >
            <UserAvatar user={{ username: u.username, avatar_url: u.avatar_url }} size={20} />
            <span className={styles.mentionItemName}>
              {idx >= 0 ? (
                <>
                  {u.username.slice(0, idx)}
                  <span className={styles.mentionItemMatch}>
                    {u.username.slice(idx, idx + query.length)}
                  </span>
                  {u.username.slice(idx + query.length)}
                </>
              ) : (
                u.username
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ composer */

function Composer({
  initial = '',
  placeholder,
  submitLabel,
  onSubmit,
  onCancel,
  autoFocus = false,
  mentionUsers = [],
}: {
  initial?: string;
  placeholder?: string;
  submitLabel: string;
  onSubmit: (body: string) => Promise<boolean>;
  onCancel?: () => void;
  autoFocus?: boolean;
  mentionUsers?: { id: number; username: string; avatar_url: string | null }[];
}) {
  const [val, setVal] = useState(initial);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const mirrorRef = useRef<HTMLDivElement | null>(null);

  const [mentionAt, setMentionAt] = useState<number | null>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionActiveIdx, setMentionActiveIdx] = useState(0);
  const [mentionPos, setMentionPos] = useState({ top: 0, left: 0 });

  const triggerIdx = mentionAt ?? -1;
  const mentionQ = triggerIdx >= 0 ? val.slice(triggerIdx + 1, ref.current?.selectionStart ?? val.length) : '';
  const showMention = mentionAt !== null && !/\s/.test(mentionQ) && mentionQ.length < 30;

  const mentionFiltered = useMemo(() => {
    if (!showMention) return [];
    const q = mentionQ.toLowerCase();
    return q
      ? mentionUsers.filter((u) => u.username.toLowerCase().includes(q))
      : mentionUsers;
  }, [showMention, mentionQ, mentionUsers]);

  useEffect(() => {
    setMentionActiveIdx(0);
  }, [mentionQ]);

  const updateMentionPosition = useCallback(() => {
    const textarea = ref.current;
    const mirror = mirrorRef.current;
    if (!textarea || !mirror) return;

    const cs = window.getComputedStyle(textarea);
    const props = [
      'fontFamily', 'fontSize', 'fontWeight', 'lineHeight',
      'letterSpacing', 'wordSpacing', 'textIndent', 'textTransform',
      'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
      'boxSizing', 'whiteSpace', 'wordWrap', 'overflowWrap', 'tabSize',
    ] as const;
    for (const p of props) (mirror.style as any)[p] = cs.getPropertyValue(p);
    mirror.style.width = cs.width;
    mirror.style.position = 'absolute';
    mirror.style.top = '0';
    mirror.style.left = '0';
    mirror.style.visibility = 'hidden';
    mirror.style.pointerEvents = 'none';

    const sel = textarea.selectionStart;
    mirror.textContent = val.slice(0, sel);

    const span = document.createElement('span');
    span.textContent = val.slice(sel) || '.';
    mirror.appendChild(span);

    const rect = textarea.getBoundingClientRect();
    const spanRect = span.getBoundingClientRect();
    const scrollTop = textarea.scrollTop;
    const scrollLeft = textarea.scrollLeft;

    setMentionPos({
      top: spanRect.top - rect.top + scrollTop + 18,
      left: spanRect.left - rect.left + scrollLeft,
    });
  }, [val]);

  function wrapSpoiler() {
    const el = ref.current;
    if (!el) return;
    const s = el.selectionStart ?? val.length;
    const e = el.selectionEnd ?? val.length;
    setVal(`${val.slice(0, s)}||${val.slice(s, e)}||${val.slice(e)}`);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + 2, e + 2);
    });
  }

  function insertMention(username: string) {
    const el = ref.current;
    if (!el || mentionAt === null) return;
    const atIdx = mentionAt;
    const curPos = el.selectionStart;
    const before = val.slice(0, atIdx);
    const after = val.slice(curPos);
    const insert = `@${username} `;
    const newVal = before + insert + after;
    setVal(newVal);
    setMentionAt(null);
    setMentionQuery('');
    requestAnimationFrame(() => {
      el.focus();
      const newPos = atIdx + insert.length;
      el.setSelectionRange(newPos, newPos);
    });
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    setVal(v);

    const pos = e.target.selectionStart;
    if (mentionAt !== null) {
      const afterAt = v.slice(mentionAt + 1, pos);
      if (!afterAt || /\s/.test(afterAt) || afterAt.length >= 30) {
        setMentionAt(null);
        setMentionQuery('');
      } else {
        setMentionQuery(afterAt);
        updateMentionPosition();
      }
    } else if (pos > 0 && v[pos - 1] === '@') {
      setMentionAt(pos - 1);
      setMentionQuery('');
      updateMentionPosition();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      void submit();
      return;
    }

    if (showMention && mentionFiltered.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionActiveIdx((i) => (i + 1) % mentionFiltered.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionActiveIdx((i) => (i - 1 + mentionFiltered.length) % mentionFiltered.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(mentionFiltered[mentionActiveIdx].username);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionAt(null);
        setMentionQuery('');
        return;
      }
    }
  }

  function handleSelect() {
    if (mentionAt !== null) {
      updateMentionPosition();
    }
  }

  async function submit() {
    if (busy) return;
    setBusy(true);
    const ok = await onSubmit(val);
    setBusy(false);
    if (ok) setVal('');
  }

  return (
    <div className={styles.composer}>
      <textarea
        ref={ref}
        className={styles.composerInput}
        value={val}
        placeholder={placeholder}
        rows={3}
        maxLength={MAX_BODY}
        autoFocus={autoFocus}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        onSelect={handleSelect}
        onClick={handleSelect}
      />
      <div ref={mirrorRef} style={{ position: 'absolute', visibility: 'hidden' }} aria-hidden />
      {showMention && mentionFiltered.length > 0 && (
        <MentionDropdown
          users={mentionFiltered}
          query={mentionQ}
          activeIndex={mentionActiveIdx}
          onSelect={insertMention}
          position={mentionPos}
        />
      )}
      <div className={styles.composerBar}>
        <button
          type="button"
          className={styles.toolBtn}
          onClick={wrapSpoiler}
          title="Обернуть выделенное в спойлер (||вот так||)"
        >
          <EyeOff size={13} />
          Спойлер
        </button>
        <span className={styles.composerCount}>
          {val.length}/{MAX_BODY}
        </span>
        <span className={styles.composerSpacer} />
        {onCancel ? (
          <button type="button" className={styles.composerCancel} onClick={onCancel}>
            Отмена
          </button>
        ) : null}
        <button
          type="button"
          className={styles.composerSubmit}
          onClick={() => void submit()}
          disabled={busy || val.trim() === ''}
        >
          {busy ? 'Отправка…' : submitLabel}
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- nested comment */

function NestedComment({
  comment,
  children,
  directChildren,
  byId,
  depth,
  replyingId,
  editingId,
  currentUserId,
  canModerate,
  expandedSet,
  onToggleExpand,
  onVote,
  onReply,
  onEdit,
  onDelete,
  onSubmitReply,
  onSubmitEdit,
}: {
  comment: Comment;
  children: Map<number, Comment[]>;
  directChildren: Map<number, Comment[]>;
  byId: Map<number, Comment>;
  depth: number;
  replyingId: number | null;
  editingId: number | null;
  currentUserId: number | null;
  canModerate: boolean;
  expandedSet: Set<number>;
  onToggleExpand: (id: number) => void;
  onVote: (c: Comment, dir: 1 | -1) => void;
  onReply: (id: number | null) => void;
  onEdit: (id: number | null) => void;
  onDelete: (c: Comment) => void;
  onSubmitReply: (body: string, parentId: number) => Promise<boolean>;
  onSubmitEdit: (id: number, body: string) => Promise<boolean>;
}) {
  const own = currentUserId != null && comment.user != null && comment.user.id === currentUserId;
  const mention = comment.parent_id != null ? byId.get(comment.parent_id) ?? null : null;
  const isRoot = depth === 0;
  const avatarSize = Math.max(22, 34 - depth * 2);

  return (
    <article
      className={isRoot ? styles.comment : `${styles.comment} ${styles.replyItem}`}
      id={`comment-${comment.id}`}
    >
      <UserAvatar user={comment.user} size={avatarSize} />
      <div className={styles.commentMain}>
        <header className={styles.commentHead}>
          {comment.user ? (
            <Link
              href={`/user/${encodeURIComponent(comment.user.username)}`}
              className={styles.username}
              // The link still goes to the handle; only the label is the
              // display name, and the title shows the handle behind it.
              title={`@${comment.user.username}`}
            >
              {comment.user.display_name || comment.user.username}
            </Link>
          ) : (
            <span className={styles.usernameGone}>удалённый пользователь</span>
          )}
          <time
            className={styles.time}
            dateTime={comment.created_at}
            title={new Date(comment.created_at).toLocaleString()}
          >
            {timeAgo(comment.created_at)}
          </time>
          {comment.updated_at && !comment.is_deleted ? (
            <span className={styles.edited} title={new Date(comment.updated_at).toLocaleString()}>
              {comment.edited_by_staff ? 'изменено модерацией' : 'изменено'}
            </span>
          ) : null}
        </header>

        {comment.is_deleted ? (
          <div className={styles.deletedBody}>[удалено]</div>
        ) : editingId === comment.id ? (
          <Composer
            initial={comment.body}
            submitLabel="Сохранить"
            autoFocus
            onSubmit={(b) => onSubmitEdit(comment.id, b)}
            onCancel={() => onEdit(null)}
          />
        ) : (
          <CommentBody body={comment.body} mention={!isRoot ? mention : null} />
        )}

        {!comment.is_deleted && editingId !== comment.id ? (
          <footer className={styles.actions}>
            <span className={styles.votes}>
              <button
                type="button"
                className={
                  comment.my_vote === 1
                    ? `${styles.voteBtn} ${styles.voteActive}`
                    : styles.voteBtn
                }
                onClick={() => onVote(comment, 1)}
                aria-label="Голос за"
                aria-pressed={comment.my_vote === 1}
              >
                <ArrowBigUp size={16} />
              </button>
              <span
                className={
                  comment.my_vote !== 0 ? `${styles.score} ${styles.scoreVoted}` : styles.score
                }
              >
                {comment.score}
              </span>
              <button
                type="button"
                className={
                  comment.my_vote === -1
                    ? `${styles.voteBtn} ${styles.voteActive}`
                    : styles.voteBtn
                }
                onClick={() => onVote(comment, -1)}
                aria-label="Голос против"
                aria-pressed={comment.my_vote === -1}
              >
                <ArrowBigDown size={16} />
              </button>
            </span>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => onReply(replyingId === comment.id ? null : comment.id)}
            >
              <CornerDownRight size={12} />
              Ответить
            </button>
            {own || canModerate ? (
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => onEdit(editingId === comment.id ? null : comment.id)}
                title={own ? undefined : 'Редактирование от модерации'}
              >
                <Pencil size={12} />
                Изменить
              </button>
            ) : null}
            {own || canModerate ? (
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.actionDanger}`}
                onClick={() => onDelete(comment)}
              >
                <Trash2 size={12} />
                Удалить
              </button>
            ) : null}
            <ReportButton targetType="comment" targetId={comment.id} />
          </footer>
        ) : null}

        {replyingId === comment.id ? (
          <div className={styles.replyBox}>
            <Composer
              placeholder={
                comment.user
                  ? `Ответ для ${comment.user.username}…`
                  : 'Напишите ответ…'
              }
              submitLabel="Ответить"
              autoFocus
              onSubmit={(b) => onSubmitReply(b, comment.id)}
              onCancel={() => onReply(null)}
            />
          </div>
        ) : null}

        {depth < MAX_DEPTH && (() => {
          const kids = directChildren.get(comment.id) ?? [];
          if (kids.length === 0) return null;
          const visibleKids = expandedSet.has(comment.id) ? kids : kids.slice(0, INITIAL_REPLIES_SHOWN);
          const hiddenCount = kids.length - visibleKids.length;
          return (
            <div className={styles.nested}>
              {visibleKids.map((child) => (
                <div key={child.id} className={styles.nestedReply}>
                  <NestedComment
                    comment={child}
                    children={children}
                    directChildren={directChildren}
                    byId={byId}
                    depth={depth + 1}
                    replyingId={replyingId}
                    editingId={editingId}
                    currentUserId={currentUserId}
                    canModerate={canModerate}
                    expandedSet={expandedSet}
                    onToggleExpand={onToggleExpand}
                    onVote={onVote}
                    onReply={onReply}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onSubmitReply={onSubmitReply}
                    onSubmitEdit={onSubmitEdit}
                  />
                </div>
              ))}
              {hiddenCount > 0 && (
                <button
                  type="button"
                  className={styles.threadExpandBtn}
                  onClick={() => onToggleExpand(comment.id)}
                >
                  Показать ещё {hiddenCount} {hiddenCount === 1 ? 'ответ' : hiddenCount < 5 ? 'ответа' : 'ответов'}
                </button>
              )}
            </div>
          );
        })()}
      </div>
    </article>
  );
}

/* ----------------------------------------------------------- main component */

export function CommentSection({
  targetType,
  targetId,
}: {
  targetType: CommentTargetType;
  targetId: number;
}) {
  const { user, isMod } = useAuth();
  const { toast } = useToast();

  const [items, setItems] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<Sort>('new');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [replyingId, setReplyingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [toDelete, setToDelete] = useState<Comment | null>(null);
  const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setReplyingId(null);
    setEditingId(null);
    setExpandedComments(new Set());
    (async () => {
      try {
        const res = await api<Paginated<Comment>>('/comments', {
          params: {
            target_type: targetType,
            target_id: targetId,
            sort,
            page: 1,
            per_page: PER_PAGE,
          },
        });
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
        setPage(res.page ?? 1);
      } catch (e) {
        if (!cancelled) {
          setItems([]);
          setTotal(0);
          setError(errMsg(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetType, targetId, sort]);

  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await api<Paginated<Comment>>('/comments', {
        params: {
          target_type: targetType,
          target_id: targetId,
          sort,
          page: page + 1,
          per_page: PER_PAGE,
        },
      });
      setItems((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...res.items.filter((c) => !seen.has(c.id))];
      });
      setTotal(res.total);
      setPage(res.page ?? page + 1);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setLoadingMore(false);
    }
  }

  const { roots, childrenOf, directChildren, byId } = useMemo(() => {
    const byId = new Map<number, Comment>();
    for (const c of items) byId.set(c.id, c);

    const directChildren = new Map<number, Comment[]>();
    for (const c of items) {
      if (c.parent_id != null) {
        const arr = directChildren.get(c.parent_id);
        if (arr) arr.push(c);
        else directChildren.set(c.parent_id, [c]);
      }
    }

    const rootIdOf = (c: Comment): number => {
      let cur = c;
      let guard = 0;
      while (cur.parent_id != null && byId.has(cur.parent_id) && guard++ < 200) {
        const next = byId.get(cur.parent_id)!;
        if (next.id === cur.id) break;
        cur = next;
      }
      return cur.id;
    };

    const rootOf = new Map<number, number>();
    const roots: Comment[] = [];
    const childrenOf = new Map<number, Comment[]>();

    for (const c of items) {
      if (c.parent_id == null || !byId.has(c.parent_id)) {
        rootOf.set(c.id, c.id);
        roots.push(c);
        continue;
      }
      const rid = rootIdOf(c);
      rootOf.set(c.id, rid);
      if (rid === c.id) {
        roots.push(c);
        continue;
      }
      const arr = childrenOf.get(rid);
      if (arr) arr.push(c);
      else childrenOf.set(rid, [c]);
    }

    for (const arr of childrenOf.values()) arr.sort((a, b) => a.id - b.id);
    for (const arr of directChildren.values()) arr.sort((a, b) => a.id - b.id);
    return { roots, childrenOf, directChildren, byId };
  }, [items]);

  const hasMore = page < Math.ceil(total / PER_PAGE);

  function toggleExpand(commentId: number) {
    setExpandedComments((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  }

  function patch(id: number, p: Partial<Comment>) {
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, ...p } : c)));
  }

  async function vote(c: Comment, dir: 1 | -1) {
    if (!user) {
      toast('Войдите, чтобы голосовать за комментарии', 'error');
      return;
    }
    const next = (c.my_vote === dir ? 0 : dir) as -1 | 0 | 1;
    const prev = { score: c.score, my_vote: c.my_vote };
    patch(c.id, { my_vote: next, score: c.score - c.my_vote + next });
    try {
      const res = await api<{ score: number; my_vote: -1 | 0 | 1 }>(`/comments/${c.id}/vote`, {
        method: 'PUT',
        body: { value: next },
      });
      patch(c.id, { score: res.score, my_vote: res.my_vote });
    } catch (e) {
      patch(c.id, prev);
      toast(errMsg(e), 'error');
    }
  }

  async function post(body: string, parentId: number | null): Promise<boolean> {
    const b = body.trim();
    if (!b) {
      toast('Комментарий не может быть пустым', 'error');
      return false;
    }
    if (b.length > MAX_BODY) {
      toast(`Комментарий слишком длинный (максимум ${MAX_BODY} символов)`, 'error');
      return false;
    }
    try {
      const c = await api<Comment>('/comments', {
        method: 'POST',
        body: {
          target_type: targetType,
          target_id: targetId,
          body: b,
          ...(parentId != null ? { parent_id: parentId } : {}),
        },
      });
      if (parentId != null) {
        setItems((prev) => [...prev, c]);
        setReplyingId(null);
      } else {
        setItems((prev) => (sort === 'old' ? [...prev, c] : [c, ...prev]));
        setTotal((t) => t + 1);
      }
      return true;
    } catch (e) {
      toast(errMsg(e), 'error');
      return false;
    }
  }

  async function saveEdit(id: number, body: string): Promise<boolean> {
    const b = body.trim();
    if (!b) {
      toast('Комментарий не может быть пустым', 'error');
      return false;
    }
    if (b.length > MAX_BODY) {
      toast(`Комментарий слишком длинный (максимум ${MAX_BODY} символов)`, 'error');
      return false;
    }
    try {
      const res = await api<Comment>(`/comments/${id}`, {
        method: 'PATCH',
        body: { body: b },
      });
      patch(id, {
        body: res.body,
        updated_at: res.updated_at,
        edited_by_staff: res.edited_by_staff,
      });
      setEditingId(null);
      return true;
    } catch (e) {
      toast(errMsg(e), 'error');
      return false;
    }
  }

  async function doDelete(c: Comment) {
    try {
      await api(`/comments/${c.id}`, { method: 'DELETE' });
      patch(c.id, { is_deleted: true, body: '' });
      toast('Комментарий удалён', 'ok');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  }

  function toggleReply(id: number | null) {
    if (id != null && !user) {
      toast('Войдите, чтобы ответить', 'error');
      return;
    }
    setReplyingId(id);
    if (id != null) setEditingId(null);
  }

  function toggleEdit(id: number | null) {
    setEditingId(id);
    if (id != null) setReplyingId(null);
  }

  const mentionUsers = useMemo(() => {
    const map = new Map<number, { id: number; username: string; avatar_url: string | null }>();
    for (const c of items) {
      if (c.user && !map.has(c.user.id)) {
        map.set(c.user.id, { id: c.user.id, username: c.user.username, avatar_url: c.user.avatar_url ?? null });
      }
    }
    return Array.from(map.values());
  }, [items]);

  return (
    <section className={styles.section}>
      <header className={styles.head}>
        <h3 className={styles.heading}>
          Комментарии <span className={styles.headCount}>{total}</span>
        </h3>
        <Tabs
          tabs={SORT_TABS}
          active={sort}
          onChange={(k) => setSort(k as Sort)}
        />
      </header>

      {user ? (
        <div className={styles.postBox}>
          <UserAvatar user={user} size={36} />
          <Composer
            placeholder="Поделитесь впечатлениями… (спойлеры оборачивайте в ||двойные палочки||)"
            submitLabel="Опубликовать"
            onSubmit={(b) => post(b, null)}
            mentionUsers={mentionUsers}
          />
        </div>
      ) : (
        <div className={styles.loginPrompt}>
          <LogIn size={15} />
          <span>
            Присоединяйтесь к обсуждению —{' '}
            <Link href="/auth/login" className={styles.loginLink}>
              войдите
            </Link>{' '}
            или{' '}
            <Link href="/auth/register" className={styles.loginLink}>
              создайте аккаунт
            </Link>
            .
          </span>
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : error ? (
        <EmptyState icon={MessageSquare} title="Не удалось загрузить комментарии" body={error} />
      ) : roots.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Комментариев пока нет"
          body="Будьте первым, кто поделится впечатлениями."
        />
      ) : (
        <>
          <div className={styles.list}>
            {roots.map((root) => (
              <div key={root.id} className={styles.thread}>
                <NestedComment
                  comment={root}
                  children={childrenOf}
                  directChildren={directChildren}
                  byId={byId}
                  depth={0}
                  replyingId={replyingId}
                  editingId={editingId}
                  currentUserId={user ? user.id : null}
                  canModerate={isMod}
                  expandedSet={expandedComments}
                  onToggleExpand={toggleExpand}
                  onVote={vote}
                  onReply={toggleReply}
                  onEdit={toggleEdit}
                  onDelete={(c) => setToDelete(c)}
                  onSubmitReply={(b, parentId) => post(b, parentId)}
                  onSubmitEdit={saveEdit}
                />
              </div>
            ))}
          </div>
          {hasMore ? (
            <div className={styles.moreWrap}>
              <button
                type="button"
                className={styles.more}
                onClick={() => void loadMore()}
                disabled={loadingMore}
              >
                {loadingMore ? 'Загрузка…' : 'Показать ещё комментарии'}
              </button>
            </div>
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={toDelete != null}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) void doDelete(toDelete);
        }}
        title="Удалить комментарий"
        body={
          toDelete && user && toDelete.user && toDelete.user.id !== user.id
            ? 'Удалить этот комментарий как модератор? Вместо него будет показано [удалено].'
            : 'Удалить ваш комментарий? Вместо него будет показано [удалено].'
        }
        danger
      />
    </section>
  );
}

export default CommentSection;
