'use client';

import { Plus, Trash2, Link as LinkIcon } from 'lucide-react';
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
        <p className={styles.empty}>{'Пока нет ссылок. Добавьте свои соцсети, чтобы вас нашли.'}</p>
      ) : null}

      {urls.map((u, i) => {
        const invalid = u.trim() !== '' && !validUrl(u.trim());
        return (
          <div key={i} className={styles.row}>
            <span className={styles.rowIcon}>
              <LinkIcon size={14} />
            </span>
            <input
              type="url"
              className={invalid ? `${styles.input} ${styles.invalid}` : styles.input}
              value={u}
              maxLength={MAX_LEN + 20}
              placeholder="https://…"
              onChange={(e) => setAt(i, e.target.value)}
              aria-invalid={invalid}
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
