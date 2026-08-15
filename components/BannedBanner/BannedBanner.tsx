'use client';

import React from 'react';
import { useAuth } from '@/lib/auth';
import { ShieldBan } from 'lucide-react';
import { SUPPORT_URL } from '@/lib/support';

export default function BannedBanner() {
  const { user } = useAuth();
  if (!user?.is_banned) return null;
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background: 'rgba(22,22,22,0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(222,97,97,0.4)',
        padding: '0.65rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        fontSize: '13px',
        fontWeight: 600,
        letterSpacing: '0.04em',
        color: '#de6161',
        textAlign: 'center',
      }}
      role="alert"
    >
      <ShieldBan size={16} />
      Ваш аккаунт заблокирован{user.ban_reason ? `: ${user.ban_reason}` : ''}. Некоторые функции недоступны.{' '}
      <a
        href={SUPPORT_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: '#de6161', textDecoration: 'underline' }}
      >
        Связаться с поддержкой
      </a>
    </div>
  );
}
