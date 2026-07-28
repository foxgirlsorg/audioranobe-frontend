'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Send } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast, errMsg } from '@/lib/toast';
import styles from './page.module.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function DmcaPage() {
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('');
  const [contentUrls, setContentUrls] = useState(['']);
  const [originalUrls, setOriginalUrls] = useState(['']);
  const [proofUrl, setProofUrl] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const updateList = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    idx: number,
    value: string
  ) => setter((prev) => prev.map((u, i) => (i === idx ? value : u)));

  const addRow = (setter: React.Dispatch<React.SetStateAction<string[]>>) =>
    setter((prev) => [...prev, '']);

  const removeRow = (setter: React.Dispatch<React.SetStateAction<string[]>>, idx: number) =>
    setter((prev) => (prev.length <= 1 ? [''] : prev.filter((_, i) => i !== idx)));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Введите ваше имя';
    if (!EMAIL_RE.test(email.trim())) errs.email = 'Введите корректный email';
    if (!country.trim()) errs.country = 'Укажите страну';
    if (!contentUrls.some((u) => u.trim())) errs.content_url = 'Укажите хотя бы одну ссылку на контент';
    if (!originalUrls.some((u) => u.trim())) errs.original_url = 'Укажите хотя бы одну ссылку на оригинал';
    if (!proofUrl.trim()) errs.proof_url = 'Приложите подтверждение авторства';
    setErrors(errs);
    setFormError('');
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      await api('/dmca', {
        body: {
          name: name.trim(),
          email: email.trim(),
          country: country.trim(),
          content_urls: contentUrls.map((u) => u.trim()).filter(Boolean),
          original_urls: originalUrls.map((u) => u.trim()).filter(Boolean),
          proof_url: proofUrl.trim(),
          description: description.trim(),
          ...(website.trim() ? { website: website.trim() } : {}),
        },
      });
      setSuccess(true);
    } catch (err) {
      setFormError(errMsg(err));
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>
        {'Политика'} <span className={styles.titleAccent}>{'DMCA'}</span>
      </h1>

      <div className={`glass-panel ${styles.section}`}>
        <h2 className={styles.sectionTitle}>{'Защита авторских прав'}</h2>
        <p className={styles.text}>
          {'AudioRanobe уважает права интеллектуальной собственности и ожидает того же от пользователей. Если вы являетесь правообладателем или его представителем и считаете, что материалы на платформе нарушают ваши авторские права, вы можете подать жалобу через форму ниже.'}
        </p>
      </div>

      {success ? (
        <div className={`glass-panel ${styles.success}`}>
          {'Ваша жалоба DMCA успешно отправлена и будет рассмотрена в ближайшее время.'}
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className={`glass-panel ${styles.form}`}>
          <h2 className={styles.formTitle}>{'Подать жалобу DMCA'}</h2>

          {formError ? (
            <div className="form-error" role="alert" style={{ marginBottom: '1rem' }}>
              {formError}
            </div>
          ) : null}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="dmca-name">
              {'Ваше имя'}
            </label>
            <input
              id="dmca-name"
              className={`input ${errors.name ? styles.inputError : ''}`}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={'Иван Иванов'}
              aria-invalid={!!errors.name}
            />
            {errors.name && <div className={styles.fieldError}>{errors.name}</div>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="dmca-email">
              {'Email для связи'}
            </label>
            <input
              id="dmca-email"
              className={`input ${errors.email ? styles.inputError : ''}`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={'you@example.com'}
              aria-invalid={!!errors.email}
            />
            {errors.email && <div className={styles.fieldError}>{errors.email}</div>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="dmca-country">
              {'Страна'}
            </label>
            <input
              id="dmca-country"
              className={`input ${errors.country ? styles.inputError : ''}`}
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder={'Россия'}
              aria-invalid={!!errors.country}
            />
            {errors.country && <div className={styles.fieldError}>{errors.country}</div>}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              {'Ссылки на материалы, которые нужно удалить'}
            </label>
            {contentUrls.map((url, i) => (
              <div key={`c-${i}`} className={styles.rowField}>
                <input
                  className={`input ${errors.content_url ? styles.inputError : ''}`}
                  type="url"
                  value={url}
                  onChange={(e) => updateList(setContentUrls, i, e.target.value)}
                  placeholder={'https://audioranobe.com/title/example'}
                  aria-invalid={!!errors.content_url}
                />
                <button type="button" className="btn btn-ghost" onClick={() => removeRow(setContentUrls, i)}>
                  {'—'}
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-ghost" onClick={() => addRow(setContentUrls)}>
              {'Добавить ссылку'}
            </button>
            {errors.content_url && <div className={styles.fieldError}>{errors.content_url}</div>}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>{'Ссылки на оригинальное размещение этих материалов'}</label>
            {originalUrls.map((url, i) => (
              <div key={`o-${i}`} className={styles.rowField}>
                <input
                  className={`input ${errors.original_url ? styles.inputError : ''}`}
                  type="url"
                  value={url}
                  onChange={(e) => updateList(setOriginalUrls, i, e.target.value)}
                  placeholder={'https://…'}
                  aria-invalid={!!errors.original_url}
                />
                <button type="button" className="btn btn-ghost" onClick={() => removeRow(setOriginalUrls, i)}>
                  {'—'}
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-ghost" onClick={() => addRow(setOriginalUrls)}>
              {'Добавить ссылку'}
            </button>
            {errors.original_url && <div className={styles.fieldError}>{errors.original_url}</div>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="dmca-proof">
              {'Подтверждение того, что вы автор'}
            </label>
            <textarea
              id="dmca-proof"
              className={`textarea ${errors.proof_url ? styles.inputError : ''}`}
              value={proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
              placeholder={'Ссылка на страницу автора, договор, скан документа или иное подтверждение…'}
              aria-invalid={!!errors.proof_url}
            />
            {errors.proof_url && <div className={styles.fieldError}>{errors.proof_url}</div>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="dmca-desc">
              {'Описание проблемы'} <span className={styles.optional}>{'необязательно'}</span>
            </label>
            <textarea
              id="dmca-desc"
              className="textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={'Опишите, каким образом нарушены ваши авторские права…'}
            />
          </div>

          <div className={styles.field} style={{ display: 'none' }} aria-hidden="true">
            <label htmlFor="dmca-website">{'Не заполняйте'}</label>
            <input
              id="dmca-website"
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            <Send size={15} />
            {submitting ? 'Отправляем…' : 'Отправить жалобу'}
          </button>
        </form>
      )}

      <Link href="/" className={styles.back}>
        <ArrowLeft size={14} />
        {'На главную'}
      </Link>
    </div>
  );
}
