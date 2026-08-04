import styles from './Badges.module.css';

const defs = {
    staff: {
        src: '/badges/staff_badge.svg',
        scale: 100,
    },
    developer: {
        src: '/badges/dev_badge.svg',
        scale: 125,
    },
} as const;

export type BadgeKey = keyof typeof defs;

export default function Badge({
                                  badge,
                                  title,
                                  size = 21,
                                  className = '',
                              }: {
    badge: BadgeKey;
    title: string;
    size?: number;
    className?: string;
}) {
    const def = defs[badge];

    return (
        <img
            src={def.src}
            height={(size * def.scale) / 100}
            alt={title}
            title={title}
            className={`${styles.badge} ${className}`}
        />
    );
}