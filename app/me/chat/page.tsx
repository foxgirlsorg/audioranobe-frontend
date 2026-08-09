'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronDown,
  Copy,
  CornerUpLeft,
  ImagePlus,
  MessageCircle,
  Pencil,
  Send,
  Sparkles,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast, errMsg } from '@/lib/toast';
import { usePageTitle } from '@/lib/usePageTitle';
import { initialsOf } from '@/lib/format';
import type { ChatConversation, ChatMessage, ChatThread } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import UserBadges from '@/components/UserBadges/UserBadges';
import Markdown from '@/components/Markdown/Markdown';
import ImageViewer from '@/components/ImageViewer/ImageViewer';
import styles from './page.module.css';

const LIST_POLL_MS = 15_000;
const THREAD_POLL_MS = 4_000;
const LONG_PRESS_MS = 420;
const MAX_LEN = 5000;
const MAX_ROWS = 10;

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
}
function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

const URL_RE = /(https?:\/\/[^\s<]+)/g;

/** Turn bare URLs in plain-text messages into clickable links. Rich (mod/admin)
 *  messages already linkify through the Markdown renderer. */
function linkify(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    let url = m[0];
    let trail = '';
    const tm = /[.,!?)\]]+$/.exec(url); // don't swallow trailing punctuation
    if (tm) {
      trail = tm[0];
      url = url.slice(0, -trail.length);
    }
    out.push(
      <a key={key++} href={url} target="_blank" rel="noopener noreferrer nofollow" className={styles.msgLink}>
        {url}
      </a>
    );
    if (trail) out.push(trail);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Menu = { x: number; y: number; msg: ChatMessage };

export default function ChatPage() {
  return (
    <Suspense fallback={<div className={styles.center}><Spinner size={34} /></div>}>
      <ChatInner />
    </Suspense>
  );
}

