'use client';

import React, { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import styles from './Markdown.module.css';

marked.setOptions({
  breaks: true,
  gfm: true,
});

/** Anchor slug for headings; kept in sync with the rules page's jump list. */
function headingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

// marked dropped automatic heading ids, so add them back — in-page anchors
// (the rules page section links) depend on them.
marked.use({
  renderer: {
    heading(token: { tokens: unknown[]; depth: number }): string {
      // `this.parser` is injected by marked on the renderer it actually uses,
      // so this has to be a plain method, not a pre-bound function.
      const text = (this as unknown as { parser: { parseInline: (t: unknown[]) => string } })
        .parser.parseInline(token.tokens);
      const id = headingId(text.replace(/<[^>]*>/g, ''));
      const attr = id ? ` id="${id}"` : '';
      return `<h${token.depth}${attr}>${text}</h${token.depth}>\n`;
    },
  } as Parameters<typeof marked.use>[0]['renderer'],
});

function preprocessMentions(md: string): string {
  return md.replace(
    /@([A-Za-zА-Яа-яЁё0-9_]{3,30})/g,
    '<a class="md-mention" href="/user/$1" target="_blank" rel="noopener noreferrer">@$1</a>',
  );
}

/**
 * Renders markdown for every user-authored field on the site.
 *
 * Raw HTML is an admin-only privilege, enforced on the server: lib/Html.php
 * strips tags from anything a non-admin submits, so HTML that reaches the DB
 * was written by an admin. This side is the second check — DOMPurify sanitises
 * whatever is rendered regardless of who wrote it, so a script tag can never
 * execute even if one somehow got stored.
 *
 * `compact` drops the block spacing for inline contexts like comment bodies.
 */
export default function Markdown({
  source,
  compact = false,
}: {
  source: string;
  compact?: boolean;
}) {
  const html = useMemo(() => {
    const rawHtml = marked.parse(preprocessMentions(source)) as string;
    return DOMPurify.sanitize(rawHtml, {
      ADD_TAGS: ['img'],
      ADD_ATTR: ['target', 'rel', 'class', 'id'],
    } as Parameters<typeof DOMPurify.sanitize>[1]);
  }, [source]);

  return (
    <div
      className={`md-body ${styles.md} ${compact ? styles.compact : ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
