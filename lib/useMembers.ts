import { useCallback, useEffect, useRef, useState } from 'react';

import { listMembers, type Profile } from './api/profiles';
import { signPaths } from './api/storage';
import { friendlyError } from './errors';
import { onLive } from './realtime';

/** O que as telas de membros e a coluna da direita mostram de cada perfil. */
const SHOWN_FIELDS = ['display_name', 'username', 'avatar_url', 'birthday', 'bio', 'status', 'location'] as const;

/** Membros do grupo + avatares assinados numa chamada só. Usado pela tela Membros e pela coluna direita. */
export function useMembers() {
  const [members, setMembers] = useState<Profile[]>([]);
  const [avatars, setAvatars] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /** `silent`: atualização ao vivo, sem piscar o carregando nem trocar a lista por erro. */
  const fetchAll = useCallback((silent: boolean) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    listMembers()
      .then(async (list) => {
        // sem as fotos a lista ainda serve (iniciais), então falha na assinatura não derruba nada
        setAvatars(await signPaths(list.map((m) => m.avatar_url)).catch(() => new Map()));
        setMembers(list);
      })
      .catch((e) => {
        if (!silent) setError(friendlyError(e, 'Pode ter sido a conexão. Tenta de novo daqui a pouco.'));
      })
      .finally(() => {
        if (!silent) setLoading(false);
      });
  }, []);
  const reload = useCallback(() => fetchAll(false), [fetchAll]);

  useEffect(reload, [reload]);

  // ao vivo: fella novo, saiu do grupo, ou mudou o que aparece (nome, foto, aniversário...)
  const membersRef = useRef(members);
  membersRef.current = members;
  useEffect(
    () =>
      onLive((event) => {
        if (event.kind === 'resync') return fetchAll(true);
        if (event.table !== 'profiles') return;
        const row = event.row;
        const current = membersRef.current.find((m) => m.id === row.id);
        if (event.type === 'DELETE') {
          if (current) fetchAll(true);
          return;
        }
        if (!current) {
          if (row.is_member) fetchAll(true);
          return;
        }
        if (!row.is_member || SHOWN_FIELDS.some((f) => (row[f] ?? null) !== (current[f] ?? null))) fetchAll(true);
      }),
    [fetchAll],
  );

  return { members, avatars, loading, error, reload };
}
