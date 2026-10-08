/**
 * Selos do perfil (`profiles.badges`, 0018). Só o banco dá selo (a coluna não é editável pelo app).
 * Novos selos entram aqui (tipo e rótulo). A pessoa pode esconder os seus (`profiles.hidden_badges`, 0023).
 */
export type Badge = 'verified';

/** Nome do selo na seção "O que aparece no perfil" do Editar perfil. */
export const BADGE_LABELS: Record<Badge, string> = { verified: 'Selo de verificado' };

/** Rótulo de um selo vindo do banco; null se o app não conhece esse selo (não vira chave). */
export function badgeLabel(badge: string): string | null {
  return (BADGE_LABELS as Record<string, string>)[badge] ?? null;
}

export function hasBadge(badges: readonly string[] | null | undefined, badge: Badge): boolean {
  return !!badges?.includes(badge);
}

/** Selos que aparecem: os que a pessoa tem menos os que ela escondeu. */
export function visibleBadges(badges?: readonly string[] | null, hidden?: readonly string[] | null): string[] {
  return (badges ?? []).filter((b) => !hidden?.includes(b));
}
