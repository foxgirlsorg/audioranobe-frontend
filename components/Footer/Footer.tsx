'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { Download, Mail, Smartphone } from 'lucide-react';
import { TelegramIcon } from '@/components/SocialLinks/brands';
import { SUPPORT_EMAIL, SUPPORT_BOT, SUPPORT_CHANNEL } from '@/lib/support';
import { useEnsureConfig, type SiteLinks } from '@/lib/config';
import { APP_VERSION, APP_VERSION_NAME } from '@/lib/version';
import { fetchDonateConfig, type DonateGoal } from '@/lib/donate';
import GoalBar from '@/components/GoalBar/GoalBar';
import styles from './Footer.module.css';

const NAV = [
  { href: '/catalog', label: 'Каталог' },
  { href: '/collections', label: 'Коллекции' },
  { href: '/news', label: 'Новости' },
  { href: '/donate', label: 'Поддержать' },
  { href: '/dev', label: 'Для разработчиков' },
];

const LEGAL = [
  { href: '/legal/rules', label: 'Правила' },
  { href: '/legal/terms', label: 'Условия' },
  { href: '/legal/privacy', label: 'Конфиденциальность' },
  { href: '/dmca', label: 'DMCA' },
];

const DEFAULT_LINKS: SiteLinks = {
  support_email: SUPPORT_EMAIL,
  support_bot: SUPPORT_BOT,
  support_channel: SUPPORT_CHANNEL,
  org_url: 'https://foxgirls.org',
  fdroid_url: '',
  apk_url: '',
};

function orgLabel(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export default function Footer() {
  const year = new Date().getFullYear();
  const links = useEnsureConfig()?.links ?? DEFAULT_LINKS;
  const hasApp = !!(links.fdroid_url || links.apk_url);
  const [goal, setGoal] = useState<DonateGoal | null>(null);

  useEffect(() => {
    let alive = true;
    fetchDonateConfig()
      .then((d) => alive && d.goal.enabled && setGoal(d.goal))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.foxgirlWrap}`} aria-hidden="true">
        <img src="/foxgirl_user.svg" alt="" className={styles.foxgirl} />
      </div>
      <div className={`container ${styles.inner}`}>
        <div className={styles.brand}>
          <Link href="/" className={styles.logo}>
            AUDIO<span className={styles.logoAccent}>RANOBE</span>
          </Link>
          <p className={styles.disclaimer}>
            {
              'Все материалы размещены пользователями предоставлены, исключительно для бесплатного ознакомления. Мы не владеем размещённым контентом и не несём за него ответственности.'
            }
          </p>
          {goal ? (
            <div className={styles.goal}>
              <GoalBar goal={goal} compact />
            </div>
          ) : null}
          {hasApp ? (
            <div className={styles.apps}>
              {links.fdroid_url ? (
                <a href={links.fdroid_url} target="_blank" rel="noopener noreferrer" className={styles.appCard}>
                  <Smartphone size={20} className={styles.appIcon} />
                  <span className={styles.appText}>
                    <span className={styles.appHint}>{'Скачать в'}</span>
                    <span className={styles.appName}>{'F-Droid'}</span>
                  </span>
                </a>
              ) : null}
              {links.apk_url ? (
                <a href={links.apk_url} download className={styles.appCard}>
                  <Download size={20} className={styles.appIcon} />
                  <span className={styles.appText}>
                    <span className={styles.appHint}>{'Скачать'}</span>
                    <span className={styles.appName}>{'APK'}</span>
                  </span>
                </a>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className={styles.cols}>
          <nav className={styles.col} aria-label={'Разделы сайта'}>
            <span className={styles.colTitle}>{'Сайт'}</span>
            {NAV.map((l) => (
              <Link key={l.href} href={l.href} className={styles.link}>
                {l.label}
              </Link>
            ))}
          </nav>

          <nav className={styles.col} aria-label={'Документы'}>
            <span className={styles.colTitle}>{'Документы'}</span>
            {LEGAL.map((l) => (
              <Link key={l.href} href={l.href} className={styles.link} prefetch={false}>
                {l.label}
              </Link>
            ))}
          </nav>

          {links.support_email || links.support_bot || links.support_channel ? (
            <div className={styles.col}>
              <span className={styles.colTitle}>{'Связь'}</span>
              {links.support_email ? (
                <a href={`mailto:${links.support_email}`} className={styles.contact}>
                  <Mail size={14} />
                  {links.support_email}
                </a>
              ) : null}
              {links.support_bot ? (
                <a href={links.support_bot} target="_blank" rel="noopener noreferrer" className={styles.contact}>
                  <TelegramIcon size={14} />
                  {'Поддержка'}
                </a>
              ) : null}
              {links.support_channel ? (
                <a href={links.support_channel} target="_blank" rel="noopener noreferrer" className={styles.contact}>
                  <TelegramIcon size={14} />
                  {'Канал'}
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className={`container ${styles.bottom}`}>
        <span className={styles.bottomLeft}>
          <span className={styles.copy}>{`© ${year} AudioRanobe`}</span>
          <span className={styles.version}>{`v${APP_VERSION} «${APP_VERSION_NAME}»`}</span>
        </span>
        {links.org_url ? (
          <a href={links.org_url} target="_blank" rel="noopener noreferrer" className={styles.copyLink}>
            {orgLabel(links.org_url)}
          </a>
        ) : null}
      </div>
    </footer>
  );
}
