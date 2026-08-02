'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { Fragment, useEffect, useRef, useState } from 'react';
import {
  ClipboardList,
  Dices,
  Heart,
  History,
  Library,
  LibraryBig,
  LogOut,
  Menu,
  Mic,
  PenLine,
  Plus,
  Search,
  Settings,
  Shield,
  User,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errMsg, useToast } from '@/lib/toast';
import type { NarratorCard, SearchSuggest } from '@/lib/types';
import NotificationBell from '@/components/NotificationBell/NotificationBell';
import AddContentDialog from '@/components/AddContentDialog/AddContentDialog';
import VerifiedBadge from '@/components/VerifiedBadge/VerifiedBadge';
import styles from './NavBar.module.css';

type SuggestKind = 'title' | 'narrator' | 'author' | 'collection';

type SuggestItem = {
  kind: SuggestKind;
  key: string;
  name: string;
  sub: string;
  href: string;
  cover?: string | null;
  avatar?: string | null;
};

const SUGGEST_GROUPS: { kind: SuggestKind; label: string }[] = [
  { kind: 'title', label: 'Тайтлы' },
  { kind: 'narrator', label: 'Чтецы' },
  { kind: 'author', label: 'Авторы' },
  { kind: 'collection', label: 'Коллекции' },
];

function pluralTitles(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} тайтл`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} тайтла`;
  return `${n} тайтлов`;
}

const NAV_LINKS = [
  { href: '/catalog', label: 'Каталог' },
  { href: '/collections', label: 'Коллекции' },
  { href: '/news', label: 'Новости' },
];

