import React from 'react';
import { chapterLabel } from '@/lib/format';
import type { Illustration } from '@/lib/types';

/** "Том 1 · Пробуждение" / "Том 2 · Глава 14" — or null for a title-wide one. */
export function chapterLine(ill: Illustration, volumeLabel = 'Том'): string | null {
  const ch = ill.chapter;
  if (!ch) return null;
  return `${volumeLabel} ${ch.volume_number} · ${chapterLabel(ch.number, ch.number_end, ch.name)}`;
}

/**
 * What the image viewer shows along the bottom: the caption, then where the
 * illustration belongs. Null when there is nothing to say, so the viewer
 * draws no bar at all.
 */
export function viewerOverlay(ill: Illustration, withChapter = true, volumeLabel = 'Том'): React.ReactNode {
  const where = withChapter ? chapterLine(ill, volumeLabel) : null;
  if (!ill.caption && !where) return null;
  return (
    <>
      {ill.caption ? <strong>{ill.caption}</strong> : null}
      {where ? <span>{where}</span> : null}
    </>
  );
}

export interface IllustrationGroup {
  key: string;
  /** Null for the title-wide group. */
  heading: string | null;
  items: Illustration[];
}

/**
 * Title-wide illustrations first, then one group per chapter in reading order
 * (volume, then chapter number). Editor order is kept within each group.
 */
export function groupIllustrations(items: Illustration[], volumeLabel = 'Том'): IllustrationGroup[] {
  const general: Illustration[] = [];
  const byChapter = new Map<number, Illustration[]>();
  for (const ill of items) {
    if (ill.chapter_id == null) general.push(ill);
    else byChapter.set(ill.chapter_id, [...(byChapter.get(ill.chapter_id) ?? []), ill]);
  }
  const chapters = [...byChapter.values()].sort((a, b) => {
    const ca = a[0].chapter!;
    const cb = b[0].chapter!;
    return ca.volume_number - cb.volume_number || ca.number - cb.number;
  });
  return [
    ...(general.length > 0 ? [{ key: 'title', heading: null, items: general }] : []),
    ...chapters.map((list) => ({
      key: `ch-${list[0].chapter_id}`,
      heading: chapterLine(list[0], volumeLabel),
      items: list,
    })),
  ];
}
