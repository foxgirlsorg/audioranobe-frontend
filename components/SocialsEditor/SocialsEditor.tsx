'use client';

import { Plus, Trash2 } from 'lucide-react';
import { hostOf, platformOf } from '@/components/SocialLinks/brands';
import styles from './SocialsEditor.module.css';

const MAX_LINKS = 10;
const MAX_LEN = 200;

function validUrl(u: string): boolean {
  if (u.length > MAX_LEN) return false;
  try {
    const p = new URL(u);
    return p.protocol === 'http:' || p.protocol === 'https:';
  } catch {
    return false;
  }
}

export function SocialsEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
}) {
  const urls = value ?? [];

  const setAt = (i: number, v: string) => onChange(urls.map((u, j) => (j === i ? v : u)));
  const removeAt = (i: number) => onChange(urls.filter((_, j) => j !== i));
  const add = () => {
    if (urls.length < MAX_LINKS) onChange([...urls, '']);
  };

  return (
    <div className={styles.editor}>
      {urls.length === 0 ? (
        <p className={styles.empty}>{'Пока нет ссылок.'}</p>
      ) : null}

      {urls.map((u, i) => {
        const invalid = u.trim() !== '' && !validUrl(u.trim());
        const { icon: Icon, label } = platformOf(hostOf(u.trim()));
        return (
          <div key={i} className={styles.row}>
            <span className={styles.rowIcon} title={label}>
              <Icon size={14} />
            </span>
            <input
              type="url"
              className={invalid ? `${styles.input} ${styles.invalid}` : styles.input}
              value={u}
              maxLength={MAX_LEN}
              placeholder="https://…"
              onChange={(e) => setAt(i, e.target.value)}
              aria-invalid={invalid}
              aria-label={`Ссылка ${i + 1}`}
            />
            <button
              type="button"
              className={styles.remove}
              onClick={() => removeAt(i)}
              aria-label={'Удалить ссылку'}
              title={'Удалить ссылку'}
            >
              <Trash2 size={15} />
            </button>
            {invalid ? (
              <span className={styles.err}>
                {`Должен быть http(s) URL, максимум ${MAX_LEN} символов`}
              </span>
            ) : null}
          </div>
        );
      })}

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.add}
          onClick={add}
          disabled={urls.length >= MAX_LINKS}
        >
          <Plus size={14} />
          {'Добавить ссылку'}
        </button>
        <span className={styles.counter}>
          {urls.length}/{MAX_LINKS}
        </span>
      </div>
    </div>
  );
}

export default SocialsEditor;
