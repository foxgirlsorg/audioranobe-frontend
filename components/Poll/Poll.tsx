'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Clock, Pencil, Square, Trash2, Undo2, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errMsg, useToast } from '@/lib/toast';
import { formatDateTime } from '@/lib/format';
import type { Poll as PollData, PollVoters } from '@/lib/types';
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog';
import PollBuilder, { pollEditPayload, pollToDraft, type PollDraft } from '@/components/PollBuilder/PollBuilder';
import styles from './Poll.module.css';

export default function Poll({
  poll,
  onChange,
}: {
  poll: PollData;
  onChange: (next: PollData | null) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'stop' | 'remove' | null>(null);
  const [voters, setVoters] = useState<PollVoters | null>(null);
  const [votersOpen, setVotersOpen] = useState(false);
  const [draft, setDraft] = useState<PollDraft | null>(null);
  const [reopen, setReopen] = useState(false);

  const showResults = poll.total_votes !== null;

  async function run(fn: () => Promise<PollData | null>) {
    setBusy(true);
    try {
      onChange(await fn());
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  async function toggleVoters() {
    if (votersOpen) {
      setVotersOpen(false);
      return;
    }
    try {
      setVoters(await api<PollVoters>(`/polls/${poll.id}/voters`));
      setVotersOpen(true);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  }

  const startEdit = () => {
    setReopen(false);
    setDraft(pollToDraft(poll));
  };

  const saveEdit = () => {
    if (!draft) return;
    const payload = pollEditPayload(draft, pollToDraft(poll), reopen);
    if (typeof payload === 'string') {
      toast(payload, 'error');
      return;
    }
    void run(async () => {
      const next = await api<PollData>(`/polls/${poll.id}`, { method: 'PATCH', body: payload });
      setDraft(null);
      setVoters(null);
      setVotersOpen(false);
      return next;
    });
  };

  const vote = (optionId: number) => {
    if (!user) {
      toast('Войдите, чтобы голосовать', 'error');
      return;
    }
    void run(() => api<PollData>(`/polls/${poll.id}/vote`, { method: 'POST', body: { option_id: optionId } }));
  };

  const retract = () => void run(() => api<PollData>(`/polls/${poll.id}/vote`, { method: 'DELETE' }));
  const stop = () => void run(() => api<PollData>(`/polls/${poll.id}/stop`, { method: 'POST' }));
  const remove = () =>
    void run(async () => {
      await api(`/polls/${poll.id}`, { method: 'DELETE' });
      return null;
    });

  if (draft) {
    return (
      <div className={styles.editWrap}>
        <PollBuilder value={draft} onChange={(next) => setDraft(next)} />
        {poll.is_closed ? (
          <label className={styles.reopen}>
            <input type="checkbox" checked={reopen} onChange={(e) => setReopen(e.target.checked)} />
            {'Возобновить опрос'}
          </label>
        ) : null}
        <p className={styles.editHint}>{'Голоса за удалённые варианты пропадут.'}</p>
        <div className={styles.editFoot}>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setDraft(null)}>
            {'Отмена'}
          </button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={saveEdit}>
            {busy ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className={`glass-panel ${styles.poll}`} aria-label="Опрос">
      <h3 className={styles.title}>{poll.title}</h3>
      <ul className={styles.options}>
        {poll.options.map((o) => {
          const mine = poll.my_vote === o.id;
          const canVote = poll.can_vote && !busy;
          return (
            <li key={o.id}>
              <button
                type="button"
                className={`${styles.option} ${mine ? styles.mine : ''}`}
                disabled={!canVote}
                onClick={() => vote(o.id)}
              >
                {showResults ? <span className={styles.bar} style={{ width: `${o.percent ?? 0}%` }} /> : null}
                <span className={styles.mark}>
                  {mine ? <Check size={14} /> : showResults ? null : <Square size={12} />}
                </span>
                <span className={styles.text}>{o.text}</span>
                {showResults ? <span className={styles.percent}>{`${o.percent ?? 0}%`}</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
      {votersOpen && voters ? (
        <ul className={styles.voters}>
          {poll.options.map((o) => {
            const users = voters.options.find((v) => v.option_id === o.id)?.users ?? [];
            return (
              <li key={o.id}>
                <span className={styles.votersOption}>{o.text}</span>
                {users.length === 0 ? (
                  <span className={styles.votersNone}>{'—'}</span>
                ) : (
                  users.map((u) => (
                    <Link key={u.id} href={`/user/${u.username}`} className={styles.voter}>
                      {u.display_name || u.username}
                    </Link>
                  ))
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
      <footer className={styles.foot}>
        <span className={styles.meta}>
          {showResults
            ? `${poll.total_votes} ${votesWord(poll.total_votes ?? 0)}`
            : 'Проголосуйте, чтобы увидеть результаты'}
          {poll.is_closed ? ' · завершён' : null}
          {!poll.is_closed && poll.closes_at ? (
            <span className={styles.until}>
              <Clock size={12} />
              {`до ${formatDateTime(poll.closes_at)}`}
            </span>
          ) : null}
        </span>
        <span className={styles.actions}>
          {poll.can_edit ? (
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={startEdit} title="Редактировать опрос">
              <Pencil size={14} />
            </button>
          ) : null}
          {poll.can_view_voters ? (
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void toggleVoters()}>
              <Users size={14} />
              {votersOpen ? 'Скрыть голоса' : 'Кто голосовал'}
            </button>
          ) : null}
          {poll.can_retract ? (
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={retract}>
              <Undo2 size={14} />
              {'Отменить голос'}
            </button>
          ) : null}
          {poll.can_manage && !poll.is_closed ? (
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setConfirm('stop')}>
              {'Завершить'}
            </button>
          ) : null}
          {poll.can_manage ? (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => setConfirm('remove')}
              title="Удалить опрос"
            >
              <Trash2 size={14} />
            </button>
          ) : null}
        </span>
      </footer>

      <ConfirmDialog
        open={confirm === 'stop'}
        onClose={() => setConfirm(null)}
        onConfirm={stop}
        title="Завершить опрос"
        body="Голосовать и отменять голос после этого будет нельзя. Результаты увидят все."
      />
      <ConfirmDialog
        open={confirm === 'remove'}
        onClose={() => setConfirm(null)}
        onConfirm={remove}
        title="Удалить опрос"
        body="Опрос и все голоса будут удалены."
        danger
      />
    </section>
  );
}

function votesWord(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'голос';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'голоса';
  return 'голосов';
}
