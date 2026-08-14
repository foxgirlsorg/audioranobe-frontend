'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errMsg, useToast } from '@/lib/toast';

/**
 * Request AI narration for a title that isn't in the catalog yet. Adds the title
 * on the backend and navigates to its (initially empty) page while chapters
 * narrate. `pendingSlug` is the ref currently in-flight, for per-card spinners.
 */
export function useRequestNarration() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);

  const request = useCallback(
    async (ref: string) => {
      if (pendingSlug) return;
      if (!user) {
        toast('Войдите, чтобы заказать озвучку', 'error');
        router.push('/auth/login');
        return;
      }
      setPendingSlug(ref);
      try {
        const res = await api<{ slug: string; already: boolean }>('/titles/request-narration', {
          body: { ref },
        });
        toast(
          res.already ? 'Этот тайтл уже озвучивается' : 'Озвучка заказана — скоро будет готова',
          'ok'
        );
        router.push(`/title/${res.slug}`);
      } catch (e) {
        toast(errMsg(e), 'error');
      } finally {
        setPendingSlug(null);
      }
    },
    [pendingSlug, user, router, toast]
  );

  return { request, pendingSlug };
}
