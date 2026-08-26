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
  type LucideIcon,
} from 'lucide-react';

export type CountKey =
  | 'pending_requests'
  | 'open_reports'
  | 'jobs_error'
  | 'review_queue'
  | 'comments_unchecked';
export type Tab = { href: string; label: string; icon: LucideIcon; adminOnly?: boolean; countKey?: CountKey };
export type Group = { label: string; tabs: Tab[] };

export const GROUPS: Group[] = [
  {
    label: 'Главное',
    tabs: [{ href: '/mod', label: 'Обзор', icon: LayoutDashboard }],
  },
  {
    label: 'Модерация',
    tabs: [
      { href: '/mod/queue', label: 'Очередь', icon: Inbox, countKey: 'pending_requests' },
      { href: '/mod/reports', label: 'Жалобы', icon: Flag, countKey: 'open_reports' },
      { href: '/mod/review', label: 'Проверка тайтлов', icon: ShieldCheck, countKey: 'review_queue' },
      { href: '/mod/comments', label: 'Комментарии', icon: MessageSquare, countKey: 'comments_unchecked' },
      { href: '/mod/words', label: 'Фильтр слов', icon: Filter, adminOnly: true },
      { href: '/mod/usernames', label: 'Имена', icon: Lock, adminOnly: true },
      { href: '/mod/trash', label: 'Корзина', icon: Trash2, adminOnly: true },
    ],
  },
  {
    label: 'Люди и контент',
    tabs: [
      { href: '/mod/users', label: 'Пользователи', icon: Users },
      { href: '/mod/narrators', label: 'Чтецы', icon: Mic },
      { href: '/mod/authors', label: 'Авторы', icon: Feather },
      { href: '/mod/genres', label: 'Теги', icon: BookMarked, adminOnly: true },
      { href: '/mod/dmca', label: 'DMCA', icon: Shield, adminOnly: true },
    ],
  },
  {
    label: 'Система',
    tabs: [
      { href: '/mod/narration', label: 'Озвучка', icon: BookHeadphones, adminOnly: true },
      { href: '/mod/tasks', label: 'Задачи', icon: ListChecks, countKey: 'jobs_error' },
      { href: '/mod/broadcast', label: 'Рассылка', icon: Radio },
      { href: '/mod/recap', label: 'Итоги', icon: Sparkles, adminOnly: true },
      { href: '/mod/announcements', label: 'Объявления', icon: Megaphone, adminOnly: true },
      { href: '/mod/audit', label: 'Аудит', icon: ScrollText, adminOnly: true },
    ],
  },
];
