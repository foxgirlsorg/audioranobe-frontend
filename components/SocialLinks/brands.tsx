import type { ComponentType } from 'react';
import {
  Youtube,
  Twitter,
  Instagram,
  Twitch,
  Send,
  MessageCircle,
  Music2,
  Users,
  Link as LinkIcon,
} from 'lucide-react';

type IconProps = { size?: number | string };

export function PatreonIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22.957 7.21c-.004-3.064-2.391-5.576-5.191-6.482-3.478-1.125-8.064-.962-11.384.604C2.357 3.231 1.093 7.391 1.046 11.54c-.039 3.411.302 12.396 5.369 12.46 3.765.047 4.326-4.804 6.068-7.141 1.24-1.662 2.836-2.132 4.801-2.618 3.376-.836 5.678-3.501 5.673-7.031Z" />
    </svg>
  );
}

export function BoostyIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M2.661 14.337 6.801 0h6.362L11.88 4.444l-.038.077-3.378 11.733h3.15c-1.321 3.289-2.35 5.867-3.086 7.733-5.816-.063-7.442-4.228-6.02-9.155M8.554 24l7.67-11.035h-3.25l2.83-7.073c4.852.508 7.137 4.33 5.791 8.952C20.16 19.81 14.344 24 8.68 24h-.127z" />
    </svg>
  );
}

export type Platform = {
  icon: ComponentType<IconProps>;
  label: string;
};

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

export function platformOf(host: string): Platform {
  if (host.includes('youtube') || host === 'youtu.be') return { icon: Youtube, label: 'YouTube' };
  if (host === 't.me' || host.includes('telegram')) return { icon: Send, label: 'Telegram' };
  if (host.includes('twitter') || host === 'x.com') return { icon: Twitter, label: 'Twitter / X' };
  if (host === 'vk.com' || host.endsWith('.vk.com')) return { icon: Users, label: 'VK' };
  if (host.includes('discord')) return { icon: MessageCircle, label: 'Discord' };
  if (host.includes('boosty')) return { icon: BoostyIcon, label: 'Boosty' };
  if (host.includes('patreon')) return { icon: PatreonIcon, label: 'Patreon' };
  if (host.includes('tiktok')) return { icon: Music2, label: 'TikTok' };
  if (host.includes('instagram')) return { icon: Instagram, label: 'Instagram' };
  if (host.includes('twitch')) return { icon: Twitch, label: 'Twitch' };
  return { icon: LinkIcon, label: 'Ссылка' };
}
