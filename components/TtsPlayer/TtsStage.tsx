'use client';

import React, { memo, useCallback, useEffect, useRef } from 'react';
import { Download, X } from 'lucide-react';
import { usePlayer, useTts } from '@/lib/player';
import { SILERO_SPEAKERS } from '@/lib/browserNarration';
import Select from '@/components/Select/Select';
import { Tabs } from '@/components/Tabs/Tabs';
import pStyles from '@/components/Player/Player.module.css';
import styles from './TtsStage.module.css';

const bytes = (n: number) => `${Math.round(n / 1e6)} МБ`;
const fill = (v: number, min: number, max: number) => ({ '--p': `${((v - min) / (max - min)) * 100}%` }) as React.CSSProperties;

const Sentence = memo(function Sentence({
  text, idx, state, onPick, setRef,
}: { text: string; idx: number; state: 'cur' | 'past' | 'next'; onPick: (i: number) => void; setRef: (i: number, el: HTMLSpanElement | null) => void }) {
  return (
    <span
      ref={(el) => setRef(idx, el)}
      className={`${styles.s} ${state === 'cur' ? styles.cur : state === 'past' ? styles.past : ''}`}
      onClick={() => onPick(idx)}
    >
      {text}{' '}
    </span>
  );
});

/** Takes the cover's place in the full-screen player while a chapter is narrated in the browser. */
export default function TtsStage() {
  const tts = useTts();
  const { rate, setRate } = usePlayer();
  const els = useRef(new Map<number, HTMLSpanElement>());
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { idx, follow, style, fontSize, sentences, seekSentence } = tts;

  useEffect(() => {
    if (!follow) return;
    const el = els.current.get(idx);
    const box = scrollRef.current;
    if (!el || !box) return;
    box.scrollTo({ top: el.offsetTop - (box.clientHeight - el.offsetHeight) / 2, behavior: 'smooth' });
  }, [idx, follow, style, sentences, fontSize]);

  const setRef = useCallback((i: number, el: HTMLSpanElement | null) => {
    if (el) els.current.set(i, el);
    else els.current.delete(i);
  }, []);
  const onPick = useCallback((i: number) => seekSentence(i), [seekSentence]);

  const silero = tts.engines.find((e) => e.id === 'silero');
  const device = tts.engines.find((e) => e.id === 'device');
  const wide = tts.sentences.length > 0;
  const activeSpeaker = tts.speaker ?? tts.chapterSpeaker;

  const voiceSelect =
    tts.engine === 'device' ? (
      <Select
        block
        ariaLabel="Голос"
        value={tts.deviceVoice}
        placeholder="Нет русского голоса"
        options={tts.deviceVoices.map((v) => ({ value: v.name, label: v.name, hint: v.lang }))}
        onChange={tts.setDeviceVoice}
      />
    ) : (
      <Select
        block
        ariaLabel="Голос"
        value={activeSpeaker}
        options={SILERO_SPEAKERS.map((s) => ({ value: s.id, label: s.label, hint: s.hint }))}
        onChange={tts.setSpeaker}
      />
    );

  return (
    <div className={styles.stage}>
      <section className={styles.reader} data-style={tts.style} style={{ '--fs': `${tts.fontSize}px` } as React.CSSProperties}>
        <div className={styles.rhead}>
          <span className={styles.micro}>{'Текст'}</span>
          <div className={styles.styleTabs}>
            <Tabs
              variant="square"
              tabs={[{ key: 'focus', label: 'Фокус' }, { key: 'prompter', label: 'Суфлёр' }]}
              active={tts.style}
              onChange={(k) => tts.setStyle(k as 'focus' | 'prompter')}
            />
          </div>
        </div>
        <div className={styles.scroll} ref={scrollRef}>
          <div className={styles.text}>
            {tts.loadError ? (
              <p className={styles.msg}>{tts.loadError}</p>
            ) : !wide ? (
              <p className={styles.msg}>{tts.chapter ? 'Загружаем текст…' : ''}</p>
            ) : (
              tts.paras.map((pp, pi) => (
                <p key={pi}>
                  {pp.map((t, si) => {
                    const i = tts.paraStart[pi] + si;
                    return <Sentence key={i} text={t} idx={i} state={i === tts.idx ? 'cur' : i < tts.idx ? 'past' : 'next'} onPick={onPick} setRef={setRef} />;
                  })}
                </p>
              ))
            )}
          </div>
        </div>
        {tts.busy && tts.playing ? (
          <div className={styles.busy}>
            {tts.install ? `Скачиваем модель… ${Math.min(100, Math.round((tts.install.done / Math.max(1, tts.install.total)) * 100))}%` : tts.status ?? 'Готовим озвучку…'}
          </div>
        ) : null}
      </section>

      <aside className={`${styles.side} ${tts.sheet ? styles.sideOpen : ''}`} aria-label="Настройки озвучки">
        <div className={styles.sheetHead}>
          <span className={styles.micro}>{'Настройки озвучки'}</span>
          <button type="button" className={pStyles.iconBtn} onClick={() => tts.setSheet(false)} aria-label="Закрыть"><X /></button>
        </div>

        {device?.available ? (
          <section className={styles.card}>
            <h2 className={styles.micro}>
              <span>Движок</span>
              <span className={styles.microVal}>{tts.engine === 'device' ? 'Встроенный' : silero?.installed ? 'Установлен' : 'Не установлен'}</span>
            </h2>
            <Tabs
              variant="square"
              tabs={[{ key: 'silero', label: 'Silero v5.5' }, { key: 'device', label: 'Встроенный TTS' }]}
              active={tts.engine}
              onChange={(k) => tts.setEngine(k as 'silero' | 'device')}
            />
            {tts.engine === 'silero' ? (
              silero?.installed && !tts.install ? null : (
                <>
                  <div className={styles.row}>
                    <span className={styles.stat}>
                      {silero?.available === false ? 'Модель недоступна на сервере' : <>Не установлена · <b>{bytes(silero?.downloadBytes ?? 0)}</b></>}
                    </span>
                    {tts.install ? (
                      <button type="button" className={`btn ${styles.quiet}`} onClick={tts.cancelInstall}>{'Отмена'}</button>
                    ) : (
                      <button type="button" className="btn" disabled={silero?.available === false} onClick={() => void tts.doInstall()}><Download size={13} />{'Скачать'}</button>
                    )}
                  </div>
                  {tts.install ? <div className={styles.bar}><i style={{ width: `${Math.min(100, (tts.install.done / Math.max(1, tts.install.total)) * 100)}%` }} /></div> : null}
                </>
              )
            ) : (
              <p className={styles.note}>
                {device?.available ? 'Встроенный синтезатор системы: ничего не скачивается, но звучит проще и зависит от устройства.' : 'На этом устройстве нет русского голоса.'}
              </p>
            )}
          </section>
        ) : null}

        <section className={styles.card}>
          <h2 className={styles.micro}>
            <span>Голос</span>
            <span className={styles.microVal}>{tts.engine === 'device' ? 'системные голоса' : ''}</span>
          </h2>
          {voiceSelect}
        </section>

        <section className={styles.card}>
          <h2 className={styles.micro}><span>Скорость</span><span className={styles.stat}><b>{`${rate}×`}</b></span></h2>
          <input type="range" className={styles.range} min={0.5} max={3} step={0.05} value={rate} style={fill(rate, 0.5, 3)} aria-label="Скорость"
            onChange={(e) => setRate(Number(e.target.value))} />
          <div className={styles.sub}>
            <div className={styles.row}><span className={styles.stat}>{'Пауза между фразами'}</span><span className={styles.stat}><b>{`${tts.pause.toFixed(2).replace(/0$/, '')} с`}</b></span></div>
            <input type="range" className={styles.range} min={0.1} max={0.9} step={0.05} value={tts.pause} style={fill(tts.pause, 0.1, 0.9)} aria-label="Пауза между фразами"
              onChange={(e) => tts.setPause(Number(e.target.value))} />
          </div>
        </section>

        <section className={styles.card}>
          <h2 className={styles.micro}><span>Текст</span><span className={styles.microVal}>{`${tts.fontSize} px`}</span></h2>
          <input type="range" className={styles.range} min={16} max={40} step={1} value={tts.fontSize} style={fill(tts.fontSize, 16, 40)} aria-label="Размер текста"
            onChange={(e) => tts.setFontSize(Number(e.target.value))} />
          <div className={styles.row}>
            <span className={styles.stat}>{'Следовать за озвучкой'}</span>
            <button type="button" className={`${styles.sw} ${tts.follow ? styles.swOn : ''}`} aria-pressed={tts.follow} aria-label="Следовать за озвучкой" onClick={() => tts.setFollow(!tts.follow)} />
          </div>
        </section>
      </aside>
      <div className={`${styles.scrim} ${tts.sheet ? styles.scrimOpen : ''}`} onClick={() => tts.setSheet(false)} />
    </div>
  );
}
