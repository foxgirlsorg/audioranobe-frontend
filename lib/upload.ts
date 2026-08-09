
import { API_URL, ApiError, api } from '@/lib/api';

export interface UploadSession {
  id: number;
  filename: string;
  size: number;
  received: number;
  complete: boolean;
  chunk_size: number;
}

const MAX_CHUNK_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1200;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function putChunk(
  uploadId: number,
  offset: number,
  blob: Blob,
  onBytes: (sentInChunk: number) => void,
  signal?: AbortSignal
): Promise<UploadSession> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', `${API_URL}/panel/uploads/${uploadId}?offset=${offset}`);
    xhr.withCredentials = true; // send the HttpOnly auth cookie
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onBytes(e.loaded);
    };
    xhr.onload = () => {
      let data: any;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        data = undefined;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data as UploadSession);
      } else {
        reject(
          new ApiError(
            xhr.status,
            data && typeof data.error === 'string' && data.error
              ? data.error
              : `Не удалось отправить фрагмент (${xhr.status})`
          )
        );
      }
    };
    xhr.onerror = () => reject(new ApiError(0, 'Ошибка сети при загрузке'));
    xhr.onabort = () => reject(new ApiError(0, 'Загрузка отменена'));
    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        return;
      }
      signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }
    xhr.send(blob);
  });
}

export async function uploadInChunks(
  file: File,
  onProgress?: (frac: number) => void,
  signal?: AbortSignal
): Promise<number> {
  const session = await api<UploadSession>('/panel/uploads', {
    body: { filename: file.name, size: file.size },
  });

  const chunkSize = session.chunk_size > 0 ? session.chunk_size : 5 * 1024 * 1024;
  let offset = session.received;
  const report = (sent: number) => {
    if (onProgress) onProgress(file.size > 0 ? Math.min(1, sent / file.size) : 1);
  };
  report(offset);

  let failures = 0;
  while (offset < file.size) {
    const start = offset;
    const blob = file.slice(start, Math.min(start + chunkSize, file.size));
    try {
      const next = await putChunk(
        session.id,
        start,
        blob,
        (sentInChunk) => report(start + sentInChunk),
        signal
      );
      offset = next.received;
      failures = 0;
      report(offset);
    } catch (e) {
      failures++;
      if (signal?.aborted || failures >= MAX_CHUNK_ATTEMPTS) throw e;
      await sleep(RETRY_DELAY_MS * failures);
      try {
        const state = await api<UploadSession>(`/panel/uploads/${session.id}`);
        offset = state.received;
        report(offset);
      } catch {
      }
    }
  }

  return session.id;
}

export async function abortUpload(uploadId: number): Promise<void> {
  try {
    await api(`/panel/uploads/${uploadId}`, { method: 'DELETE' });
  } catch {
  }
}
