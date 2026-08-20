'use client';

import React, { useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import {
  Bold,
  Code,
  Eye,
  EyeOff,
  Heading,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  Youtube,
  type LucideIcon,
} from 'lucide-react';
import Markdown from '@/components/Markdown/Markdown';
import Modal from '@/components/Modal/Modal';
import styles from './MarkdownEditor.module.css';

type Action =
  | { kind: 'wrap'; before: string; after: string }
  | { kind: 'prefix'; prefix: string }
  | { kind: 'ordered' };

interface Tool {
  key: string;
  icon: LucideIcon;
  title: string;
  action: Action;
}

const TOOLS: Tool[] = [
  { key: 'bold', icon: Bold, title: 'Полужирный (Ctrl+B)', action: { kind: 'wrap', before: '**', after: '**' } },
  { key: 'italic', icon: Italic, title: 'Курсив (Ctrl+I)', action: { kind: 'wrap', before: '*', after: '*' } },
  { key: 'strike', icon: Strikethrough, title: 'Зачёркнутый', action: { kind: 'wrap', before: '~~', after: '~~' } },
  { key: 'spoiler', icon: EyeOff, title: 'Спойлер (Ctrl+Shift+S)', action: { kind: 'wrap', before: '||', after: '||' } },
  { key: 'heading', icon: Heading, title: 'Заголовок', action: { kind: 'prefix', prefix: '## ' } },
  { key: 'quote', icon: Quote, title: 'Цитата', action: { kind: 'prefix', prefix: '> ' } },
  { key: 'code', icon: Code, title: 'Код', action: { kind: 'wrap', before: '`', after: '`' } },
  { key: 'ul', icon: List, title: 'Список', action: { kind: 'prefix', prefix: '- ' } },
  { key: 'ol', icon: ListOrdered, title: 'Нумерованный список', action: { kind: 'ordered' } },
];

const GROUP_ENDS = new Set(['spoiler', 'link']);

const SLIM_KEYS = new Set(['bold', 'italic', 'strike', 'spoiler', 'link', 'quote']);

/** Pulls a 11-char YouTube video id out of a watch/short/embed/youtu.be link. */
function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export interface MarkdownEditorHandle {
  textarea: HTMLTextAreaElement | null;
  apply: (key: string) => void;
  focus: () => void;
}

function applyAction(
  action: Action,
  value: string,
  start: number,
  end: number
): { value: string; start: number; end: number } {
  const selected = value.slice(start, end);

  if (action.kind === 'wrap') {
    const { before, after } = action;
    if (
      value.slice(start - before.length, start) === before &&
      value.slice(end, end + after.length) === after
    ) {
      return {
        value:
          value.slice(0, start - before.length) + selected + value.slice(end + after.length),
        start: start - before.length,
        end: end - before.length,
      };
    }
    return {
      value: value.slice(0, start) + before + selected + after + value.slice(end),
      start: start + before.length,
      end: start + before.length + selected.length,
    };
  }

  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const lineEndIdx = value.indexOf('\n', end);
  const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
  const lines = value.slice(lineStart, lineEnd).split('\n');

  if (action.kind === 'ordered') {
    const numbered = /^\d+\.\s/;
    const allNumbered = lines.every((l) => numbered.test(l));
    const next = allNumbered
      ? lines.map((l) => l.replace(numbered, ''))
      : lines.map((l, i) => `${i + 1}. ${l.replace(numbered, '')}`);
    const block = next.join('\n');
    return {
      value: value.slice(0, lineStart) + block + value.slice(lineEnd),
      start: lineStart,
      end: lineStart + block.length,
    };
  }

  const { prefix } = action;
  const allPrefixed = lines.every((l) => l.startsWith(prefix));
  const next = allPrefixed
    ? lines.map((l) => l.slice(prefix.length))
    : lines.map((l) => `${prefix}${l}`);
  const block = next.join('\n');
  return {
    value: value.slice(0, lineStart) + block + value.slice(lineEnd),
    start: lineStart,
    end: lineStart + block.length,
  };
}

export default function MarkdownEditor({
  value,
  onChange,
  placeholder,
  maxLength,
  rows,
  autoFocus = false,
  variant = 'full',
  media,
  handleRef,
  overlay,
  footer,
  onKeyDown,
  onSelect,
  onClick,
  ariaLabel,
  ariaLabelledBy,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
  autoFocus?: boolean;
  variant?: 'full' | 'slim';
  media?: 'image' | 'video' | 'both';
  handleRef?: React.MutableRefObject<MarkdownEditorHandle | null>;
  overlay?: React.ReactNode;
  footer?: React.ReactNode;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSelect?: () => void;
  onClick?: () => void;
  ariaLabel?: string;
  ariaLabelledBy?: string;
}) {
  const slim = variant === 'slim';
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [preview, setPreview] = useState(false);
  const pendingSel = useRef<[number, number] | null>(null);
  const [urlPrompt, setUrlPrompt] = useState<'image' | 'video' | null>(null);
  const [urlValue, setUrlValue] = useState('');
  const [urlError, setUrlError] = useState('');

  useLayoutEffect(() => {
    const sel = pendingSel.current;
    if (!sel) return;
    pendingSel.current = null;
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(sel[0], sel[1]);
  });

  function run(action: Action) {
    const el = ref.current;
    if (!el) return;
    const res = applyAction(action, value, el.selectionStart ?? 0, el.selectionEnd ?? 0);
    if (maxLength != null && res.value.length > maxLength) return;
    pendingSel.current = [res.start, res.end];
    onChange(res.value);
  }

  function insertAtCursor(text: string) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const next = value.slice(0, start) + text + value.slice(end);
    if (maxLength != null && next.length > maxLength) return;
    pendingSel.current = [start + text.length, start + text.length];
    onChange(next);
  }

  function submitImage() {
    const url = urlValue.trim();
    if (!/^https?:\/\//i.test(url)) {
      setUrlError('Ссылка должна начинаться с http:// или https://');
      return;
    }
    insertAtCursor(`![Описание](${url} "640xauto")`);
    setUrlPrompt(null);
    setUrlValue('');
    setUrlError('');
  }

  function submitVideo() {
    const id = youtubeId(urlValue.trim());
    if (!id) {
      setUrlError('Не удалось распознать ссылку на YouTube');
      return;
    }
    insertAtCursor(`\n\n@[youtube](${id})\n\n`);
    setUrlPrompt(null);
    setUrlValue('');
    setUrlError('');
  }

  useImperativeHandle(
    handleRef as React.Ref<MarkdownEditorHandle>,
    () => ({
      get textarea() {
        return ref.current;
      },
      apply(key: string) {
        const tool = TOOLS.find((t) => t.key === key);
        if (tool) run(tool.action);
      },
      focus() {
        ref.current?.focus();
      },
    }),
    [value, maxLength]
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.ctrlKey || e.metaKey) {
      const k = e.key.toLowerCase();
      const shortcut =
        k === 'b' ? 'bold' : k === 'i' ? 'italic' : k === 'k' ? 'link' : e.shiftKey && k === 's' ? 'spoiler' : null;
      if (shortcut) {
        e.preventDefault();
        const tool = TOOLS.find((t) => t.key === shortcut)!;
        run(tool.action);
        return;
      }
    }
    onKeyDown?.(e);
  }

  const over = maxLength != null && value.length > maxLength;

  const toolButtons = (slim ? TOOLS.filter((t) => SLIM_KEYS.has(t.key)) : TOOLS).map((t) => (
    <React.Fragment key={t.key}>
      <button
        type="button"
        className={t.key === 'spoiler' ? `${styles.tool} ${styles.toolSpoiler}` : styles.tool}
        title={t.title}
        aria-label={t.title}
        disabled={preview}
        onClick={() => run(t.action)}
        onMouseDown={(e) => e.preventDefault()}
      >
        <t.icon size={14} />
      </button>
      {!slim && GROUP_ENDS.has(t.key) ? (
        <span className={styles.sep} aria-hidden="true" />
      ) : null}
    </React.Fragment>
  ));

  const previewButton = (
    <button
      type="button"
      className={preview ? `${styles.tool} ${styles.toolOn}` : styles.tool}
      onClick={() => setPreview((p) => !p)}
      title={preview ? 'Вернуться к редактированию' : 'Предпросмотр'}
      aria-label={preview ? 'Вернуться к редактированию' : 'Предпросмотр'}
      aria-pressed={preview}
    >
      <Eye size={14} />
      {slim ? null : (
        <span className={styles.toolText}>{preview ? 'Правка' : 'Просмотр'}</span>
      )}
    </button>
  );

  const mediaButtons = (
    !slim && media ? (
      <>
        <span className={styles.sep} aria-hidden="true" />
        {media === 'image' || media === 'both' ? (
          <button
            type="button"
            className={styles.tool}
            title="Вставить изображение (ссылка на картинку)"
            aria-label="Вставить изображение"
            disabled={preview}
            onClick={() => {
              setUrlValue('');
              setUrlError('');
              setUrlPrompt('image');
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <ImageIcon size={14} />
          </button>
        ) : null}
        {media === 'video' || media === 'both' ? (
          <button
            type="button"
            className={styles.tool}
            title="Вставить видео с YouTube"
            aria-label="Вставить видео с YouTube"
            disabled={preview}
            onClick={() => {
              setUrlValue('');
              setUrlError('');
              setUrlPrompt('video');
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <Youtube size={14} />
          </button>
        ) : null}
      </>
    ) : null
  );

  return (
    <div className={`${styles.editor} ${slim ? styles.slim : styles.full}`}>
      {slim ? null : (
        <div className={styles.toolbar}>
          {toolButtons}
          {mediaButtons}
          <span className={styles.spacer} />
          {previewButton}
        </div>
      )}

      <div className={styles.inputWrap}>
        {preview ? (
          <div className={styles.preview}>
            {value.trim() ? (
              <Markdown source={value} compact media={media} />
            ) : (
              <span className={styles.previewEmpty}>Нечего показать — текст пуст.</span>
            )}
          </div>
        ) : (
          <textarea
            ref={ref}
            className={styles.input}
            value={value}
            placeholder={placeholder}
            rows={rows ?? (slim ? 3 : 10)}
            autoFocus={autoFocus}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onSelect={onSelect}
            onClick={onClick}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
          />
        )}
        {preview ? null : overlay}
      </div>

      <div className={styles.footer}>
        {slim ? (
          <span className={styles.slimTools}>
            {toolButtons}
            <span className={styles.sep} aria-hidden="true" />
            {previewButton}
          </span>
        ) : (
          <span className={styles.hint}>
            Markdown{' '}
            <span className={styles.hintDim}>· ||спойлер|| · @упоминание · Ctrl+Enter</span>
          </span>
        )}
        {maxLength != null ? (
          <span className={over ? `${styles.count} ${styles.countOver}` : styles.count}>
            {value.length}/{maxLength}
          </span>
        ) : null}
        <span className={styles.spacer} />
        {footer}
      </div>

      <Modal
        open={urlPrompt !== null}
        onClose={() => {
          setUrlPrompt(null);
          setUrlValue('');
          setUrlError('');
        }}
        title={urlPrompt === 'video' ? 'Вставить видео с YouTube' : 'Вставить изображение'}
      >
        <div className={styles.promptBody}>
          {urlPrompt === 'video' ? (
            <p className={styles.promptHint}>
              Ссылка на видео YouTube. В текст встанет компактный плеер.
            </p>
          ) : (
            <p className={styles.promptHint}>
              Прямая ссылка на картинку. Ширина по умолчанию 640px — поменяйте её прямо в тексте,
              если нужно (высота подстроится под пропорции картинки).
            </p>
          )}
          <input
            className={`input ${urlError ? styles.promptInputError : ''}`}
            type="url"
            value={urlValue}
            autoFocus
            placeholder={urlPrompt === 'video' ? 'https://youtu.be/…' : 'https://…'}
            onChange={(e) => {
              setUrlValue(e.target.value);
              if (urlError) setUrlError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (urlPrompt === 'video') submitVideo();
                else submitImage();
              }
            }}
          />
          {urlError ? <p className={styles.promptError}>{urlError}</p> : null}
          <div className={styles.promptActions}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setUrlPrompt(null);
                setUrlValue('');
                setUrlError('');
              }}
            >
              {'Отмена'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (urlPrompt === 'video') submitVideo();
                else submitImage();
              }}
            >
              {'Вставить'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
