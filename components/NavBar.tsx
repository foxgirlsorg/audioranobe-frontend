'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useRef, useState } from 'react';
import {
  ClipboardList,
  Dices,
  Heart,
  History,
  LibraryBig,
  LogOut,
  Menu,
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
import type { SearchSuggest } from '@/lib/types';
import NotificationBell from '@/components/NotificationBell';
import AddContentDialog from '@/components/AddContentDialog';
import styles from './NavBar.module.css';

type SuggestItem =
  | { kind: 'title'; id: number; slug: string; name: string; sub: string; image: string | null }
  | { kind: 'narrator'; id: number; slug: string; name: string; sub: string; image: string | null };

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

  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const userWrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const seqRef = useRef(0);

  // ---- scroll: transparent -> blurred glass --------------------------------
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ---- close menus on navigation -------------------------------------------
  useEffect(() => {
    setSugOpen(false);
    setUserMenuOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  // ---- debounced search suggest --------------------------------------------
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
        // suggestions are best-effort
      }
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [q]);

  // ---- outside click closes dropdowns --------------------------------------
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchWrapRef.current && !searchWrapRef.current.contains(target)) setSugOpen(false);
      if (userWrapRef.current && !userWrapRef.current.contains(target)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // ---- lock body scroll while the mobile overlay is open -------------------
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
        ...sug.titles.map<SuggestItem>((item) => ({
          kind: 'title',
          id: item.id,
          slug: item.slug,
          name: item.name,
          sub: item.author?.name ?? '',
          image: item.cover_url,
        })),
        ...sug.narrators.map<SuggestItem>((n) => ({
          kind: 'narrator',
          id: n.id,
          slug: n.slug,
          name: n.name,
          sub: 'Чтец',
          image: n.avatar_url,
        })),
      ]
    : [];

  const goToItem = (item: SuggestItem) => {
    setSugOpen(false);
    setActiveIdx(-1);
    inputRef.current?.blur();
    router.push(item.kind === 'title' ? `/title/${item.slug}` : `/narrator/${item.slug}`);
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
        { href: '/me/library', label: 'Моя библиотека', icon: LibraryBig },
        { href: '/me/favorites', label: 'Избранное', icon: Heart },
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

  const titleCount = sug?.titles.length ?? 0;

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
                {sug.titles.length > 0 && <div className={styles.groupLabel}>{'Тайтлы'}</div>}
                {sug.titles.map((item, i) => (
                  <button
                    key={`t${item.id}`}
                    type="button"
                    className={`${styles.item} ${activeIdx === i ? styles.itemActive : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => goToItem(flatItems[i])}
                    onMouseEnter={() => setActiveIdx(i)}
                    role="option"
                    aria-selected={activeIdx === i}
                  >
                    {item.cover_url ? (
                      <img className={styles.itemCover} src={item.cover_url} alt="" />
                    ) : (
                      <span className={styles.itemCover} />
                    )}
                    <span className={styles.itemBody}>
                      <span className={styles.itemName}>{item.name}</span>
                      {item.author && <span className={styles.itemSub}>{item.author.name}</span>}
                    </span>
                  </button>
                ))}
                {sug.narrators.length > 0 && (
                  <div className={styles.groupLabel}>{'Чтецы'}</div>
                )}
                {sug.narrators.map((n, i) => {
                  const idx = titleCount + i;
                  return (
                    <button
                      key={`n${n.id}`}
                      type="button"
                      className={`${styles.item} ${
                        activeIdx === idx ? styles.itemActive : ''
                      }`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => goToItem(flatItems[idx])}
                      onMouseEnter={() => setActiveIdx(idx)}
                      role="option"
                      aria-selected={activeIdx === idx}
                    >
                      {n.avatar_url ? (
                        <img className={styles.itemAvatar} src={n.avatar_url} alt="" />
                      ) : (
                        <span className={styles.itemAvatar} />
                      )}
                      <span className={styles.itemBody}>
                        <span className={styles.itemName}>{n.name}</span>
                        <span className={styles.itemSub}>{'Чтец'}</span>
                      </span>
                    </button>
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
                      <button type="button" className={styles.menuItem} onClick={openAdd}>
                        <Plus aria-hidden="true" />
                        {'Добавить'}
                      </button>
                      {userLinks.map((l) => (
                        <Link key={l.href} href={l.href} className={styles.menuItem}>
                          <l.icon aria-hidden="true" />
                          {l.label}
                        </Link>
                      ))}
                      <div className={styles.menuSep} />
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
