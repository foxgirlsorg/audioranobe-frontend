'use client';

import type { ComponentType } from 'react';
import {
  Youtube,
  Twitter,
  Instagram,
  Twitch,
  Send,
  MessageCircle,
  Music2,
  Flame,
  HeartHandshake,
  Users,
  Link as LinkIcon,
} from 'lucide-react';
import styles from './SocialLinks.module.css';

type Platform = {
  icon: ComponentType<{ size?: number | string }>;
  label: string;
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function platformOf(host: string): Platform {
  if (host.includes('youtube') || host === 'youtu.be') return { icon: Youtube, label: 'YouTube' };
  if (host === 't.me' || host.includes('telegram')) return { icon: Send, label: 'Telegram' };
  if (host.includes('twitter') || host === 'x.com') return { icon: Twitter, label: 'Twitter / X' };
  if (host === 'vk.com' || host.endsWith('.vk.com')) return { icon: Users, label: 'VK' };
  if (host.includes('discord')) return { icon: MessageCircle, label: 'Discord' };
  if (host.includes('boosty')) return { icon: Flame, label: 'Boosty' };
  if (host.includes('patreon')) return { icon: HeartHandshake, label: 'Patreon' };
  if (host.includes('tiktok')) return { icon: Music2, label: 'TikTok' };
  if (host.includes('instagram')) return { icon: Instagram, label: 'Instagram' };
  if (host.includes('twitch')) return { icon: Twitch, label: 'Twitch' };
  return { icon: LinkIcon, label: 'Link' };
}

export function SocialLinks({ urls }: { urls: string[] }) {
  const list = (urls ?? []).filter((u) => typeof u === 'string' && u.trim() !== '');
  if (list.length === 0) return null;

  return (
    <div className={styles.row}>
      {list.map((url, i) => {
        const host = hostOf(url);
        const { icon: Icon, label } = platformOf(host);
        return (
          <a
            key={`${url}-${i}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.link}
            title={host || label}
            aria-label={label}
          >
            <Icon size={18} />
          </a>
        );
      })}
    </div>
  );
}

export default SocialLinks;
