import { api } from '@/lib/api';

export type GoalPeriod = 'once' | 'weekly' | 'monthly';

export interface DonateGoal {
  enabled: boolean;
  title: string;
  period: GoalPeriod;
  target_cents: number;
  raised_cents: number;
  pct: number;
}

export interface DonateConfig {
  kofi: string;
  boosty: string;
  badge_min: number;
  goal: DonateGoal;
}

export const PERIOD_LABEL: Record<GoalPeriod, string> = {
  once: 'сбор',
  weekly: 'за неделю',
  monthly: 'за месяц',
};

export function usd(cents: number): string {
  return '$' + (cents / 100).toLocaleString('ru-RU', { maximumFractionDigits: 0 });
}

export interface RecentDonation {
  name: string;
  service: string;
  amount: number;
  currency: string;
  created_at: number;
}

export const SERVICE_LABEL: Record<string, string> = {
  kofi: 'Ko-fi',
  boosty: 'Boosty',
  other: 'Другое',
};

export function fetchDonateConfig(): Promise<DonateConfig> {
  return api<DonateConfig>('/donations/config');
}

export function fetchRecentDonations(): Promise<{ items: RecentDonation[] }> {
  return api<{ items: RecentDonation[] }>('/donations/recent');
}
