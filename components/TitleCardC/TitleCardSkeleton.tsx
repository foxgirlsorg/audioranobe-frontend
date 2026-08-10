import Skeleton from 'react-loading-skeleton';
import cardStyles from './TitleCardC.module.css';
import styles from './TitleCardSkeleton.module.css';


export function TitleCardSkeleton() {
  return (
    <div className={cardStyles.card}>
      <div className={cardStyles.coverWrap}>
        <Skeleton height="100%" containerClassName={styles.coverFill} />
      </div>
      <div className={cardStyles.name}>
        <Skeleton />
      </div>
      <div className={cardStyles.author}>
        <Skeleton width="60%" />
      </div>
    </div>
  );
}

export default TitleCardSkeleton;
