'use client';

import { hostOf, platformOf } from './brands';
import styles from './SocialLinks.module.css';

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
