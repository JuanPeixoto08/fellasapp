import { useCallback, useEffect, useState } from 'react';

import { listMembers, type Profile } from './api/profiles';
import { signPaths } from './api/storage';
import { friendlyError } from './errors';

/** Membros do grupo + avatares assinados numa chamada só. Usado pela tela Membros e pela coluna direita. */
export function useMembers() {
  const [members, setMembers] = useState<Profile[]>([]);
  const [avatars, setAvatars] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    listMembers()
      .then(async (list) => {
        // sem as fotos a lista ainda serve (iniciais), então falha na assinatura não derruba nada
        setAvatars(await signPaths(list.map((m) => m.avatar_url)).catch(() => new Map()));
        setMembers(list);
      })
      .catch((e) => setError(friendlyError(e, 'Pode ter sido a conexão. Tenta de novo daqui a pouco.')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(reload, [reload]);

  return { members, avatars, loading, error, reload };
}
