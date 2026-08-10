'use client';

import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useBadges } from '@/lib/badges';
import styles from './ChatButton.module.css';

/**
 * Navbar entry point for direct messages: an icon linking to /me/chat with an
 * unread badge. The count comes from the shared BadgesProvider poll (one
 * request for all navbar badges), which refreshes on navigation so opening a
 * chat clears the badge promptly.
 */
export default function ChatButton() {
  const { user } = useAuth();
  const { messages } = useBadges();

  if (!user) return null;

  return (
    <Link
      href="/me/chat"
      className={styles.btn}
      aria-label={messages > 0 ? `Сообщения (непрочитанных: ${messages})` : 'Сообщения'}
    >
      <MessageCircle />
      {messages > 0 && <span className={styles.badge}>{messages > 99 ? '99+' : messages}</span>}
    </Link>
  );
}
