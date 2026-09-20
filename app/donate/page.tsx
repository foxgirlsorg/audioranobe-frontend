'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Heart, ExternalLink, AtSign, Award } from 'lucide-react';
import { errMsg } from '@/lib/toast';
import {
  fetchDonateConfig,
  fetchRecentDonations,
  SERVICE_LABEL,
  type DonateConfig,
  type RecentDonation,
} from '@/lib/donate';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import GoalBar from '@/components/GoalBar/GoalBar';
import styles from './donate.module.css';

const SERVICES = [
  {
    key: 'kofi' as const,
    name: 'Ko-fi',
    region: 'Карты · PayPal',
    hint: 'Разовая поддержка или ежемесячная подписка.',
  },
  {
    key: 'boosty' as const,
    name: 'Boosty',
    region: 'Банковские карты',
    hint: 'Разовая поддержка или подписка.',
  },
];

export default function DonatePage() {
  const [cfg, setCfg] = useState<DonateConfig | null>(null);
  const [recent, setRecent] = useState<RecentDonation[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    fetchDonateConfig()
      .then((d) => alive && setCfg(d))
      .catch((e) => alive && setError(errMsg(e)));
    fetchRecentDonations()
      .then((d) => alive && setRecent(d.items))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const available = SERVICES.filter((s) => cfg && cfg[s.key]);

  return (
    <div className={styles.wrap}>
      <Link href="/" className="back-link">
        <ArrowLeft size={14} />
        {'На главную'}
      </Link>

      <h1 className={styles.title}>
        {'Поддержать'} <span className={styles.titleAccent}>{'проект'}</span>
      </h1>
      <p className={styles.lead}>
        {'AudioRanobe живёт на пожертвования. Любая сумма помогает оплачивать серверы и хранилище.'}
      </p>

      {error ? (
        <EmptyState title="Не удалось загрузить" body={error} />
      ) : !cfg ? (
        <div className={styles.center}>
          <Spinner />
        </div>
      ) : (
        <>
          {cfg.goal.enabled ? (
            <div className={`glass-panel ${styles.goalPanel}`}>
              <GoalBar goal={cfg.goal} />
            </div>
          ) : null}

          <div className={`glass-panel ${styles.instruction}`}>
            <AtSign size={18} className={styles.instructionIcon} aria-hidden="true" />
            <p>
              {'Укажите свой ник на сайте в комментарии к платежу — так пожертвование привяжется к вашему аккаунту.'}
            </p>
          </div>

          {available.length === 0 ? (
            <EmptyState title="Пока нет способов" body="Способы пожертвования ещё не настроены." />
          ) : (
            <div className={styles.grid}>
              {available.map((s) => (
                <a
                  key={s.key}
                  href={cfg[s.key]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`glass-panel ${styles.card}`}
                >
                  <div className={styles.cardHead}>
                    <Heart size={18} className={styles.cardIcon} aria-hidden="true" />
                    <span className={styles.cardName}>{s.name}</span>
                    <ExternalLink size={14} className={styles.cardExt} aria-hidden="true" />
                  </div>
                  <span className={styles.cardRegion}>{s.region}</span>
                  <span className={styles.cardHint}>{s.hint}</span>
                </a>
              ))}
            </div>
          )}

          <div className={styles.badgeNote}>
            <Award size={15} aria-hidden="true" />
            <span>
              {`Пожертвование от $${cfg.badge_min} даёт бейдж «Донатер» на вашем профиле.`}
            </span>
          </div>

          {recent.length > 0 ? (
            <div className={styles.recent}>
              <h2 className={styles.recentTitle}>{'Последние пожертвования'}</h2>
              <div className={`glass-panel ${styles.recentList}`}>
                {recent.map((r, i) => (
                  <div key={i} className={styles.recentItem}>
                    <span className={styles.recentName}>{r.name}</span>
                    <span className={styles.recentService}>{SERVICE_LABEL[r.service] ?? r.service}</span>
                    <span className={styles.recentAmount}>
                      {r.amount} {r.currency}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
