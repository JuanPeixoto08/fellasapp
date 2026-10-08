// Tempo real da mesa de poker: uma linha só (poker_tables, id = 1), cujo `state` já é o retrato público inteiro.
// O Realtime respeita a política de leitura (só membros). Quem usa ignora retrato com seq menor que o que tem.
import { supabase } from './supabase';
import type { PokerState } from './types';

export type Watch = { stop(): void };

export function watchTable(onState: (s: PokerState) => void, onLive: (live: boolean) => void): Watch {
  const channel = supabase
    .channel('poker-table')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'poker_tables', filter: 'id=eq.1' }, (payload) => {
      const state = (payload.new as { state?: PokerState }).state;
      if (state && typeof state.seq === 'number') onState(state);
    })
    .subscribe((status) => onLive(status === 'SUBSCRIBED'));
  return { stop: () => void supabase.removeChannel(channel) };
}
