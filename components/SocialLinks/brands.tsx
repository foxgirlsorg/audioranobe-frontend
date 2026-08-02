import type { ComponentType } from 'react';
import {
  Youtube,
  Twitter,
  Instagram,
  Twitch,
  MessageCircle,
  Music2,
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

export function TelegramIcon({ size = 18 }: IconProps) {
  return (
    // viewBox cropped to the plane's own bounding box (square, so it is not
    // stretched): the source glyph is a 455px card with the plane occupying the
    // middle, which rendered as a small plane surrounded by nothing.
    <svg
      width={size}
      height={size}
      viewBox="70 70 315 315"
      fill="currentColor"
      fillRule="evenodd"
      clipRule="evenodd"
      aria-hidden="true"
    >
      <path d="M384.814,100.68l-53.458,257.136c-1.259,6.071-8.378,8.822-13.401,5.172l-72.975-52.981c-4.43-3.217-10.471-3.046-14.712,0.412l-40.46,32.981c-4.695,3.84-11.771,1.7-13.569-4.083l-28.094-90.351l-72.583-27.089c-7.373-2.762-7.436-13.171-0.084-16.003L373.36,90.959C379.675,88.517,386.19,94.049,384.814,100.68z M313.567,147.179l-141.854,87.367c-5.437,3.355-7.996,9.921-6.242,16.068l15.337,53.891c1.091,3.818,6.631,3.428,7.162-0.517l3.986-29.553c0.753-5.564,3.406-10.693,7.522-14.522l117.069-108.822C318.739,149.061,316.115,145.614,313.567,147.179z" />
    </svg>
  );
}

export function VkIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="m9.489.004.729-.003h3.564l.73.003.914.01.433.007.418.011.403.014.388.016.374.021.36.025.345.03.333.033c1.74.196 2.933.616 3.833 1.516.9.9 1.32 2.092 1.516 3.833l.034.333.029.346.025.36.02.373.025.588.012.41.013.644.009.915.004.98-.001 3.313-.003.73-.01.914-.007.433-.011.418-.014.403-.016.388-.021.374-.025.36-.03.345-.033.333c-.196 1.74-.616 2.933-1.516 3.833-.9.9-2.092 1.32-3.833 1.516l-.333.034-.346.029-.36.025-.373.02-.588.025-.41.012-.644.013-.915.009-.98.004-3.313-.001-.73-.003-.914-.01-.433-.007-.418-.011-.403-.014-.388-.016-.374-.021-.36-.025-.345-.03-.333-.033c-1.74-.196-2.933-.616-3.833-1.516-.9-.9-1.32-2.092-1.516-3.833l-.034-.333-.029-.346-.025-.36-.02-.373-.025-.588-.012-.41-.013-.644-.009-.915-.004-.98.001-3.313.003-.73.01-.914.007-.433.011-.418.014-.403.016-.388.021-.374.025-.36.03-.345.033-.333c.196-1.74.616-2.933 1.516-3.833.9-.9 2.092-1.32 3.833-1.516l.333-.034.346-.029.36-.025.373-.02.588-.025.41-.012.644-.013.915-.009ZM6.79 7.3H4.05c.13 6.24 3.25 9.99 8.72 9.99h.31v-3.57c2.01.2 3.53 1.67 4.14 3.57h2.84c-.78-2.84-2.83-4.41-4.11-5.01 1.28-.74 3.08-2.54 3.51-4.98h-2.58c-.56 1.98-2.22 3.78-3.8 3.95V7.3H10.5v6.92c-1.6-.4-3.62-2.34-3.71-6.92Z" />
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
  if (host === 't.me' || host.includes('telegram')) return { icon: TelegramIcon, label: 'Telegram' };
  if (host.includes('twitter') || host === 'x.com') return { icon: Twitter, label: 'Twitter / X' };
  if (/(^|\.)vk\.(com|ru)$/.test(host)) return { icon: VkIcon, label: 'VK' };
  if (host.includes('discord')) return { icon: MessageCircle, label: 'Discord' };
  if (host.includes('boosty')) return { icon: BoostyIcon, label: 'Boosty' };
  if (host.includes('patreon')) return { icon: PatreonIcon, label: 'Patreon' };
  if (host.includes('tiktok')) return { icon: Music2, label: 'TikTok' };
  if (host.includes('instagram')) return { icon: Instagram, label: 'Instagram' };
  if (host.includes('twitch')) return { icon: Twitch, label: 'Twitch' };
  return { icon: LinkIcon, label: 'Ссылка' };
}
