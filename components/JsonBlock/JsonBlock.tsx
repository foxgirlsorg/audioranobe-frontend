'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import styles from './JsonBlock.module.css';

type Token = { text: string; kind: string };

const PATTERN = new RegExp(
  [
    '(\\/\\/[^\\n]*)',
    '("(?:[^"\\\\]|\\\\.)*"\\s*:)',
    '("(?:[^"\\\\]|\\\\.)*")',
    '(\\b-?\\d+(?:\\.\\d+)?(?:[eE][-+]?\\d+)?\\b)',
    '(\\btrue\\b|\\bfalse\\b)',
    '(\\bnull\\b)',
    '([{}\\[\\],])',
  ].join('|'),
  'g'
);

const KIND_BY_GROUP: Record<number, string> = {
  1: 'comment',
  2: 'key',
  3: 'str',
  4: 'num',
  5: 'bool',
  6: 'null',
  7: 'punc',
};

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let last = 0;
  for (const m of src.matchAll(PATTERN)) {
    const index = m.index ?? 0;
    if (index > last) {
      out.push({ text: src.slice(last, index), kind: 'plain' });
    }
    let kind = 'plain';
    for (const group of [1, 2, 3, 4, 5, 6, 7]) {
      if (m[group] !== undefined) {
        kind = KIND_BY_GROUP[group];
        break;
      }
    }
    out.push({ text: m[0], kind });
    last = index + m[0].length;
  }
  if (last < src.length) {
    out.push({ text: src.slice(last), kind: 'plain' });
  }
  return out;
}

export default function JsonBlock({
  code,
  label,
  copyText,
}: {
  code: string;
  label?: string;
  copyText?: string;
}) {
  const [done, setDone] = useState(false);
  const tokens = tokenize(code);

  return (
    <div className={styles.wrap}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <div className={styles.body}>
        <pre className={styles.pre}>
          <code>
            {tokens.map((t, i) => (
              <span key={i} className={styles[t.kind]}>
                {t.text}
              </span>
            ))}
          </code>
        </pre>
        <button
          type="button"
          className={styles.copy}
          aria-label={'Скопировать'}
          onClick={() => {
            void navigator.clipboard?.writeText(copyText ?? code).then(() => {
              setDone(true);
              setTimeout(() => setDone(false), 1200);
            });
          }}
        >
          {done ? <Check size={13} /> : <Copy size={13} />}
        </button>
      </div>
    </div>
  );
}
