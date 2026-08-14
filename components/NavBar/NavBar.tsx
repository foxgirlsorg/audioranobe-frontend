'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Skeleton from 'react-loading-skeleton';
import {
  Bell,
  ClipboardList,
  Dices,
  History,
  Library,
  LibraryBig,
  LogIn,
  LogOut,
  Menu,
  MessageCircle,
  Mic,
  Newspaper,
  PenLine,
  Plus,
  Search,
  Settings,
  Shield,
  User,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useBadges } from '@/lib/badges';
import { useMyNarrators } from '@/lib/narrators';
import { errMsg, useToast } from '@/lib/toast';
import { useRequestNarration } from '@/lib/requestNarration';
import { useAnimatedPresence } from '@/lib/useAnimatedPresence';
import type { SearchSuggest } from '@/lib/types';
import NotificationBell from '@/components/NotificationBell/NotificationBell';
import ChatButton from '@/components/ChatButton/ChatButton';
import PresenceDot from '@/components/PresenceDot/PresenceDot';
import AddContentDialog from '@/components/AddContentDialog/AddContentDialog';
import VerifiedBadge from '@/components/VerifiedBadge/VerifiedBadge';
import UserBadges from '@/components/UserBadges/UserBadges';
import UnverifiedEmailBanner from '@/components/UnverifiedEmailBanner/UnverifiedEmailBanner';
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
  { href: '/catalog', label: 'Каталог', icon: LibraryBig },
  { href: '/collections', label: 'Коллекции', icon: Library },
  { href: '/news', label: 'Новости', icon: Newspaper },
];

