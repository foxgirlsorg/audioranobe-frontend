import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import styles from './page.module.css';

export default function PrivacyPage() {
  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>
        {'Политика'} <span className={styles.titleAccent}>{'конфиденциальности'}</span>
      </h1>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>{'Сбор данных'}</h2>
        <p className={styles.text}>
          {
            'AudioRanobe собирает только те данные, которые необходимы для предоставления и улучшения сервиса. Это включает: информацию, указанную при регистрации (имя пользователя, email), историю прослушивания, избранные аудиокниги и настройки пользователя.'
          }
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>{'Использование данных'}</h2>
        <p className={styles.text}>
          {
            'Собранные данные используются исключительно для работы сервиса: персонализация рекомендаций, сохранение прогресса прослушивания и улучшение качества интерфейса. Мы не продаём данные третьим сторонам и не используем их для показа рекламы.'
          }
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>{'Трекинг и аналитика'}</h2>
        <p className={styles.text}>
          {
            'AudioRanobe не использует сторонние сервисы отслеживания, рекламные сети или аналитические трекеры. Мы не передаём информацию о вашем поведении на сайте третьим сторонам.'
          }
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>{'Хранение данных'}</h2>
        <p className={styles.text}>
          {
            'Данные хранятся на защищённых серверах сервиса. Для авторизации используются JWT-токены, хранящиеся в localStorage вашего браузера. Настройки интерфейса также сохраняются локально.'
          }
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>{'Удаление аккаунта'}</h2>
        <p className={styles.text}>
          {
            'Вы имеете право удалить свой аккаунт и все связанные данные в любой момент. Это можно сделать через настройки профиля. После удаления все ваши данные будут безвозвратно стёрты с наших серверов.'
          }
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>{'Контакты'}</h2>
        <p className={styles.text}>
          {
            'По вопросам конфиденциальности обращайтесь к администрации сервиса через форму обратной связи или по адресу электронной почты, указанному на сайте.'
          }
        </p>
      </div>

      <Link href="/legal" className={styles.back}>
        <ArrowLeft size={14} />
        {'Назад к правовой информации'}
      </Link>
    </div>
  );
}
