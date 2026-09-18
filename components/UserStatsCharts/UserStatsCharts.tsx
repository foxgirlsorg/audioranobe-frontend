import type { ScoreStats } from '@/lib/types';
import ScoreChart from '@/components/ScoreChart/ScoreChart';
import DistributionPie, { type DistributionSlice } from '@/components/DistributionPie/DistributionPie';
import styles from './UserStatsCharts.module.css';

const COUNTRY_LABELS: Record<string, string> = {
  japan: 'Япония',
  china: 'Китай',
  korea: 'Корея',
};

const COUNTRY_COLORS: Record<string, string> = {
  japan: 'var(--accent)',
  china: 'rgba(222, 97, 97, 0.55)',
  korea: 'rgba(222, 97, 97, 0.3)',
};
const COUNTRY_FALLBACK_COLOR = 'rgba(255, 255, 255, 0.16)';

export default function UserStatsCharts({
  scoreStats,
  libraryStats,
}: {
  scoreStats: ScoreStats;
  libraryStats: { planning: number; in_progress: number; completed: number; dropped: number };
}) {
  const statusSlices: DistributionSlice[] = [
    { label: 'Завершено', value: libraryStats.completed, color: 'var(--accent)' },
    { label: 'В процессе', value: libraryStats.in_progress, color: 'rgba(222, 97, 97, 0.55)' },
    { label: 'В планах', value: libraryStats.planning, color: 'rgba(222, 97, 97, 0.3)' },
    { label: 'Брошено', value: libraryStats.dropped, color: 'rgba(255, 255, 255, 0.16)' },
  ].filter((s) => s.value > 0);

  const countrySlices: DistributionSlice[] = scoreStats.countries.map((c) => ({
    label: COUNTRY_LABELS[c.country] ?? c.country,
    value: c.count,
    color: COUNTRY_COLORS[c.country] ?? COUNTRY_FALLBACK_COLOR,
  }));

  const hasScores = scoreStats.scores.length > 0;
  const hasStatus = statusSlices.length > 0;
  const hasCountries = countrySlices.length > 0;

  if (!hasScores && !hasStatus && !hasCountries) {
    return null;
  }

  return (
    <div className={styles.stack}>
      {hasScores ? (
        <div className={`glass-panel ${styles.scoreCard}`}>
          <ScoreChart scores={scoreStats.scores} />
        </div>
      ) : null}
      {hasStatus || hasCountries ? (
        <div className={hasStatus && hasCountries ? styles.pies : styles.piesSingle}>
          {hasStatus ? <DistributionPie title="Статус" slices={statusSlices} /> : null}
          {hasCountries ? <DistributionPie title="Страна" slices={countrySlices} /> : null}
        </div>
      ) : null}
    </div>
  );
}
