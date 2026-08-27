'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, Save, Play, Send, Download } from 'lucide-react';
import { api } from '@/lib/api';
import { errMsg, useToast } from '@/lib/toast';
import type { RecapDesign, RecapDesignState } from '@/lib/types';
import { fillTemplate, RECAP_TOKENS, SAMPLE_RECAP } from '@/lib/recapTemplate';
import { downloadNodeJpg } from '@/lib/exportImage';
import RecapCard from '@/components/RecapCard/RecapCard';
import { ModShell, splitHeading } from '@/app/mod/modnav';
import styles from './page.module.css';

const THIS_YEAR = new Date().getFullYear();

function RecapContent() {
  const { toast } = useToast();
  const [year, setYear] = useState(THIS_YEAR - 1);
  const [design, setDesign] = useState<RecapDesign | null>(null);
  const [generated, setGenerated] = useState(0);
  const [notifyText, setNotifyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [counting, setCounting] = useState(false);
  const [sending, setSending] = useState(false);
  const [rendering, setRendering] = useState(false);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const loadDesign = useCallback(async (y: number) => {
    setLoading(true);
    try {
      const res = await api<RecapDesignState>('/mod/recap/design', { params: { year: y } });
      setDesign(res.design);
      setNotifyText(res.notify_text);
      setGenerated(res.generated);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadDesign(year);
  }, [year, loadDesign]);

  const set = (k: keyof RecapDesign, v: string) => setDesign((d) => (d ? { ...d, [k]: v } : d));

  const saveDesign = async () => {
    if (!design) return;
    setSaving(true);
    try {
      await api('/mod/recap/design', { method: 'PUT', body: { year, ...design } });
      toast('Оформление сохранено');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setSaving(false);
  };

  const count = async () => {
    setCounting(true);
    try {
      const res = await api<{ users: number }>('/mod/recap/count', { method: 'POST', body: { year } });
      setGenerated(res.users);
      toast(`Итоги посчитаны для ${res.users} польз.`);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setCounting(false);
  };

  const send = async () => {
    setSending(true);
    try {
      const res = await api<{ sent: number }>('/mod/recap/send', { method: 'POST', body: { year, text: notifyText } });
      toast(`Уведомление отправлено: ${res.sent}`);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setSending(false);
  };

  const testRender = async () => {
    if (!previewRef.current) return;
    setRendering(true);
    try {
      await downloadNodeJpg(previewRef.current, `recap-card-${year}`);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
    setRendering(false);
  };

  const preview = { ...SAMPLE_RECAP, period_label: String(year) };

  return (
    <div className={styles.wrapCols}>
      <div className={`glass-panel ${styles.panel}`}>
        <div className={styles.pickerBlock}>
          <span className={styles.blockLabel}>{'Год'}</span>
          <input
            className="input"
            type="number"
            min={2000}
            max={THIS_YEAR}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            style={{ maxWidth: 140 }}
          />
        </div>

        {design ? (
          <>
            <label className={styles.field}>
              <span className={styles.blockLabel}>{'HTML карточки'}</span>
              <textarea
                className="textarea"
                rows={12}
                spellCheck={false}
                value={design.html}
                onChange={(e) => set('html', e.target.value)}
                style={{ fontFamily: 'monospace', fontSize: 12.5 }}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.blockLabel}>{'CSS'}</span>
              <textarea
                className="textarea"
                rows={12}
                spellCheck={false}
                value={design.css}
                onChange={(e) => set('css', e.target.value)}
                style={{ fontFamily: 'monospace', fontSize: 12.5 }}
              />
            </label>

            <div className={styles.tokens}>
              <span className={styles.blockLabel}>{'Плейсхолдеры (кликните, чтобы скопировать)'}</span>
              <div className={styles.tokenGrid}>
                {RECAP_TOKENS.map(([tok, hint]) => (
                  <button
                    key={tok}
                    type="button"
                    className={styles.token}
                    title={hint}
                    onClick={() => {
                      void navigator.clipboard.writeText(tok).then(
                        () => toast('Скопировано', 'ok'),
                        () => {}
                      );
                    }}
                  >
                    {tok}
                  </button>
                ))}
              </div>
            </div>

            <label className={styles.field}>
              <span className={styles.blockLabel}>{'Текст уведомления при рассылке'}</span>
              <input
                className="input"
                value={notifyText}
                maxLength={500}
                onChange={(e) => setNotifyText(e.target.value)}
                placeholder={`Ваши итоги ${year} готовы 🎉`}
              />
            </label>

            <p className={styles.preview}>
              <Sparkles size={14} aria-hidden="true" />
              {generated > 0
                ? `Снимки посчитаны для ${generated} польз. «Посчитать» пересчитает их, «Разослать» отправит уведомление.`
                : 'Итоги ещё не считались. Сначала «Посчитать», затем «Разослать».'}
            </p>

            <div className={styles.demoRow}>
              <span className={styles.blockLabel}>{'Тест с примером данных'}</span>
              <div className={styles.sendRow} style={{ justifyContent: 'flex-start' }}>
                <a className="btn" href="/me/recap?demo=1" target="_blank" rel="noopener noreferrer">
                  {'Демо: месяц'}
                </a>
                <a className="btn" href={`/me/recap/${year}?demo=1`} target="_blank" rel="noopener noreferrer">
                  {`Демо: ${year}`}
                </a>
              </div>
            </div>

            <div className={styles.sendRow}>
              <button type="button" className="btn" disabled={saving} onClick={saveDesign}>
                <Save size={14} /> {saving ? 'Сохранение…' : 'Сохранить оформление'}
              </button>
              <button type="button" className="btn" disabled={counting} onClick={count}>
                <Play size={14} /> {counting ? 'Считаем…' : `Посчитать ${year}`}
              </button>
              <button type="button" className="btn btn-primary" disabled={sending || generated === 0} onClick={send}>
                <Send size={14} /> {sending ? 'Отправка…' : 'Разослать'}
              </button>
            </div>
          </>
        ) : (
          <p className={styles.preview}>{loading ? 'Загрузка…' : 'Не удалось загрузить оформление.'}</p>
        )}
      </div>

      {design ? (
        <div className={styles.previewCol}>
          <span className={styles.blockLabel}>{'Превью (с примером данных)'}</span>
          <div ref={previewRef}>
            <RecapCard html={fillTemplate(design.html, preview)} css={design.css} />
          </div>
          <button type="button" className="btn" onClick={testRender} disabled={rendering}>
            <Download size={14} /> {rendering ? 'Рендерим…' : 'Тест-рендер (PNG)'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function ModRecapPage() {
  const h = splitHeading('Итоги года');
  return (
    <ModShell title={h.title} accent={h.accent}>
      <RecapContent />
    </ModShell>
  );
}
