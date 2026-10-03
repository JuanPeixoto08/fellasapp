import { useEffect, useState } from 'react';

import { resolveUrl, signPaths } from './api/storage';
import { useSession } from './auth/SessionProvider';

/** Meu nome e avatar (URL assinada) para os composers (novo post, comentar). */
export function useMyAvatar(): { name: string; uri: string | null } {
  const { profile } = useSession();
  const path = profile?.avatar_url ?? null;
  const [uri, setUri] = useState<string | null>(() => (path && /^https?:\/\//.test(path) ? path : null));

  useEffect(() => {
    let active = true;
    signPaths([path])
      .then((signed) => {
        if (active) setUri(resolveUrl(path, signed));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [path]);

  return { name: profile?.display_name || profile?.username || 'Você', uri };
}
