import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useSession } from '../../lib/auth/SessionProvider';
import { actorOf, emitLive, LIVE_TABLES, type LiveChange } from '../../lib/realtime';
import { supabase } from '../../lib/supabase';

type Payload = { eventType: LiveChange['type']; new: Record<string, unknown>; old: Record<string, unknown> };

/**
 * Uma conexão de tempo real por aba, só para membro logado. Cada mudança no banco vira um evento
 * (`lib/realtime`); se a conexão cair e voltar, ou o app voltar para a frente, pede para todo mundo
 * se atualizar, porque eventos podem ter passado nesse meio-tempo.
 */
export function RealtimeSync(): null {
  const { session, profile } = useSession();
  const userId = profile?.is_member ? session?.user.id : undefined;

  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel('fellas-live');
    for (const table of LIVE_TABLES) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload: Payload) => {
        const row = payload.eventType === 'DELETE' ? payload.old : payload.new;
        emitLive({ kind: 'change', table, type: payload.eventType, row, mine: actorOf(table, row) === userId });
      });
    }
    let dropped = false;
    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        if (dropped) emitLive({ kind: 'resync' });
        dropped = false;
      } else {
        dropped = true;
      }
    });
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') emitLive({ kind: 'resync' });
    });
    return () => {
      sub.remove();
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return null;
}
