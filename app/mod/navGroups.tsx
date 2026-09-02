import {
  LayoutDashboard,
  Inbox,
  Flag,
  Users,
  Mic,
  BookMarked,
  Feather,
  Shield,
  Filter,
  Lock,
  Trash2,
  Megaphone,
  Radio,
  ScrollText,
  BookHeadphones,
  ListChecks,
  ShieldCheck,
  MessageSquare,
  Sparkles,
  Award,
  KeyRound,
  type LucideIcon,
} from 'lucide-react';

export type CountKey =
  | 'pending_requests'
  | 'open_reports'
  | 'jobs_error'
  | 'review_queue'
  | 'comments_unchecked';
export type Tab = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Single permission required to see this tab. */
  perm?: string;
  /** Visible if the user holds ANY of these permissions. */
  anyPerm?: string[];
  countKey?: CountKey;
};

export const TRASH_VIEW_PERMS = [
  'trash.view.title',
  'trash.view.chapter',
  'trash.view.narrator',
  'trash.view.author',
  'trash.view.comment',
];
export const NOTIFY_PERMS = ['notify.user', 'notify.narrator_subs', 'notify.title_followers', 'notify.all'];
export type Group = { label: string; tabs: Tab[] };

export const GROUPS: Group[] = [
  {
    label: 'Главное',
    tabs: [{ href: '/mod', label: 'Обзор', icon: LayoutDashboard }],
  },
  {
    label: 'Модерация',
    tabs: [
      { href: '/mod/queue', label: 'Очередь', icon: Inbox, perm: 'moderation.queue', countKey: 'pending_requests' },
      { href: '/mod/reports', label: 'Жалобы', icon: Flag, perm: 'reports.handle', countKey: 'open_reports' },
      { href: '/mod/review', label: 'Проверка тайтлов', icon: ShieldCheck, perm: 'content.review', countKey: 'review_queue' },
      { href: '/mod/comments', label: 'Комментарии', icon: MessageSquare, perm: 'comments.moderate', countKey: 'comments_unchecked' },
      { href: '/mod/words', label: 'Фильтр слов', icon: Filter, perm: 'words.manage' },
      { href: '/mod/usernames', label: 'Имена', icon: Lock, perm: 'usernames.manage' },
      { href: '/mod/trash', label: 'Корзина', icon: Trash2, anyPerm: TRASH_VIEW_PERMS },
    ],
  },
  {
    label: 'Люди и контент',
    tabs: [
      { href: '/mod/users', label: 'Пользователи', icon: Users, perm: 'users.edit' },
      { href: '/mod/narrators', label: 'Чтецы', icon: Mic, perm: 'narrators.edit' },
      { href: '/mod/authors', label: 'Авторы', icon: Feather, perm: 'authors.edit' },
      { href: '/mod/genres', label: 'Теги', icon: BookMarked, perm: 'tags.edit' },
      { href: '/mod/badges', label: 'Бейджи', icon: Award, perm: 'badges.manage' },
      { href: '/mod/dmca', label: 'DMCA', icon: Shield, perm: 'dmca.manage' },
    ],
  },
  {
    label: 'Система',
    tabs: [
      { href: '/mod/roles', label: 'Роли', icon: KeyRound, perm: 'roles.manage' },
      { href: '/mod/narration', label: 'Озвучка', icon: BookHeadphones, perm: 'narration.manage' },
      { href: '/mod/tasks', label: 'Задачи', icon: ListChecks, perm: 'narration.jobs', countKey: 'jobs_error' },
      { href: '/mod/broadcast', label: 'Рассылка', icon: Radio, anyPerm: NOTIFY_PERMS },
      { href: '/mod/recap', label: 'Итоги', icon: Sparkles, perm: 'recap.manage' },
      { href: '/mod/announcements', label: 'Объявления', icon: Megaphone, perm: 'announcements.manage' },
      { href: '/mod/audit', label: 'Аудит', icon: ScrollText, perm: 'audit.view' },
    ],
  },
];
