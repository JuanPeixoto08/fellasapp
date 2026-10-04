import { useEffect } from 'react';
import { AppState } from 'react-native';

import { fetchUnreadCount } from '../../lib/api/notifications';
import { useSession } from '../../lib/auth/SessionProvider';
import { setUnreadNotifications, UNREAD_POLL_MS } from '../../lib/notificationsStore';
import { affectsNotifications, debounce, LIVE_DEBOUNCE_MS, onLive } from '../../lib/realtime';

/**
 * Mantém a bolinha de não lidas: busca ao entrar como membro, a cada minuto e quando o app volta
 * para o primeiro plano. Trocar de conta zera antes de buscar (o número não vaza entre contas).
 */
export function NotificationsSync(): null {
  const { session, profile } = useSession();
  const userId = profile?.is_member ? session?.user.id : undefined;

  useEffect(() => {
    setUnreadNotifications(0);
    if (!userId) return;
    let alive = true;
    const refresh = () => {
      fetchUnreadCount()
        .then((n) => {
          if (alive) setUnreadNotifications(n);
        })
        .catch(() => {});
    };
    // o intervalo só roda com o app na frente (aba visível na web); ao voltar, busca na hora
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      refresh();
      if (!timer) timer = setInterval(refresh, UNREAD_POLL_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    start();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') start();
      else stop();
    });
    // tempo real: curtida/comentário/reação/fella novo chegam em ~1 s; o intervalo fica de reserva
    const live = debounce(refresh, LIVE_DEBOUNCE_MS);
    const offLive = onLive((event) => {
      if (affectsNotifications(event)) live();
    });
    return () => {
      alive = false;
      stop();
      sub.remove();
      live.cancel();
      offLive();
    };
  }, [userId]);

  return null;
}
