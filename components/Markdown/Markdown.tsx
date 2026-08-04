'use client';

import React, { useCallback, useMemo } from 'react';
import { marked } from 'marked';

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
    /(?<![\wА-Яа-яЁё])@([A-Za-zА-Яа-яЁё0-9_]{3,30})/g,
    '<a class="md-mention" href="/user/$1" target="_blank" rel="noopener noreferrer">@$1</a>',
  );
}

const YOUTUBE_ID_RE = /@\[youtube\]\(\s*([A-Za-z0-9_-]{6,})\s*\)/;

/**
 * ![alt](url "WxH")   -> <img width height> — explicit pixel size
 * ![alt](url "Wxauto") -> <img width>        — fixed width, height follows ratio
 */
const SIZED_IMG_RE =
  /!\[([^\]]*)\]\(\s*([^\s")]+)\s+"(\d+)\s*[x×]\s*(?:(\d+)|auto)"\s*\)/;

/**
 * Sized images and YouTube embeds, turned into HTML before marked parses.
 * The editor writes these shapes and shows them in the textarea; the markdown
 * stays in the database and only becomes HTML here, at render time.
 *
 *   ![alt](url "640xauto")     -> <img width=640>       (media includes image)
 *   @[youtube](VIDEO_ID)       -> YouTube iframe        (media includes video)
 */
function preprocessMedia(md: string, media: 'image' | 'video' | 'both'): string {
  let out = md;
  if (media === 'image' || media === 'both') {
    out = out.replace(
      SIZED_IMG_RE,
      (_m, alt, url, w, h) => {
        const size = h
          ? `width="${w}" height="${h}"`
          : `width="${w}"`;
        return `<img src="${url}" alt="${alt}" ${size} loading="lazy">`;
      },
    );
  }
  if (media === 'video' || media === 'both') {
    out = out.replace(
      YOUTUBE_ID_RE,
      (_m, id) =>
        `\n\n<div class="md-video"><iframe src="https://www.youtube-nocookie.com/embed/${id}" ` +
        'title="YouTube" frameborder="0" ' +
        'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" ' +
        'referrerpolicy="strict-origin-when-cross-origin" allowfullscreen loading="lazy"></iframe></div>\n\n',
    );
  }
  return out;
}

export default function Markdown({
  source,
  compact = false,
  media,
}: {
  source: string;
  compact?: boolean;
  media?: 'image' | 'video' | 'both';
}) {
  const html = useMemo(() => {
    const prepared = media ? preprocessMedia(source, media) : source;
    return marked.parse(preprocessMentions(prepared)) as string;
  }, [source, media]);

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
