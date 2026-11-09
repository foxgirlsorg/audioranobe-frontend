'use client';

import React, { useState } from 'react';
import { api } from '@/lib/api';
import { errMsg, useToast } from '@/lib/toast';
import { chapterNumberLabel } from '@/lib/format';
import Modal from '@/components/Modal/Modal';
import Select from '@/components/Select/Select';
import styles from './TextBranch.module.css';

export interface VolumeOption {
  id: number;
  number: number;
  name: string;
}

const volumeLabel = (label: string, v: VolumeOption): string =>
  `${label} ${chapterNumberLabel(v.number)}${v.name ? ` · ${v.name}` : ''}`;

export function AddChapterModal({
  titleId,
  volumes,
  volumeWord,
  defaultVolumeId,
  nextNumber,
  onClose,
  onDone,
}: {
  titleId: number;
  volumes: VolumeOption[];
  volumeWord: string;
  defaultVolumeId: number;
  nextNumber: (volumeId: number) => number;
  onClose: () => void;
  onDone: () => Promise<void> | void;
}) {
  const { toast } = useToast();
  const [volumeId, setVolumeId] = useState(String(defaultVolumeId));
  const [number, setNumber] = useState(String(nextNumber(defaultVolumeId)));
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(number);
    if (!Number.isFinite(n) || n < 0) {
      toast('Номер должен быть числом не меньше 0', 'error');
      return;
    }
    if (!text.trim()) {
      toast('Вставьте текст главы', 'error');
      return;
    }
    setBusy(true);
    try {
      await api(`/panel/titles/${titleId}/texts/chapters`, {
        method: 'POST',
        body: { volume_id: Number(volumeId), number: n, name: name.trim(), text },
      });
      toast('Глава добавлена');
      await onDone();
      onClose();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Добавить главу" size="wide">
      <form className={styles.form} onSubmit={submit}>
        <div className={styles.formRow}>
          <label className={styles.field}>
            <span>{volumeWord}</span>
            <Select
              block
              value={volumeId}
              options={volumes.map((v) => ({ value: String(v.id), label: volumeLabel(volumeWord, v) }))}
              onChange={(v) => {
                setVolumeId(v);
                setNumber(String(nextNumber(Number(v))));
              }}
              ariaLabel={volumeWord}
            />
          </label>
          <label className={styles.field}>
            <span>Номер</span>
            <input className="input" type="number" step="any" min={0} value={number} onChange={(e) => setNumber(e.target.value)} />
          </label>
        </div>
        <label className={styles.field}>
          <span>Название</span>
          <input className="input" value={name} maxLength={300} placeholder="Необязательно" onChange={(e) => setName(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Текст</span>
          <textarea className={`input ${styles.area}`} value={text} spellCheck={false} onChange={(e) => setText(e.target.value)} />
        </label>
        <div className={styles.editorFoot}>
          <span className={styles.grow} />
          <button type="button" className="btn btn-ghost" onClick={onClose}>Отмена</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Добавляем…' : 'Добавить'}</button>
        </div>
      </form>
    </Modal>
  );
}

export function EditVolumeModal({
  volume,
  volumeWord,
  onClose,
  onDone,
}: {
  volume: VolumeOption;
  volumeWord: string;
  onClose: () => void;
  onDone: () => Promise<void> | void;
}) {
  const { toast } = useToast();
  const [number, setNumber] = useState(String(volume.number));
  const [name, setName] = useState(volume.name);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(number);
    if (!Number.isFinite(n) || n < 0) {
      toast('Номер должен быть числом не меньше 0', 'error');
      return;
    }
    setBusy(true);
    try {
      await api(`/panel/volumes/${volume.id}`, { method: 'PATCH', body: { number: n, name: name.trim() } });
      toast('Сохранено');
      await onDone();
      onClose();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Править: ${volumeLabel(volumeWord, volume)}`}>
      <form className={styles.form} onSubmit={submit}>
        <label className={styles.field}>
          <span>Номер</span>
          <input className="input" type="number" step="any" min={0} value={number} onChange={(e) => setNumber(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Название</span>
          <input className="input" value={name} maxLength={300} placeholder="Необязательно" onChange={(e) => setName(e.target.value)} />
        </label>
        <div className={styles.editorFoot}>
          <span className={styles.grow} />
          <button type="button" className="btn btn-ghost" onClick={onClose}>Отмена</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Сохраняем…' : 'Сохранить'}</button>
        </div>
      </form>
    </Modal>
  );
}

export function MoveModal({
  titleId,
  ids,
  volumes,
  volumeWord,
  onClose,
  onDone,
}: {
  titleId: number;
  ids: number[];
  volumes: VolumeOption[];
  volumeWord: string;
  onClose: () => void;
  onDone: () => Promise<void> | void;
}) {
  const { toast } = useToast();
  const [volumeId, setVolumeId] = useState(String(volumes[0]?.id ?? ''));
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api<{ updated: number }>(`/panel/titles/${titleId}/chapters/bulk-edit`, {
        method: 'POST',
        body: { chapter_ids: ids, volume_id: Number(volumeId) },
      });
      toast(`Перемещено глав: ${res?.updated ?? ids.length}`);
      await onDone();
      onClose();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Переместить глав: ${ids.length}`}>
      <form className={styles.form} onSubmit={submit}>
        <label className={styles.field}>
          <span>{`В ${volumeWord.toLowerCase()}`}</span>
          <Select
            block
            value={volumeId}
            options={volumes.map((v) => ({ value: String(v.id), label: volumeLabel(volumeWord, v) }))}
            onChange={setVolumeId}
            ariaLabel={volumeWord}
          />
        </label>
        <div className={styles.editorFoot}>
          <span className={styles.grow} />
          <button type="button" className="btn btn-ghost" onClick={onClose}>Отмена</button>
          <button type="submit" className="btn btn-primary" disabled={busy || !volumeId}>{busy ? 'Переносим…' : 'Переместить'}</button>
        </div>
      </form>
    </Modal>
  );
}