export default function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, logout, isMod } = useAuth();
  const { messages: msgCount, notifications: notifCount, friend_requests: friendReq } = useBadges();
  const { toast } = useToast();
  const { request: requestNarration, pendingSlug: narrPending } = useRequestNarration();

  const [scrolled, setScrolled] = useState(false);
  const [q, setQ] = useState('');
  const [sug, setSug] = useState<SearchSuggest | null>(null);
  const [sugOpen, setSugOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  // Lazily loaded (and shared with the add-content dialog) — fetched when the
  // account menu first opens, not at startup.
  const { narrators: myNarrators, ensureLoaded: ensureNarrators } = useMyNarrators();

  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const userWrapRef = useRef<HTMLDivElement | null>(null);
  // The mobile account menu is portalled straight to <body> (see below) so its
  // position:fixed sidebar isn't hostage to .nav's backdrop-filter, which
  // creates its own containing block for fixed descendants once scrolled —
  // that's what made the old nested version fall apart past the top of the
  // page. Portalled content lives outside userWrapRef's DOM subtree, so the
  // outside-click handler needs this second ref to still recognize it.
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement | null>(null);
  const seqRef = useRef(0);

  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
    const [userMenuClosing, setUserMenuClosing] = useState(false);
  const userMenuOpenRef = useRef(false);
  const userMenuCloseTimerRef = useRef<number | null>(null);

  // Keeps each popup mounted a beat past its own close so its exit animation
  // can play instead of the element just vanishing.
  const sugMounted = useAnimatedPresence(sugOpen && !!sug, 140);
  const userMenuMounted = useAnimatedPresence(userMenuOpen && !isMobile, 140);
  const mobileOverlayMounted = useAnimatedPresence(mobileOpen, 200);
  const mobileSearchMounted = useAnimatedPresence(mobileSearchOpen, 160);

  useEffect(() => {
    userMenuOpenRef.current = userMenuOpen;
  }, [userMenuOpen]);

  useEffect(() => {
    return () => {
      if (userMenuCloseTimerRef.current) window.clearTimeout(userMenuCloseTimerRef.current);
    };
  }, []);

  const closeUserMenu = useCallback(() => {
    if (!userMenuOpenRef.current) return;
    setUserMenuOpen(false);
    setUserMenuClosing(true);
    if (userMenuCloseTimerRef.current) window.clearTimeout(userMenuCloseTimerRef.current);
    userMenuCloseTimerRef.current = window.setTimeout(() => setUserMenuClosing(false), 280);
  }, []);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia('(max-width: 768px)');
    setIsMobile(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setSugOpen(false);
    closeUserMenu();
    setMobileOpen(false);
    setMobileSearchOpen(false);
  }, [pathname, closeUserMenu]);

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
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchWrapRef.current && !searchWrapRef.current.contains(target)) setSugOpen(false);
      const insideUserMenu =
        (userWrapRef.current && userWrapRef.current.contains(target)) ||
        (mobileMenuRef.current && mobileMenuRef.current.contains(target));
      if (!insideUserMenu) closeUserMenu();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [closeUserMenu]);

  useEffect(() => {
    if (!mobileOpen && !mobileSearchOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen, mobileSearchOpen]);

  // The floating search's own way out, beyond its close button: Escape, and
  // autofocus so typing can start immediately.
  useEffect(() => {
    if (!mobileSearchOpen) return;
    mobileSearchInputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileSearchOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileSearchOpen]);

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
    setMobileSearchOpen(false);
    router.push(item.href);
  };

  const submitSearch = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setSugOpen(false);
    setActiveIdx(-1);
    inputRef.current?.blur();
    setMobileOpen(false);
    setMobileSearchOpen(false);
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
      setMobileSearchOpen(false);
      router.push(`/title/${slug}`);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  const doLogout = () => {
    closeUserMenu();
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

  const renderAccountMenuContent = () =>
    !user ? null : (
      <>
        <div className={styles.menuHead}>
          <span className={styles.menuEyebrow}>{'вы вошли как'}</span>
          <span className={styles.menuName}>
            {user.display_name || user.username}
            <UserBadges user={user} size={9} className={styles.badges} />
          </span>
          {user.display_name && user.display_name !== user.username ? (
            <span className={styles.menuHandle}>@{user.username}</span>
          ) : null}
        </div>
        <div className={styles.menuSep} />




        {userLinks.map((l) => (
          <Link key={l.href} href={l.href} className={styles.menuItem}>
            <l.icon aria-hidden="true" />
            {l.label}
            {l.count > 0 ? (
              <span className={styles.menuBadge}>{l.count > 99 ? '99+' : l.count}</span>
            ) : null}
          </Link>
        ))}
        <div className={styles.menuMobileOnly}>
          <div className={styles.menuSep} />
          {NAV_LINKS.map((l) => (
              <Link
                  key={l.href}
                  href={l.href}
                  className={styles.menuItem}
                  onClick={closeUserMenu}
              >
                <l.icon aria-hidden="true" />
                {l.label}
              </Link>
          ))}
          <button type="button" className={styles.menuItem} onClick={goRandom}>
            <Dices aria-hidden="true" />
            {'Случайный'}
          </button>

        </div>
        <div className={styles.menuSep} />
        <button type="button" className={styles.menuItem} onClick={openAdd}>
          <Plus aria-hidden="true" />
          {'Добавить'}
        </button>
        {myNarrators.length > 0 ? (
          <>
            <div className={styles.menuSep} />
            {myNarrators.map((n) => (
              <Link key={n.id} href={`/narrator/${n.slug}`} className={styles.menuItem}>
                {n.avatar_url ? (
                  <img src={n.avatar_url} alt="" className={styles.menuAvatar} />
                ) : (
                  <Mic aria-hidden="true" />
                )}
                <span className={styles.menuNarratorName}>{n.name}</span>
                {n.is_verified ? <VerifiedBadge size={13} className={styles.menuVerified} /> : null}
              </Link>
            ))}

          </>
        ) : null}
        <div className={styles.menuSep} />
        <button type="button" className={styles.menuItem} onClick={doLogout}>
          <LogOut aria-hidden="true" />
          {'Выйти'}
        </button>
      </>
    );

  const userLinks = user
    ? [
        { href: `/user/${user.id}`, label: 'Профиль', icon: User, count: 0 },
        { href: '/me/chat', label: 'Сообщения', icon: MessageCircle, count: msgCount },
        { href: '/me/notifications', label: 'Уведомления', icon: Bell, count: notifCount },
        { href: '/me/friends', label: 'Друзья', icon: Users, count: friendReq },
        { href: '/me/history', label: 'История', icon: History, count: 0 },
        { href: '/me/requests', label: 'Мои заявки', icon: ClipboardList, count: 0 },
        ...(isMod ? [{ href: '/mod', label: 'Модерация', icon: Shield, count: 0 }] : []),
        { href: '/me/settings', label: 'Настройки', icon: Settings, count: 0 },
      ]
    : [];

  const openAdd = () => {
    closeUserMenu();
    setMobileOpen(false);
    setAddOpen(true);
  };

  const renderResults = () => (
    <>
      {flatItems.length === 0 && <div className={styles.emptySug}>{'Ничего не найдено'}</div>}
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
                  className={`${styles.item} ${activeIdx === idx ? styles.itemActive : ''}`}
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
      {sug?.external && sug.external.length > 0 ? (
        <>
          <div className={styles.groupLabel}>{'Заказать озвучку'}</div>
          {sug.external.map((e) => (
            <button
              key={e.ref}
              type="button"
              className={styles.item}
              onMouseDown={(ev) => ev.preventDefault()}
              onClick={() => requestNarration(e.ref)}
              disabled={narrPending !== null}
            >
              {e.cover_url ? (
                <img className={styles.itemCover} src={e.cover_url} alt="" />
              ) : (
                <span className={styles.itemCover} />
              )}
              <span className={styles.itemBody}>
                <span className={styles.itemName}>{e.name}</span>
                <span className={styles.itemSub}>
                  {narrPending === e.ref ? 'Заказываем…' : 'заказать ИИ-озвучку'}
                </span>
              </span>
            </button>
          ))}
        </>
      ) : null}

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
    </>
  );

  return (
    <>
      <header
        className={`${styles.nav} site-header ${
          scrolled || (isMobile && (userMenuOpen || userMenuClosing)) ? styles.scrolled : ''
        }`}
      >
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
            {sugMounted && (
              <div
                className={`${styles.dropdown} ${sugOpen && sug ? '' : styles.dropdownOut}`}
                role="listbox"
              >
                {renderResults()}
              </div>
            )}
          </div>

          <button
            type="button"
            className={`${styles.iconBtn} ${styles.randomBtn}`}
            onClick={goRandom}
            title={'Случайный тайтл'}
            aria-label={'Случайный тайтл'}
          >
            <Dices />
          </button>

          <button
            type="button"
            className={`${styles.iconBtn} ${styles.mobileSearchBtn}`}
            onClick={() => {
              setMobileOpen(false);
              setMobileSearchOpen(true);
            }}
            aria-label={'Поиск'}
          >
            <Search />
          </button>

          <div className={styles.authArea}>
            {loading ? (
              <span className={styles.authGhost} aria-hidden="true">
                <Skeleton circle width={36} height={36} baseColor="#232326" highlightColor="#302f34" />
              </span>
            ) : user ? (
              <>
                <span className={styles.dmSlot}>
                  <ChatButton />
                </span>
                <NotificationBell />
                <div className={styles.userWrap} ref={userWrapRef}>
                  <button
                    type="button"
                    className={styles.avatarBtn}
                    onClick={() => {
                      if (userMenuOpen) {
                        closeUserMenu();
                      } else {
                        if (userMenuCloseTimerRef.current) window.clearTimeout(userMenuCloseTimerRef.current);
                        setUserMenuClosing(false);
                        setUserMenuOpen(true);
                      }
                      ensureNarrators();
                    }}
                    aria-label={
                      friendReq > 0
                        ? `Меню аккаунта (заявок в друзья: ${friendReq})`
                        : 'Меню аккаунта'
                    }
                    aria-expanded={userMenuOpen}
                  >
                    {avatar()}
                  </button>
                  <PresenceDot status="online" size={9} className={styles.presenceDot} />
                  {friendReq > 0 && (
                    <span className={styles.friendBadge} aria-hidden="true">
                      {friendReq > 99 ? '99+' : friendReq}
                    </span>
                  )}
                  {userMenuMounted && (
                    <div
                      className={`${styles.userMenu} ${
                        userMenuOpen && !isMobile ? '' : styles.userMenuOut
                      }`}
                    >
                      {renderAccountMenuContent()}
                    </div>
                  )}
                </div>

                {isMobile && mounted
                  ? createPortal(
                      <>
                        <div
                          className={`${styles.userMenuBackdrop} ${
                            userMenuOpen ? styles.userMenuBackdropOpen : ''
                          }`}
                          onClick={closeUserMenu}
                          aria-hidden="true"
                        />
                        <div
                          className={`${styles.userMenuMobile} ${
                            userMenuOpen ? styles.userMenuMobileOpen : ''
                          }`}
                          ref={mobileMenuRef}
                        >
                          {renderAccountMenuContent()}
                        </div>
                      </>,
                      document.body
                    )
                  : null}
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

          {!user ? (
            <button
              type="button"
              className={`${styles.iconBtn} ${styles.burger}`}
              onClick={() => {
                setMobileSearchOpen(false);
                setMobileOpen(true);
              }}
              aria-label={'Открыть меню'}
            >
              <Menu />
            </button>
          ) : null}
        </div>
      </header>

      <UnverifiedEmailBanner />

      {mobileSearchMounted && (
        <div
          className={`${styles.searchOverlay} ${mobileSearchOpen ? '' : styles.searchOverlayOut}`}
          onClick={() => setMobileSearchOpen(false)}
        >
          <div className={styles.searchPanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.searchPanelRow}>
              <Search className={styles.searchIcon} aria-hidden="true" />
              <input
                ref={mobileSearchInputRef}
                className={styles.searchPanelInput}
                type="text"
                placeholder={'Поиск тайтлов и чтецов…'}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onSearchKeyDown}
                aria-label={'Поиск'}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => setMobileSearchOpen(false)}
                aria-label={'Закрыть поиск'}
              >
                <X />
              </button>
            </div>
            <div className={styles.searchPanelResults}>
              {q.trim().length >= 2 ? (
                renderResults()
              ) : (
                <div className={styles.emptySug}>{'Введите не менее 2 символов'}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {mobileOverlayMounted && (
        <div className={`${styles.overlay} ${mobileOpen ? '' : styles.overlayOut}`}>
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

          <div className={styles.groupLabel}>{'Разделы'}</div>
          <nav className={styles.overlayLinks} aria-label={'Мобильное меню'}>
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className={styles.overlayLink}>
                <l.icon aria-hidden="true" />
                {l.label}
              </Link>
            ))}
            <button type="button" className={styles.overlayLink} onClick={goRandom}>
              <Dices aria-hidden="true" />
              {'Случайный'}
            </button>
          </nav>

          {!user ? (
            <>
              <div className={styles.overlaySep} />
              <div className={styles.groupLabel}>{'Аккаунт'}</div>
              <nav className={styles.overlaySubLinks} aria-label={'Аккаунт'}>
                <Link href="/auth/login" className={styles.overlaySub}>
                  <LogIn aria-hidden="true" />
                  {'Войти'}
                </Link>
                <Link href="/auth/register" className={styles.overlaySub}>
                  <UserPlus aria-hidden="true" />
                  {'Регистрация'}
                </Link>
              </nav>
            </>
          ) : null}
        </div>
      )}

      <AddContentDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}
