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
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToBuffer(key),
    });
  }

  const json = sub.toJSON();
  await api('/me/push-subscriptions', {
    method: 'PUT',
    body: { endpoint: json.endpoint, keys: json.keys },
  });
  return 'granted';
}
