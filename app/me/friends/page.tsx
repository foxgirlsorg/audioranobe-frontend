'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Check, Clock, UserMinus, Users, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errMsg, useToast } from '@/lib/toast';
import type { FriendRequestItem, FriendsData, UserBrief } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import Tabs from '@/components/Tabs/Tabs';
import UserBadges from '@/components/UserBadges/UserBadges';
import { initialsOf, timeAgo } from '@/lib/format';
import { usePageTitle } from '@/lib/usePageTitle';
import { emitFriendsChanged } from '@/lib/friends';
import styles from './friends.module.css';

type Tab = 'friends' | 'incoming' | 'outgoing';

function PersonRow({
  user,
  when,
  actions,
}: {
  user: UserBrief;
  when?: string;
  actions: React.ReactNode;
}) {
  return (
    <div className={`glass-panel ${styles.row}`}>
      <Link href={`/user/${user.id}`} className={styles.person}>
        {user.avatar_url ? (
          <img src={user.avatar_url} alt="" className={styles.avatar} />
        ) : (
          <span className={`${styles.avatar} ${styles.avatarFallback}`}>
            {initialsOf(user.username)}
          </span>
        )}
        <span className={styles.meta}>
          <span className={styles.name}>
            {user.display_name || user.username}
            <UserBadges user={user} size={9} />
          </span>
          {user.display_name && user.display_name !== user.username ? (
            <span className={styles.handle}>@{user.username}</span>
          ) : null}
          {when ? <span className={styles.when}>{timeAgo(when)}</span> : null}
        </span>
      </Link>
      <div className={styles.actions}>{actions}</div>
    </div>
  );
}

export default function FriendsPage() {
  return (
    <Suspense fallback={<div className={styles.center}><Spinner size={34} /></div>}>
      <FriendsInner />
    </Suspense>
  );
}

function FriendsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  usePageTitle('Друзья');

  const tabParam = searchParams.get('tab');
  const initialTab: Tab = tabParam === 'incoming' || tabParam === 'outgoing' ? tabParam : 'friends';

  const [data, setData] = useState<FriendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth/login');
  }, [authLoading, user, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<FriendsData>('/me/friends');
      setData(res);
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const act = async (
    id: number,
    method: 'POST' | 'DELETE',
    path: string,
    okMsg: string,
    mutate: (d: FriendsData) => FriendsData,
  ) => {
    if (busyId !== null) return;
    setBusyId(id);
    try {
      await api(path, { method });
      setData((d) => (d ? mutate(d) : d));
      emitFriendsChanged();
      toast(okMsg, 'ok');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const accept = (r: FriendRequestItem) =>
    act(r.user.id, 'POST', `/friends/${r.user.id}/accept`, 'Заявка принята', (d) => ({
      ...d,
      incoming: d.incoming.filter((x) => x.user.id !== r.user.id),
      friends: [r.user, ...d.friends],
    }));

  const decline = (r: FriendRequestItem) =>
    act(r.user.id, 'DELETE', `/friends/${r.user.id}`, 'Заявка отклонена', (d) => ({
      ...d,
      incoming: d.incoming.filter((x) => x.user.id !== r.user.id),
    }));

  const cancel = (r: FriendRequestItem) =>
    act(r.user.id, 'DELETE', `/friends/${r.user.id}`, 'Заявка отменена', (d) => ({
      ...d,
      outgoing: d.outgoing.filter((x) => x.user.id !== r.user.id),
    }));

  const unfriend = (f: UserBrief) =>
    act(f.id, 'DELETE', `/friends/${f.id}`, 'Удалён из друзей', (d) => ({
      ...d,
      friends: d.friends.filter((x) => x.id !== f.id),
    }));

  if (authLoading || (loading && !data)) {
    return (
      <div className={styles.center}>
        <Spinner size={34} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.center}>
        <EmptyState
          icon={Users}
          title="Не удалось загрузить друзей"
          body={error ?? 'Попробуйте обновить страницу.'}
        />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link href="/me/settings" className={styles.back}>
        <ArrowLeft size={16} /> Аккаунт
      </Link>
      <h1 className={styles.title}>Друзья</h1>

      <div className={styles.tabsWrap}>
        <Tabs
          urlParam="tab"
          tabs={[
            { key: 'friends', label: 'Друзья', count: data.friends.length },
            {
              key: 'incoming',
              label: 'Входящие',
              count: data.incoming.length,
              accent: data.incoming.length > 0,
            },
            { key: 'outgoing', label: 'Исходящие', count: data.outgoing.length },
          ]}
          active={tab}
          onChange={(k) => setTab(k as Tab)}
        />
      </div>

      {tab === 'friends' ? (
        data.friends.length === 0 ? (
          <EmptyState icon={Users} title="Друзей пока нет" body="Найдите пользователей и отправьте заявку в друзья." />
        ) : (
          <div className={styles.list}>
            {data.friends.map((f) => (
              <PersonRow
                key={f.id}
                user={f}
                actions={
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busyId === f.id}
                    onClick={() => unfriend(f)}
                  >
                    <UserMinus size={16} /> Удалить
                  </button>
                }
              />
            ))}
          </div>
        )
      ) : null}

      {tab === 'incoming' ? (
        data.incoming.length === 0 ? (
          <EmptyState icon={Clock} title="Входящих заявок нет" body="Новые заявки в друзья появятся здесь." />
        ) : (
          <div className={styles.list}>
            {data.incoming.map((r) => (
              <PersonRow
                key={r.user.id}
                user={r.user}
                when={r.created_at}
                actions={
                  <>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busyId === r.user.id}
                      onClick={() => accept(r)}
                    >
                      <Check size={16} /> Принять
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={busyId === r.user.id}
                      onClick={() => decline(r)}
                    >
                      <X size={16} /> Отклонить
                    </button>
                  </>
                }
              />
            ))}
          </div>
        )
      ) : null}

      {tab === 'outgoing' ? (
        data.outgoing.length === 0 ? (
          <EmptyState icon={Clock} title="Исходящих заявок нет" body="Отправленные заявки в друзья появятся здесь." />
        ) : (
          <div className={styles.list}>
            {data.outgoing.map((r) => (
              <PersonRow
                key={r.user.id}
                user={r.user}
                when={r.created_at}
                actions={
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busyId === r.user.id}
                    onClick={() => cancel(r)}
                  >
                    <X size={16} /> Отменить
                  </button>
                }
              />
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
