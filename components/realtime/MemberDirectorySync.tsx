import { useEffect } from 'react';

import { listMembers } from '../../lib/api/profiles';
import { resolveUrl, signPaths } from '../../lib/api/storage';
import { useSession } from '../../lib/auth/SessionProvider';
import { setMemberDirectory } from '../../lib/memberDirectory';
import { debounce, LIVE_DEBOUNCE_MS, onLive } from '../../lib/realtime';

/**
 * Mantém a lista de fellas usada pelo @ (sugestões e destaque): carrega ao entrar como membro,
 * recarrega quando um perfil muda ou a conexão volta, e esvazia ao sair da conta.
 */
export function MemberDirectorySync(): null {
  const { session, profile } = useSession();
  const userId = profile?.is_member ? session?.user.id : undefined;

  useEffect(() => {
    if (!userId) {
      setMemberDirectory([]);
      return;
    }
    let alive = true;
    const load = () => {
      listMembers()
        .then(async (list) => {
          const signed = await signPaths(list.map((m) => m.avatar_url)).catch(() => new Map<string, string>());
          if (!alive) return;
          setMemberDirectory(
            list.map((m) => ({
              id: m.id,
              username: m.username,
              name: m.display_name || m.username,
              avatarUrl: resolveUrl(m.avatar_url, signed),
            })),
          );
        })
        .catch(() => {});
    };
    load();
    const live = debounce(load, LIVE_DEBOUNCE_MS);
    const off = onLive((event) => {
      if (event.kind === 'resync' || event.table === 'profiles') live();
    });
    return () => {
      alive = false;
      live.cancel();
      off();
    };
  }, [userId]);

  return null;
}