function ChatInner() {
  const { user, isMod, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  usePageTitle('Сообщения');

  const selectedId = useMemo(() => {
    const raw = searchParams.get('u');
    return raw && /^\d+$/.test(raw) ? Number(raw) : null;
  }, [searchParams]);

  const [convos, setConvos] = useState<ChatConversation[] | null>(null);
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [showImage, setShowImage] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  // Mods/admins render rich by default; this opts a single message out of that.
  const [plainText, setPlainText] = useState(true);
  const [highlight, setHighlight] = useState<number | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const lastIdRef = useRef(0);
  const nearBottomRef = useRef(true);
  const pressTimer = useRef<number | null>(null);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth/login?next=/me/chat');
  }, [authLoading, user, router]);

  // On mobile the chat fills the screen below the navbar (footer hidden, container
  // padding dropped). The rules are gated to mobile in globals.css, so this class
  // is a no-op on desktop.
  useEffect(() => {
    document.body.classList.add('dm-fullscreen');
    return () => document.body.classList.remove('dm-fullscreen');
  }, []);

  // Grow the composer to fit the text, up to MAX_ROWS lines, then scroll.
  const autoGrow = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const cs = getComputedStyle(el);
    const line = parseFloat(cs.lineHeight) || 20;
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const borderY = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    const max = line * MAX_ROWS + padY + borderY;
    const content = el.scrollHeight + borderY;
    el.style.height = `${Math.min(content, max)}px`;
    el.style.overflowY = content > max ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    autoGrow();
  }, [text, autoGrow, editing, replyTo, selectedId]);

  // ---- conversation list (polled) ----
  const loadList = useCallback(() => {
    api<{ items: ChatConversation[] }>('/me/chat')
      .then((r) => setConvos(r.items ?? []))
      .catch(() => setConvos((c) => c ?? []));
  }, []);

  useEffect(() => {
    if (!user) return;
    loadList();
    const iv = window.setInterval(loadList, LIST_POLL_MS);
    return () => window.clearInterval(iv);
  }, [user, loadList]);

  // ---- open a thread when the ?u selection changes ----
  useEffect(() => {
    if (!user || selectedId === null) {
      setThread(null);
      return;
    }
    let alive = true;
    setThreadLoading(true);
    setThread(null);
    setReplyTo(null);
    setEditing(null);
    setShowScrollDown(false);
    lastIdRef.current = 0;
    api<ChatThread>(`/me/chat/${selectedId}`)
      .then((t) => {
        if (!alive) return;
        setThread(t);
        lastIdRef.current = t.messages.length ? t.messages[t.messages.length - 1].id : 0;
        nearBottomRef.current = true;
        setConvos((prev) =>
          prev ? prev.map((c) => (c.user.id === selectedId ? { ...c, unread: 0 } : c)) : prev
        );
      })
      .catch((e) => {
        if (alive) toast(errMsg(e), 'error');
      })
      .finally(() => {
        if (alive) setThreadLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [user, selectedId, toast]);

  // ---- poll the open thread for new messages, and pick up edits/deletions
  // of already-loaded ones (the default page always reflects current DB state) ----
  useEffect(() => {
    if (!user || selectedId === null) return;
    const tick = () => {
      api<ChatThread>(`/me/chat/${selectedId}`)
        .then((t) => {
          const priorLastId = lastIdRef.current;
          const brandNew = t.messages.filter((m) => m.id > priorLastId);
          if (brandNew.length) {
            lastIdRef.current = Math.max(priorLastId, ...brandNew.map((m) => m.id));
          }
          setThread((prev) => {
            if (!prev) return prev;
            const freshMap = new Map(t.messages.map((m) => [m.id, m]));
            const updated = prev.messages.map((m) => freshMap.get(m.id) ?? m);
            const merged = brandNew.length ? [...updated, ...brandNew] : updated;
            return { ...prev, messages: merged, their_last_read_id: t.their_last_read_id, can_send: t.can_send };
          });
          if (brandNew.length) loadList();
        })
        .catch(() => {});
    };
    const iv = window.setInterval(tick, THREAD_POLL_MS);
    return () => window.clearInterval(iv);
  }, [user, selectedId, loadList]);

  // Group consecutive messages by day for Telegram-style sticky date pills.
  // Deleted messages are dropped entirely here — they only ever resurface as a
  // quoted "сообщение удалено" preview on whatever replied to them.
  const dayGroups = useMemo(() => {
    const gs: { day: string; items: ChatMessage[] }[] = [];
    for (const m of thread?.messages ?? []) {
      if (m.is_deleted) continue;
      const d = dayKey(m.created_at);
      const last = gs[gs.length - 1];
      if (last && last.day === d) last.items.push(m);
      else gs.push({ day: d, items: [m] });
    }
    return gs;
  }, [thread?.messages]);

  // ---- keep view pinned to the newest message ----
  const messageCount = thread?.messages.length ?? 0;
  useEffect(() => {
    const el = listRef.current;
    if (el && nearBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messageCount, threadLoading]);

  // ---- dismiss the context menu ----
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(null);
    window.addEventListener('mousedown', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    nearBottomRef.current = fromBottom < 120;
    // Show the jump-to-latest button once scrolled up more than a screenful.
    setShowScrollDown(fromBottom > el.clientHeight);
    // Load older messages once the user scrolls near the top.
    if (el.scrollTop < 120 && thread?.has_more && !loadingMoreRef.current) {
      void loadEarlier();
    }
  };

  const scrollToBottom = () => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    nearBottomRef.current = true;
    setShowScrollDown(false);
  };

  const select = (id: number) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set('u', String(id));
    router.push(`/me/chat?${sp.toString()}`);
  };
  const backToList = () => router.push('/me/chat');

  const focusInput = () => requestAnimationFrame(() => inputRef.current?.focus());

  const startReply = (msg: ChatMessage) => {
    setEditing(null);
    setReplyTo(msg);
    setMenu(null);
    focusInput();
  };

  const startEdit = (msg: ChatMessage) => {
    if (!msg.mine || msg.is_deleted) return;
    setReplyTo(null);
    setEditing(msg);
    setText(msg.body);
    setImageUrl(msg.image_url);
    setShowImage(!!msg.image_url);
    setPlainText(msg.plain_text);
    setMenu(null);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });
  };

  const cancelCompose = () => {
    setReplyTo(null);
    if (editing) {
      setText('');
      setImageUrl('');
      setShowImage(false);
      setPlainText(true);
    }
    setEditing(null);
  };

  const copyText = (msg: ChatMessage) => {
    if (msg.body) navigator.clipboard?.writeText(msg.body).catch(() => {});
    setMenu(null);
  };

  const send = async () => {
    if (sending || selectedId === null) return;
    const body = text.trim();

    if (editing) {
      const img = imageUrl.trim();
      // Emptying an edit deletes the message instead of saving nothing.
      if (!body && !img) {
        void deleteMessage(editing.id);
        return;
      }
      setSending(true);
      try {
        const updated = await api<ChatMessage>(`/me/chat/messages/${editing.id}`, {
          method: 'PATCH',
          body: { body, image_url: img, plain_text: plainText },
        });
        setThread((prev) =>
          prev ? { ...prev, messages: prev.messages.map((m) => (m.id === updated.id ? updated : m)) } : prev
        );
        setEditing(null);
        setText('');
        setImageUrl('');
        setShowImage(false);
        setPlainText(true);
        loadList();
      } catch (e) {
        toast(errMsg(e), 'error');
      } finally {
        setSending(false);
      }
      return;
    }

    const img = imageUrl.trim();
    if (!body && !img) return;
    setSending(true);
    try {
      const msg = await api<ChatMessage>(`/me/chat/${selectedId}`, {
        method: 'POST',
        body: { body, image_url: img, reply_to_id: replyTo?.id ?? null, plain_text: plainText },
      });
      setThread((prev) => (prev ? { ...prev, messages: [...prev.messages, msg] } : prev));
      lastIdRef.current = Math.max(lastIdRef.current, msg.id);
      nearBottomRef.current = true;
      setText('');
      setImageUrl('');
      setShowImage(false);
      setReplyTo(null);
      setPlainText(true);
      loadList();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setSending(false);
    }
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
      return;
    }
    // Telegram-style: Up arrow on an empty composer edits your last message.
    if (e.key === 'ArrowUp' && text === '' && !editing && !replyTo && thread) {
      const last = [...thread.messages].reverse().find((m) => m.mine && !m.is_deleted);
      if (last) {
        e.preventDefault();
        startEdit(last);
      }
    }
    if (e.key === 'Escape' && (editing || replyTo)) {
      e.preventDefault();
      cancelCompose();
    }
  };

  const loadEarlier = async () => {
    if (!thread || loadingMoreRef.current || !thread.messages.length) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const oldestId = thread.messages[0].id;
    const el = listRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    try {
      const older = await api<ChatThread>(`/me/chat/${selectedId}`, { params: { before: oldestId } });
      setThread((prev) =>
        prev ? { ...prev, messages: [...older.messages, ...prev.messages], has_more: older.has_more } : prev
      );
      // Preserve the scroll anchor so the viewport doesn't jump on prepend.
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight;
      });
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  };

  const deleteMessage = async (id: number) => {
    setMenu(null);
    try {
      await api(`/me/chat/messages/${id}`, { method: 'DELETE' });
      setThread((prev) =>
        prev
          ? {
              ...prev,
              messages: prev.messages.map((m) =>
                m.id === id ? { ...m, is_deleted: true, body: '', image_url: '', reply_to: m.reply_to } : m
              ),
            }
          : prev
      );
      if (editing?.id === id) cancelCompose();
      loadList();
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  const jumpTo = (id: number) => {
    const el = document.getElementById(`dm-msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setHighlight(id);
    window.setTimeout(() => setHighlight((h) => (h === id ? null : h)), 1200);
  };

  // Whether the context menu would have anything to offer for this message —
  // mirrors the menu item conditions below, so an empty menu never opens.
  const hasMenuActions = (msg: ChatMessage): boolean =>
    !msg.is_deleted && !!(thread?.can_send || msg.body || msg.mine);

  // context menu triggers
  const openMenu = (e: React.MouseEvent, msg: ChatMessage) => {
    e.preventDefault();
    if (!hasMenuActions(msg)) return;
    setMenu({ x: e.clientX, y: e.clientY, msg });
  };
  const onTouchStart = (e: React.TouchEvent, msg: ChatMessage) => {
    if (!hasMenuActions(msg)) return;
    const t = e.touches[0];
    const x = t.clientX;
    const y = t.clientY;
    pressTimer.current = window.setTimeout(() => setMenu({ x, y, msg }), LONG_PRESS_MS);
  };
  const clearPress = () => {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const renderMessage = (m: ChatMessage) => {
    // dayGroups already drops deleted messages, so every message reaching here is live.
    const read = m.mine && !!thread && m.id <= thread.their_last_read_id;
    const canReply = !!thread?.can_send;
    const meta = (
      <>
        {m.edited ? <Pencil size={9} className={styles.edited} /> : null}
        <span className={styles.time}>{fmtTime(m.created_at)}</span>
        {m.mine ? (read ? <CheckCheck size={13} className={styles.readTick} /> : <Check size={13} />) : null}
      </>
    );
    // Plain text can carry the meta as a floated tail so it rides the last line
    // of text (Telegram-style). Rich/markdown and image-only bodies can't host
    // a nested float safely, so they keep it on its own row below.
    const inlineMeta = !!m.body && m.format !== 'rich';
    return (
      <div key={m.id} id={`dm-msg-${m.id}`} className={`${styles.bubbleRow} ${m.mine ? styles.mine : styles.theirs}`}>
        {canReply ? (
          <button
            type="button"
            className={styles.replyQuick}
            onClick={() => startReply(m)}
            aria-label="Ответить"
            title="Ответить"
          >
            <CornerUpLeft size={14} />
          </button>
        ) : null}
        <div
          className={`${styles.bubble} ${highlight === m.id ? styles.bubbleHighlight : ''}`}
          onContextMenu={(e) => openMenu(e, m)}
          onTouchStart={(e) => onTouchStart(e, m)}
          onTouchEnd={clearPress}
          onTouchMove={clearPress}
        >
          {m.reply_to ? (
            <button type="button" className={styles.replyQuote} onClick={() => jumpTo(m.reply_to!.id)}>
              <span className={styles.replyAuthor}>{m.reply_to.mine ? 'Вы' : m.reply_to.author}</span>
              <span className={styles.replyExcerpt}>
                {m.reply_to.is_deleted ? 'сообщение удалено' : m.reply_to.excerpt}
              </span>
            </button>
          ) : null}
          {m.image_url ? (
            <img src={m.image_url} alt="" className={styles.bubbleImage} onClick={() => setViewerSrc(m.image_url)} />
          ) : null}
          {m.body ? (
            m.format === 'rich' ? (
              <div className={styles.rich}><Markdown source={m.body} compact /></div>
            ) : (
              <span className={styles.bubbleText}>
                {linkify(m.body)}
                <span className={styles.metaInline}>{meta}</span>
              </span>
            )
          ) : null}
          {!inlineMeta ? <span className={styles.meta}>{meta}</span> : null}
        </div>
      </div>
    );
  };

  if (authLoading || !user) {
    return <div className={styles.center}><Spinner size={34} /></div>;
  }

  return (
    <div className={`${styles.page} ${selectedId !== null ? styles.threadOpen : ''}`}>
      <aside className={styles.sidebar}>
        <header className={styles.sidebarHead}>
          <h1 className={styles.sidebarTitle}>Сообщения</h1>
        </header>
        <div className={styles.convList}>
          {convos === null ? (
            <div className={styles.center}><Spinner /></div>
          ) : convos.length === 0 ? (
            <p className={styles.emptyHint}>
              У вас пока нет переписок. Откройте профиль пользователя и нажмите «Написать».
            </p>
          ) : (
            convos.map((c) => (
              <button
                key={c.user.id}
                type="button"
                className={`${styles.convRow} ${c.user.id === selectedId ? styles.convActive : ''}`}
                onClick={() => select(c.user.id)}
              >
                <span className={styles.avatar}>
                  {c.user.avatar_url ? (
                    <img src={c.user.avatar_url} alt="" />
                  ) : (
                    <span className={styles.avatarFallback}>{initialsOf(c.user.username)}</span>
                  )}
                </span>
                <span className={styles.convMain}>
                  <span className={styles.convTop}>
                    <span className={styles.convName}>{c.user.display_name || c.user.username}</span>
                    {c.last_message_at ? <span className={styles.convTime}>{fmtTime(c.last_message_at)}</span> : null}
                  </span>
                  <span className={styles.convPreview}>
                    {c.last_message
                      ? (c.last_message.mine ? 'Вы: ' : '') +
                        (c.last_message.is_deleted
                          ? 'сообщение удалено'
                          : c.last_message.body || (c.last_message.image_url ? '📷 изображение' : ''))
                      : 'Нет сообщений'}
                  </span>
                </span>
                {c.unread > 0 ? <span className={styles.unreadDot}>{c.unread > 99 ? '99+' : c.unread}</span> : null}
              </button>
            ))
          )}
        </div>
      </aside>

      <section className={styles.thread}>
        {selectedId === null ? (
          <div className={styles.noThread}>
            <EmptyState icon={MessageCircle} title="Выберите переписку" body="Сообщения появятся здесь." />
          </div>
        ) : threadLoading && !thread ? (
          <div className={styles.center}><Spinner /></div>
        ) : thread ? (
          <>
            <header className={styles.threadHead}>
              <button type="button" className={styles.backBtn} onClick={backToList} aria-label="Назад">
                <ArrowLeft size={18} />
              </button>
              <Link href={`/user/${thread.user.id}`} className={styles.threadUser}>
                <span className={styles.avatarSm}>
                  {thread.user.avatar_url ? (
                    <img src={thread.user.avatar_url} alt="" />
                  ) : (
                    <span className={styles.avatarFallback}>{initialsOf(thread.user.username)}</span>
                  )}
                </span>
                <span className={styles.threadName}>
                  {thread.user.display_name || thread.user.username}
                  <UserBadges user={thread.user} size={11} />
                </span>
              </Link>
            </header>

            <div className={styles.messagesWrap}>
              <div className={styles.messages} ref={listRef} onScroll={onScroll}>
                {loadingMore ? (
                  <div className={styles.loadEarlier}><Spinner size={18} /></div>
                ) : null}
                {thread.messages.length === 0 ? (
                  <p className={styles.threadEmpty}>Напишите первое сообщение.</p>
                ) : (
                  dayGroups.map((g) => (
                    <div key={g.day} className={styles.dayGroup}>
                      <div className={styles.dayDivider}><span>{g.day}</span></div>
                      {g.items.map(renderMessage)}
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>
              {showScrollDown ? (
                <button
                  type="button"
                  className={styles.scrollDown}
                  onClick={scrollToBottom}
                  aria-label="К последним сообщениям"
                >
                  <ChevronDown size={22} />
                </button>
              ) : null}
            </div>

            {thread.can_send || editing ? (
              <div className={styles.composer}>
                {(replyTo || editing) ? (
                  <div className={styles.contextBar}>
                    {editing ? <Pencil size={15} className={styles.contextIcon} /> : <CornerUpLeft size={15} className={styles.contextIcon} />}
                    <div className={styles.contextInfo}>
                      <span className={styles.contextTitle}>
                        {editing ? 'Редактирование' : `Ответ ${replyTo?.mine ? 'себе' : (thread.user.display_name || thread.user.username)}`}
                      </span>
                      <span className={styles.contextExcerpt}>
                        {editing ? (editing.body || '📷 изображение') : (replyTo?.body || (replyTo?.image_url ? '📷 изображение' : ''))}
                      </span>
                    </div>
                    <button type="button" className={styles.contextClose} onClick={cancelCompose} aria-label="Отмена">
                      <X size={16} />
                    </button>
                  </div>
                ) : null}

                {showImage ? (
                  <div className={styles.imageRow}>
                    <ImagePlus size={16} className={styles.imageIcon} />
                    <input
                      className={styles.imageInput}
                      type="url"
                      placeholder="Ссылка на изображение (https://…)"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                    />
                    <button
                      type="button"
                      className={styles.imageClear}
                      onClick={() => { setShowImage(false); setImageUrl(''); }}
                      aria-label="Убрать изображение"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ) : null}
                {imageUrl.trim() ? (
                  <div className={styles.imagePreview}><img src={imageUrl.trim()} alt="" /></div>
                ) : null}

                <div className={styles.composerRow}>
                  <button
                    type="button"
                    className={`${styles.iconBtn} ${showImage ? styles.iconBtnOn : ''}`}
                    onClick={() => setShowImage((v) => !v)}
                    aria-label="Прикрепить изображение по ссылке"
                    title="Прикрепить изображение по ссылке"
                  >
                    <ImagePlus size={18} />
                  </button>
                  {isMod ? (
                    <button
                      type="button"
                      className={`${styles.iconBtn} ${styles.formatToggle}`}
                      onClick={() => setPlainText((v) => !v)}
                      aria-label={plainText ? 'Разрешить форматирование (markdown)' : 'Отправить как обычный текст'}
                      title={plainText ? 'Разрешить форматирование (markdown)' : 'Отправить как обычный текст'}
                    >
                      {plainText ? <Type size={18} /> : <Sparkles size={18} />}
                    </button>
                  ) : null}
                  <textarea
                    ref={inputRef}
                    className={styles.input}
                    placeholder={editing ? 'Изменить сообщение…' : 'Сообщение…'}
                    value={text}
                    rows={1}
                    maxLength={MAX_LEN}
                    onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
                    onKeyDown={onInputKeyDown}
                  />
                  <button
                    type="button"
                    className={styles.sendBtn}
                    onClick={() => void send()}
                    disabled={sending || (!text.trim() && !imageUrl.trim() && !editing)}
                    aria-label={editing ? 'Сохранить' : 'Отправить'}
                  >
                    {editing ? <Check size={18} /> : <Send size={18} />}
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.blocked}>
                {thread.block_reason || 'Отправка сообщений этому пользователю недоступна.'}
              </div>
            )}
          </>
        ) : (
          <div className={styles.center}><Spinner /></div>
        )}
      </section>

      {menu && typeof document !== 'undefined'
        ? createPortal(
        <div
          className={styles.menu}
          style={{ top: Math.min(menu.y, window.innerHeight - 180), left: Math.min(menu.x, window.innerWidth - 190) }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {thread?.can_send && !menu.msg.is_deleted ? (
            <button type="button" className={styles.menuItem} onClick={() => startReply(menu.msg)}>
              <CornerUpLeft size={15} /> Ответить
            </button>
          ) : null}
          {menu.msg.body && !menu.msg.is_deleted ? (
            <button type="button" className={styles.menuItem} onClick={() => copyText(menu.msg)}>
              <Copy size={15} /> Копировать
            </button>
          ) : null}
          {menu.msg.mine && !menu.msg.is_deleted ? (
            <button type="button" className={styles.menuItem} onClick={() => startEdit(menu.msg)}>
              <Pencil size={15} /> Изменить
            </button>
          ) : null}
          {menu.msg.mine && !menu.msg.is_deleted ? (
            <button
              type="button"
              className={`${styles.menuItem} ${styles.menuDanger}`}
              onClick={() => deleteMessage(menu.msg.id)}
            >
              <Trash2 size={15} /> Удалить
            </button>
          ) : null}
        </div>,
        document.body
        )
        : null}

      <ImageViewer src={viewerSrc} open={viewerSrc !== null} onClose={() => setViewerSrc(null)} />
    </div>
  );
}
