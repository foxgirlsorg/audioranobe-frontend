'use client';

import { useEffect, useState } from 'react';
import { BookHeadphones, Clock, Loader2, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import type { OrderStatus, RequestableTitle } from '@/lib/types';
import { useRequestNarration } from '@/lib/requestNarration';
import styles from './RequestableTitles.module.css';

/**
 * Titles not in the catalog yet. Each can be requested for AI narration, which
 * adds the title and starts synthesising chapters. Orders are limited to one per
 * day — a countdown shows when the next one becomes available.
 */
export default function RequestableTitles({ items }: { items: RequestableTitle[] }) {
  const { request, pendingSlug } = useRequestNarration();
  const [status, setStatus] = useState<OrderStatus | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    api<OrderStatus>('/titles/request-narration')
      .then((s) => alive && setStatus(s))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pendingSlug]);

  const nextMs = status?.next_at ? new Date(status.next_at).getTime() : 0;
  const blocked = status?.authenticated === true && status.can_order === false && nextMs > now;

  useEffect(() => {
    if (!blocked) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [blocked]);

  if (!items || items.length === 0) return null;

  const disabled = pendingSlug !== null || blocked;

  return (
    <section className={styles.wrap}>
      <div className={styles.head}>
        <span className="eyebrow">
          <Sparkles size={12} /> Ещё нет в библиотеке
        </span>
        <h2 className={styles.title}>Можно заказать озвучку</h2>
        <p className={styles.hint}>
          Этих книг пока нет в каталоге. Закажите ИИ-озвучку — и главы начнут появляться.
        </p>
        {blocked ? (
          <div className={styles.cooldown}>
            <Clock size={13} />
            Следующий заказ будет доступен через {formatCountdown(nextMs - now)}
          </div>
        ) : null}
      </div>

      <div className={styles.grid}>
        {items.map((it) => {
          const busy = pendingSlug === it.ref;
          const meta = [it.year ? String(it.year) : null, it.status || null]
            .filter(Boolean)
            .join(' · ');
          return (
            <div key={it.ref} className={`glass-panel ${styles.card}`}>
              <div className={styles.cover}>
                {it.cover_url ? (
                  <img src={it.cover_url} alt="" loading="lazy" />
                ) : (
                  <span className={styles.coverEmpty}>
                    <BookHeadphones size={22} />
                  </span>
                )}
              </div>
              <div className={styles.body}>
                <span className={styles.name} title={it.name}>
                  {it.name}
                </span>
                {meta ? <span className={styles.meta}>{meta}</span> : null}
                <button
                  type="button"
                  className={`btn btn-primary ${styles.btn}`}
                  onClick={() => request(it.ref)}
                  disabled={disabled}
                >
                  {busy ? (
                    <>
                      <Loader2 size={14} className={styles.spin} /> Заказываем…
                    </>
                  ) : (
                    !blocked && (
                      <>
                        <BookHeadphones size={14} /> Заказать
                      </>
                    )
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h} ч ${pad(m)} мин` : `${pad(m)}:${pad(s)}`;
}
