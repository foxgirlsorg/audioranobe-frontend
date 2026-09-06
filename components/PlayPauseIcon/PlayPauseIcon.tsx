import { Pause, Play } from 'lucide-react';
import styles from './PlayPauseIcon.module.css';

export default function PlayPauseIcon({
  playing,
  size = 24,
  playClassName,
}: {
  playing: boolean;
  size?: number;
  playClassName?: string;
}) {
  return (
    <span
      className={`${styles.stack} ${playing ? styles.playing : ''}`}
      style={{ width: size, height: size }}
    >
      <Play size={size} className={`${styles.play} ${playClassName || ''}`} />
      <Pause size={size} className={styles.pause} />
    </span>
  );
}
