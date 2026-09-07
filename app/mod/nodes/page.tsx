'use client';

import { useEffect, useState } from 'react';
import { Server, Trash2, Power, PowerOff } from 'lucide-react';
import { api } from '@/lib/api';
import { errMsg, useToast } from '@/lib/toast';
import type { WorkerNode, NodeCredentials, NodeType } from '@/lib/types';
import Spinner from '@/components/Spinner/Spinner';
import EmptyState from '@/components/EmptyState/EmptyState';
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog';
import { ModShell, ErrorPanel, splitHeading } from '@/app/mod/modnav';
import styles from './page.module.css';

function dotClass(n: WorkerNode): string {
  if (!n.online) return styles.dotOffline;
  return n.state === 'working' ? styles.dotWorking : styles.dotIdle;
}

function stateLabel(n: WorkerNode): string {
  if (!n.online) return 'офлайн';
  return n.state === 'working' ? 'работает' : 'ожидает';
}

function NodesContent() {
  const { toast } = useToast();

  const [nodes, setNodes] = useState<WorkerNode[] | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  const [name, setName] = useState('');
  const [type, setType] = useState<NodeType>('converter');
  const [creating, setCreating] = useState(false);
  const [creds, setCreds] = useState<NodeCredentials | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [toDelete, setToDelete] = useState<WorkerNode | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api<{ items: WorkerNode[] }>('/mod/nodes')
        .then((d) => {
          if (alive) {
            setNodes(d.items);
            setError('');
          }
        })
        .catch((e) => {
          if (alive && nodes === null) setError(errMsg(e));
        });
    void load();
    // Refresh status periodically — heartbeats move the dots.
    const t = setInterval(load, 10000);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await api<{ node: WorkerNode; credentials: NodeCredentials }>('/mod/nodes', {
        method: 'POST',
        body: { name: name.trim(), type },
      });
      setCreds(res.credentials);
      setName('');
      setNodes((prev) => (prev ? [...prev, res.node] : [res.node]));
      toast('Нода авторизована');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setCreating(false);
  };

  const toggle = async (n: WorkerNode) => {
    setBusyId(n.id);
    try {
      const res = await api<{ node: WorkerNode }>(`/mod/nodes/${n.id}/${n.enabled ? 'disable' : 'enable'}`, {
        method: 'POST',
      });
      setNodes((prev) => (prev ? prev.map((x) => (x.id === n.id ? res.node : x)) : prev));
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setBusyId(null);
  };

  const remove = async (n: WorkerNode) => {
    setBusyId(n.id);
    try {
      await api(`/mod/nodes/${n.id}`, { method: 'DELETE' });
      setToDelete(null);
      setNodes((prev) => (prev ? prev.filter((x) => x.id !== n.id) : prev));
      toast('Нода удалена');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setBusyId(null);
  };

  if (error) {
    return <ErrorPanel message={error} onRetry={() => setReload((n) => n + 1)} />;
  }
  if (nodes === null) {
    return (
      <div className={styles.loading}>
        <Spinner />
      </div>
    );
  }

  return (
    <>
      <p className={styles.hint}>
        {
          'Ноды получают задачи из RabbitMQ и авторизуются здесь: каждой заводится отдельная учётная запись брокера. Отключение сразу обрывает доступ. Секрет показывается один раз при создании.'
        }
      </p>

      <div className={styles.toolbar}>
        <div className={styles.field}>
          <label htmlFor="node-name">{'Имя'}</label>
          <input
            id="node-name"
            className="input"
            value={name}
            maxLength={64}
            placeholder={'например, converter-1'}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="node-type">{'Тип'}</label>
          <select id="node-type" className="input" value={type} onChange={(e) => setType(e.target.value as NodeType)}>
            <option value="converter">{'Конвертер'}</option>
            <option value="narrator">{'Озвучка'}</option>
          </select>
        </div>
        <button type="button" className="btn btn-primary" disabled={creating || !name.trim()} onClick={() => void create()}>
          {'Авторизовать'}
        </button>
      </div>

      {creds ? (
        <div className={`glass-panel ${styles.creds}`}>
          <h3>{'Учётные данные ноды (показаны один раз)'}</h3>
          <div className={styles.credRow}>
            <span>{'AMQP_URL:'}</span>
            <code>{`amqp://${creds.rmq_username}:${creds.secret}@ХОСТ:5672/`}</code>
          </div>
          <div className={styles.credRow}>
            <span>{'Пользователь:'}</span> <code>{creds.rmq_username}</code>
            <span>{'Секрет:'}</span> <code>{creds.secret}</code>
          </div>
          <div className={styles.credRow}>
            <span>{'Очередь:'}</span> <code>{creds.queue}</code>
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => setCreds(null)}>
            {'Скрыть'}
          </button>
        </div>
      ) : null}

      {nodes.length === 0 ? (
        <EmptyState icon={Server} title={'Нод пока нет'} />
      ) : (
        <div className={styles.list}>
          {nodes.map((n) => {
            const busy = busyId === n.id;
            return (
              <div key={n.id} className={`glass-panel ${styles.row}`}>
                <div className={styles.rowHead}>
                  <span className={`${styles.dot} ${dotClass(n)}`} aria-hidden="true" />
                  <span className={styles.name}>{n.name}</span>
                  <span className={styles.badge}>{n.type === 'narrator' ? 'озвучка' : 'конвертер'}</span>
                  <span className={styles.badge}>{stateLabel(n)}</span>
                  {!n.enabled ? <span className={styles.badge}>{'отключена'}</span> : null}
                  <span className={styles.spacer} />
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={busy}
                      onClick={() => void toggle(n)}
                      title={n.enabled ? 'Отключить' : 'Включить'}
                    >
                      {n.enabled ? <PowerOff size={14} /> : <Power size={14} />}
                      {n.enabled ? ' Отключить' : ' Включить'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={busy}
                      onClick={() => setToDelete(n)}
                      title={'Удалить'}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className={styles.meta}>
                  <span>{`задач выполнено: ${n.jobs_done}`}</span>
                  {n.current_job ? <span>{`текущая задача: #${n.current_job}`}</span> : null}
                  {n.version ? <span>{`версия: ${n.version}`}</span> : null}
                  <span>{n.last_seen_at ? `последний сигнал: ${n.last_seen_at}` : 'сигналов не было'}</span>
                </div>
                {n.last_error ? <div className={styles.err}>{`последняя ошибка: ${n.last_error}`}</div> : null}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) void remove(toDelete);
        }}
        title={'Удалить ноду'}
        body={toDelete ? `Удалить ноду «${toDelete.name}»? Её учётная запись в RabbitMQ будет удалена.` : ''}
        danger
      />
    </>
  );
}

export default function ModNodesPage() {
  const h = splitHeading('Рабочие ноды');
  return (
    <ModShell title={h.title} accent={h.accent} perm="nodes.manage">
      <NodesContent />
    </ModShell>
  );
}
