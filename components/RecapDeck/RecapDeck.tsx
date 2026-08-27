'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Download, Headphones, Sparkles } from 'lucide-react';
import { useToast, errMsg } from '@/lib/toast';
import { downloadNodePng } from '@/lib/exportImage';
import type { Recap } from '@/lib/types';
import styles from './RecapDeck.module.css';

function ruPlural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

const MONTH_PALETTE = [
  'linear-gradient(160deg, #2a1622, #de6161)',
  'linear-gradient(160deg, #1a1030, #6d4bd0)',
  'linear-gradient(160deg, #101c2e, #2f7fd0)',
  'linear-gradient(160deg, #221528, #b0479a)',
  'linear-gradient(160deg, #17251a, #3fa86a)',
];

type Card = { body?: React.ReactNode; custom?: React.ReactNode };

export default function RecapDeck({
  recap,
  finale,
}: {
  recap: Recap;
  finale?: React.ReactNode;
}) {
  const { toast } = useToast();
  const [idx, setIdx] = useState(0);
  const customRef = useRef<HTMLDivElement | null>(null);

  const accent = '#de6161';
  const bgAt = (i: number) => MONTH_PALETTE[i % MONTH_PALETTE.length];

  const download = async () => {
    // Export just the admin card host, not the 9/16 deck frame around it.
    const node = customRef.current?.firstElementChild as HTMLElement | null;
    if (!node) return;
    try {
      await downloadNodePng(node, `recap-${recap.period_label}`);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  const baseCards = useMemo<Card[]>(() => {
    if (recap.total_seconds <= 0) return [];
    const hours = Math.floor(recap.total_seconds / 3600);
    const mins = Math.floor((recap.total_seconds % 3600) / 60);
    const timeBig = hours > 0 ? `${hours}` : `${mins}`;
    const timeUnit =
      hours > 0 ? ruPlural(hours, ['час', 'часа', 'часов']) : ruPlural(mins, ['минута', 'минуты', 'минут']);

    const out: Card[] = [];
    out.push({
      body: (
        <>
          <Sparkles size={40} className={styles.heroIcon} />
          <p className={styles.kicker}>
            {recap.display_name || recap.username}
            {recap.username ? ` · @${recap.username}` : ''}
          </p>
          <h1 className={styles.hero}>{recap.period_label}</h1>
          <p className={styles.sub}>{'Листайте дальше →'}</p>
        </>
      ),
    });
    out.push({
      body: (
        <>
          <p className={styles.kicker}>{'Вы слушали'}</p>
          <div className={styles.bigNum}>{timeBig}</div>
          <p className={styles.bigUnit}>{timeUnit}</p>
          <p className={styles.sub}>
            {`${recap.files_count} ${ruPlural(recap.files_count, ['глава', 'главы', 'глав'])} · за ${recap.active_days} ${ruPlural(recap.active_days, ['день', 'дня', 'дней'])}`}
            {recap.books_finished > 0
              ? ` · ${recap.books_finished} ${ruPlural(recap.books_finished, ['тайтл целиком', 'тайтла целиком', 'тайтлов целиком'])}`
              : ''}
          </p>
        </>
      ),
    });
    if (recap.top_titles.length > 0) {
      out.push({
        body: (
          <>
            <p className={styles.kicker}>{'Больше всего слушали'}</p>
            <ol className={styles.rankList}>
              {recap.top_titles.map((t, i) => (
                <li key={t.slug} className={styles.rankRow}>
                  <span className={styles.rankNum}>{i + 1}</span>
                  <span className={styles.rankArt}>
                    {t.cover_url ? <img src={t.cover_url} alt="" /> : <Headphones size={16} />}
                  </span>
                  <Link href={`/title/${t.slug}`} className={styles.rankName} title={t.name}>
                    {t.name}
                  </Link>
                  <span className={styles.rankTime}>{Math.max(1, Math.round(t.seconds / 60))} мин</span>
                </li>
              ))}
            </ol>
          </>
        ),
      });
    }
    if (recap.top_narrators.length > 0) {
      const top = recap.top_narrators[0];
      out.push({
        body: (
          <>
            <p className={styles.kicker}>{'Ваш чтец'}</p>
            <h2 className={styles.hero}>
              <Link href={`/narrator/${top.slug}`} className={styles.heroLink}>
                {top.name}
              </Link>
            </h2>
            <p className={styles.sub}>
              {`${Math.max(1, Math.round(top.seconds / 60))} ${ruPlural(Math.round(top.seconds / 60), ['минута', 'минуты', 'минут'])} вместе`}
            </p>
            {recap.top_narrators.length > 1 ? (
              <ol className={styles.chipList}>
                {recap.top_narrators.slice(1).map((n) => (
                  <li key={n.id}>
                    <Link href={`/narrator/${n.slug}`} className={styles.chip}>
                      {n.name}
                    </Link>
                  </li>
                ))}
              </ol>
            ) : null}
          </>
        ),
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recap]);

  const cards = finale ? [...baseCards, { custom: finale }] : baseCards;
  const total = cards.length;
  const go = useCallback((d: number) => setIdx((i) => Math.min(total - 1, Math.max(0, i + d))), [total]);

  useEffect(() => {
    if (total === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, total]);

  if (total === 0) return null;

  return (
    <div className={styles.deck}>
      <div className={styles.dots}>
        {cards.map((_, i) => (
          <span
            key={i}
            className={styles.dot}
            style={i === idx ? { background: accent } : undefined}
          />
        ))}
      </div>
      <div
        className={styles.card}
        style={cards[idx].custom ? { background: '#141416' } : { backgroundImage: bgAt(idx) }}
        key={idx}
      >
        {cards[idx].custom ? (
          <>
            <div className={styles.customWrap} ref={customRef}>{cards[idx].custom}</div>
            <div className={styles.customActions}>
              <button type="button" className={styles.customBtn} onClick={() => void download()}>
                <Download size={15} /> {'Скачать'}
              </button>
            </div>
          </>
        ) : (
          <div className={styles.cardInner}>{cards[idx].body}</div>
        )}
        <button
          type="button"
          className={`${styles.navZone} ${styles.navLeft}`}
          onClick={() => go(-1)}
          aria-label={'Назад'}
          disabled={idx === 0}
        >
          <ChevronLeft size={20} />
        </button>
        <button
          type="button"
          className={`${styles.navZone} ${styles.navRight}`}
          onClick={() => go(1)}
          aria-label={'Дальше'}
          disabled={idx === total - 1}
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