export default function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, logout, isMod } = useAuth();
  const { toast } = useToast();

  const [scrolled, setScrolled] = useState(false);
  const [q, setQ] = useState('');
  const [sug, setSug] = useState<SearchSuggest | null>(null);
  const [sugOpen, setSugOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileQ, setMobileQ] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [myNarrators, setMyNarrators] = useState<NarratorCard[]>([]);

  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const userWrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setSugOpen(false);
    setUserMenuOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setSug(null);
      setSugOpen(false);
      setActiveIdx(-1);
      return;
    }
    const seq = ++seqRef.current;
    const timeout = window.setTimeout(async () => {
      try {
        const res = await api<SearchSuggest>('/search/suggest', { params: { q: query } });
        if (seq !== seqRef.current) return;
        setSug(res);
        setSugOpen(true);
        setActiveIdx(-1);
      } catch {
      }
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [q]);

  useEffect(() => {
    if (!user) {
      setMyNarrators([]);
      return;
    }
    let alive = true;
    api<NarratorCard[]>('/panel/narrators')
      .then((list) => {
        if (alive) setMyNarrators(Array.isArray(list) ? list : []);
      })
      .catch(() => {
      });
    return () => {
      alive = false;
    };
  }, [user]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchWrapRef.current && !searchWrapRef.current.contains(target)) setSugOpen(false);
      if (userWrapRef.current && !userWrapRef.current.contains(target)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const flatItems: SuggestItem[] = sug
    ? [
        ...sug.titles.map<SuggestItem>((t) => ({
          kind: 'title',
          key: `t${t.id}`,
          name: t.name,
          sub: t.author?.name ?? '',
          href: `/title/${t.slug}`,
          cover: t.cover_url,
        })),
        ...sug.narrators.map<SuggestItem>((n) => ({
          kind: 'narrator',
          key: `n${n.id}`,
          name: n.name,
          sub: 'Чтец',
          href: `/narrator/${n.slug}`,
          avatar: n.avatar_url,
        })),
        ...(sug.authors ?? []).map<SuggestItem>((a) => ({
          kind: 'author',
          key: `a${a.id}`,
          name: a.name,
          sub: pluralTitles(a.titles_count),
          href: `/author/${a.id}`,
        })),
        ...(sug.collections ?? []).map<SuggestItem>((c) => ({
          kind: 'collection',
          key: `c${c.id}`,
          name: c.name,
          sub: pluralTitles(c.items_count),
          href: `/collections/${c.id}`,
        })),
      ]
    : [];

  const goToItem = (item: SuggestItem) => {
    setSugOpen(false);
    setActiveIdx(-1);
    inputRef.current?.blur();
    router.push(item.href);
  };

  const submitSearch = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setSugOpen(false);
    setActiveIdx(-1);
    inputRef.current?.blur();
    setMobileOpen(false);
    router.push(`/catalog?q=${encodeURIComponent(trimmed)}`);
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (flatItems.length) {
        setSugOpen(true);
        setActiveIdx((i) => Math.min(i + 1, flatItems.length - 1));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (sugOpen && activeIdx >= 0 && flatItems[activeIdx]) goToItem(flatItems[activeIdx]);
      else submitSearch(q);
    } else if (e.key === 'Escape') {
      setSugOpen(false);
      setActiveIdx(-1);
    }
  };

  const goRandom = async () => {
    try {
      const { slug } = await api<{ slug: string }>('/titles/random');
      setMobileOpen(false);
      router.push(`/title/${slug}`);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  const doLogout = () => {
    setUserMenuOpen(false);
    setMobileOpen(false);
    logout();
    toast('Вы вышли из аккаунта');
    router.push('/');
  };

  const avatar = () =>
    user?.avatar_url ? (
      <img className={styles.avatarImg} src={user.avatar_url} alt={user.username} />
    ) : (
      <span className={styles.avatarFallback}>{user?.username?.charAt(0) || '?'}</span>
    );

  const userLinks = user
    ? [
        { href: `/user/${user.id}`, label: 'Профиль', icon: User },
        { href: '/me/history', label: 'История', icon: History },
        { href: '/me/requests', label: 'Мои заявки', icon: ClipboardList },
        ...(isMod ? [{ href: '/mod', label: 'Модерация', icon: Shield }] : []),
        { href: '/me/settings', label: 'Настройки', icon: Settings },
      ]
    : [];

  const openAdd = () => {
    setUserMenuOpen(false);
    setMobileOpen(false);
    setAddOpen(true);
  };

  return (
    <>
      <header className={`${styles.nav} ${scrolled ? styles.scrolled : ''}`}>
        <div className={styles.inner}>
          <Link href="/" className={styles.logo} aria-label={'Главная AudioRanobe'}>
            AUDIO<span className={styles.logoAccent}>RANOBE</span>
          </Link>

          <nav className={styles.links} aria-label={'Основная навигация'}>
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`${styles.link} ${
                  pathname?.startsWith(l.href) ? styles.linkActive : ''
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className={styles.search} ref={searchWrapRef}>
            <Search className={styles.searchIcon} aria-hidden="true" />
            <input
              ref={inputRef}
              className={styles.searchInput}
              type="text"
              placeholder={'Поиск тайтлов и чтецов…'}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onSearchKeyDown}
              onFocus={() => {
                if (flatItems.length) setSugOpen(true);
              }}
              aria-label={'Поиск'}
              autoComplete="off"
              spellCheck={false}
            />
            {sugOpen && sug && (
              <div className={styles.dropdown} role="listbox">
                {flatItems.length === 0 && (
                  <div className={styles.emptySug}>{'Ничего не найдено'}</div>
                )}
                {SUGGEST_GROUPS.map((group) => {
                  const first = flatItems.findIndex((it) => it.kind === group.kind);
                  if (first === -1) return null;
                  const items = flatItems.filter((it) => it.kind === group.kind);
                  return (
                    <Fragment key={group.kind}>
                      <div className={styles.groupLabel}>{group.label}</div>
                      {items.map((it, i) => {
                        const idx = first + i;
                        return (
                          <button
                            key={it.key}
                            type="button"
                            className={`${styles.item} ${
                              activeIdx === idx ? styles.itemActive : ''
                            }`}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => goToItem(it)}
                            onMouseEnter={() => setActiveIdx(idx)}
                            role="option"
                            aria-selected={activeIdx === idx}
                          >
                            {it.kind === 'title' ? (
                              it.cover ? (
                                <img className={styles.itemCover} src={it.cover} alt="" />
                              ) : (
                                <span className={styles.itemCover} />
                              )
                            ) : it.kind === 'narrator' ? (
                              it.avatar ? (
                                <img className={styles.itemAvatar} src={it.avatar} alt="" />
                              ) : (
                                <span className={styles.itemAvatar} />
                              )
                            ) : (
                              <span className={styles.itemIcon}>
                                {it.kind === 'author' ? <PenLine size={15} /> : <Library size={15} />}
                              </span>
                            )}
                            <span className={styles.itemBody}>
                              <span className={styles.itemName}>{it.name}</span>
                              {it.sub ? <span className={styles.itemSub}>{it.sub}</span> : null}
                            </span>
                          </button>
                        );
                      })}
                    </Fragment>
                  );
                })}
                {q.trim() && (
                  <button
                    type="button"
                    className={styles.allResults}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => submitSearch(q)}
                  >
                    {`Все результаты по запросу «${q.trim()}»`}
                  </button>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            className={styles.iconBtn}
            onClick={goRandom}
            title={'Случайный тайтл'}
            aria-label={'Случайный тайтл'}
          >
            <Dices />
          </button>

          <div className={styles.authArea}>
            {loading ? (
              <span className={styles.authGhost} aria-hidden="true" />
            ) : user ? (
              <>
                <NotificationBell />
                <div className={styles.userWrap} ref={userWrapRef}>
                  <button
                    type="button"
                    className={styles.avatarBtn}
                    onClick={() => setUserMenuOpen((v) => !v)}
                    aria-label={'Меню аккаунта'}
                    aria-expanded={userMenuOpen}
                  >
                    {avatar()}
                  </button>
                  {userMenuOpen && (
                    <div className={styles.userMenu}>
                      <div className={styles.menuHead}>
                        <span className={styles.menuEyebrow}>{'вы вошли как'}</span>
                        <span className={styles.menuName}>{user.username}</span>
                      </div>
                      <div className={styles.menuSep} />

                      {userLinks.map((l) => (
                        <Link key={l.href} href={l.href} className={styles.menuItem}>
                          <l.icon aria-hidden="true" />
                          {l.label}
                        </Link>
                      ))}

                      <div className={styles.menuSep} />
                      <button type="button" className={styles.menuItem} onClick={openAdd}>
                        <Plus aria-hidden="true" />
                        {'Добавить'}
                      </button>
                      {myNarrators.length > 0 ? (
                          <>
                            <div className={styles.menuSep} />
                            {myNarrators.map((n) => (
                                <Link
                                    key={n.id}
                                    href={`/narrator/${n.slug}`}
                                    className={styles.menuItem}
                                >
                                  {n.avatar_url ? (
                                      <img
                                          src={n.avatar_url}
                                          alt=""
                                          className={styles.menuAvatar}
                                      />
                                  ) : (
                                      <Mic aria-hidden="true" />
                                  )}
                                  <span className={styles.menuNarratorName}>{n.name}</span>
                                  {n.is_verified ? <VerifiedBadge size={13} /> : null}
                                </Link>
                            ))}
                            <div className={styles.menuSep} />
                          </>
                      ) : null}
                      <button type="button" className={styles.menuItem} onClick={doLogout}>
                        <LogOut aria-hidden="true" />
                        {'Выйти'}
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className={styles.authBtns}>
                <Link href="/auth/login" className="btn btn-ghost">
                  {'Войти'}
                </Link>
                <Link href="/auth/register" className="btn btn-primary">
                  {'Регистрация'}
                </Link>
              </div>
            )}
          </div>

          <button
            type="button"
            className={`${styles.iconBtn} ${styles.burger}`}
            onClick={() => setMobileOpen(true)}
            aria-label={'Открыть меню'}
          >
            <Menu />
          </button>
        </div>
      </header>

      {mobileOpen && (
        <div className={styles.overlay}>
          <div className={styles.overlayHead}>
            <Link href="/" className={styles.logo} onClick={() => setMobileOpen(false)}>
              AUDIO<span className={styles.logoAccent}>RANOBE</span>
            </Link>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => setMobileOpen(false)}
              aria-label={'Закрыть меню'}
            >
              <X />
            </button>
          </div>

          <form
            className={styles.overlaySearch}
            onSubmit={(e) => {
              e.preventDefault();
              submitSearch(mobileQ);
            }}
          >
            <input
              className="input"
              type="text"
              placeholder={'Поиск тайтлов и чтецов…'}
              value={mobileQ}
              onChange={(e) => setMobileQ(e.target.value)}
              aria-label={'Поиск'}
            />
            <button type="submit" className="btn btn-primary" aria-label={'Поиск'}>
              <Search />
            </button>
          </form>

          <nav className={styles.overlayLinks} aria-label={'Мобильное меню'}>
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className={styles.overlayLink}>
                {l.label}
              </Link>
            ))}
            <button type="button" className={styles.overlayLink} onClick={goRandom}>
              {'Случайный'}
            </button>
          </nav>

          <div className={styles.overlaySep} />

          <nav className={styles.overlaySubLinks} aria-label={'Аккаунт'}>
            {user ? (
              <>
                <button type="button" className={styles.overlaySub} onClick={openAdd}>
                  {'Добавить'}
                </button>
                {userLinks.map((l) => (
                  <Link key={l.href} href={l.href} className={styles.overlaySub}>
                    {l.label}
                  </Link>
                ))}
                <button type="button" className={styles.overlaySub} onClick={doLogout}>
                  {'Выйти'}
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/login" className={styles.overlaySub}>
                  {'Войти'}
                </Link>
                <Link href="/auth/register" className={styles.overlaySub}>
                  {'Регистрация'}
                </Link>
              </>
            )}
          </nav>
        </div>
      )}

      <AddContentDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}
