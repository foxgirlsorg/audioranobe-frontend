import { api } from './api';

export type PushState = 'granted' | 'denied' | 'default' | 'unsupported';

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function pushPermission(): PushState {
  if (!pushSupported()) return 'unsupported';
  return Notification.permission as PushState;
}

function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(msg)), ms)),
  ]);
}

function urlB64ToBuffer(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return buf;
}

export async function enablePush(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm as PushState;

  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  const { key } = await api<{ key: string }>('/push/public-key');
  if (!key) throw new Error('Push-уведомления не настроены на сервере');

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    // Chrome routes subscription through Google's push service; on networks that
    // can't reach it the call hangs forever, so cap it instead of spinning.
    sub = await withTimeout(
      reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToBuffer(key),
      }),
      20000,
      'Не удалось подключиться к службе push-уведомлений — проверьте соединение и попробуйте снова'
    );
  }

  const json = sub.toJSON();
  await api('/me/push-subscriptions', {
    method: 'PUT',
    body: { endpoint: json.endpoint, keys: json.keys },
  });
  return 'granted';
}

export async function pushSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return false;
  return !!(await reg.pushManager.getSubscription());
}

export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (!sub) return;
  const { endpoint } = sub;
  await sub.unsubscribe();
  await api('/me/push-subscriptions', { method: 'DELETE', body: { endpoint } });
}
