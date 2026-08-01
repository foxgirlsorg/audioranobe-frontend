'use client';

import React, { useCallback, useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({
  breaks: true,
  gfm: true,
});

marked.use({
  extensions: [
    {
      name: 'spoiler',
      level: 'inline',
      start: (src: string) => src.indexOf('||'),
      tokenizer(src: string) {
        const m = /^\|\|([\s\S]+?)\|\|/.exec(src);
        if (!m) return undefined;
        return {
          type: 'spoiler',
          raw: m[0],
          text: m[1],
          tokens: this.lexer.inlineTokens(m[1]),
        };
      },
      renderer(token: { tokens?: never[] }) {
        const inner = this.parser.parseInline(token.tokens ?? []);
        return `<span class="md-spoiler" role="button" tabindex="0">${inner}</span>`;
      },
    },
  ],
} as Parameters<typeof marked.use>[0]);

function headingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

marked.use({
  renderer: {
    heading(token: { tokens: unknown[]; depth: number }): string {
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
      ADD_ATTR: ['target', 'rel', 'class', 'id', 'role', 'tabindex'],
    } as Parameters<typeof DOMPurify.sanitize>[1]);
  }, [source]);

  const reveal = useCallback((e: React.SyntheticEvent<HTMLDivElement>) => {
    const hit = (e.target as HTMLElement | null)?.closest?.('.md-spoiler');
    if (!hit || hit.classList.contains('md-spoiler-open')) return;
    if (e.type === 'keydown') {
      const key = (e.nativeEvent as KeyboardEvent).key;
      if (key !== 'Enter' && key !== ' ') return;
      e.preventDefault();
    }
    hit.classList.add('md-spoiler-open');
    hit.removeAttribute('role');
    hit.removeAttribute('tabindex');
  }, []);

  return (
    <div
      className={`markdown-body${compact ? ' md-compact' : ''}`}
      onClick={reveal}
      onKeyDown={reveal}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
