import { useEffect } from 'react';
import { AppState } from 'react-native';

import { fetchUnreadCount } from '../../lib/api/notifications';
import { useSession } from '../../lib/auth/SessionProvider';
import { setUnreadNotifications, UNREAD_POLL_MS } from '../../lib/notificationsStore';

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
    refresh();
    const timer = setInterval(refresh, UNREAD_POLL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      alive = false;
      clearInterval(timer);
      sub.remove();
    };
  }, [userId]);

  return null;
}
