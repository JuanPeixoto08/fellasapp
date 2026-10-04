import { useCallback, useEffect, useState } from 'react';

import { listActiveStories, type StoryGroup } from './api/stories';
import { useSession } from './auth/SessionProvider';
import { debounce, LIVE_DEBOUNCE_MS, onLive } from './realtime';
import { orderGroups } from './storyPlayer';
import { onStoriesChanged } from './storyViewerStore';
import { useToday } from './useToday';

/** Stories ativos para a faixa, ordenados; recarrega ao vivo, ao postar/apagar e na virada do dia. */
export function useStories(): { groups: StoryGroup[]; loading: boolean; reload: () => void } {
  const myId = useSession().session?.user.id ?? '';
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const today = useToday();

  const reload = useCallback(() => {
    listActiveStories()
      .then((g) => setGroups(orderGroups(g, myId)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [myId]);

  useEffect(reload, [reload, today]);
  useEffect(() => onStoriesChanged(reload), [reload]);
  useEffect(() => {
    const live = debounce(reload, LIVE_DEBOUNCE_MS);
    const off = onLive((e) => {
      if (e.kind === 'resync' || e.table === 'stories') live();
    });
    // story vence sozinho: confere de 5 em 5 minutos
    const timer = setInterval(reload, 5 * 60 * 1000);
    return () => {
      live.cancel();
      off();
      clearInterval(timer);
    };
  }, [reload]);

  return { groups, loading, reload };
}
