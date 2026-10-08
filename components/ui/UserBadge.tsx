import type { Badge } from '../../lib/badges';
import type { IconSize } from '../../lib/theme';
import { VerifiedBadge } from './VerifiedBadge';

/** Desenho de um selo do perfil ao lado do nome. Selo novo ganha o desenho aqui. */
export function UserBadge({ badge, size = 'sm' }: { badge: Badge; size?: IconSize }) {
  switch (badge) {
    case 'verified':
      return <VerifiedBadge size={size} />;
  }
}
