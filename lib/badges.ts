/**
 * Selos do perfil (`profiles.badges`, 0018). Só o banco dá selo (a coluna não é editável pelo app).
 * Quem tem mais de um escolhe qual aparece do lado do nome (`profiles.featured_badge`, 0024).
 * Novos selos entram aqui (tipo, ordem e nome) e no desenho de `components/ui/UserBadge`.
 */
export type Badge = 'verified' | 'weekly_champion' | 'weekly_unicorn';

/** Selos que o app sabe desenhar. */
const BADGES: readonly Badge[] = ['verified', 'weekly_champion', 'weekly_unicorn'];

/** Nome do selo (leitor de tela e escolha no Editar perfil). */
export const BADGE_LABELS: Record<Badge, string> = { verified: 'Verificado', weekly_champion: 'Campeão da semana', weekly_unicorn: 'Unicórnio da semana' };

export function badgeLabel(badge: Badge): string {
  return BADGE_LABELS[badge];
}

const isBadge = (b: string): b is Badge => (BADGES as readonly string[]).includes(b);

/** Selos que a pessoa tem e o app conhece, na ordem em que estão no perfil. */
export function ownBadges(badges?: readonly string[] | null): Badge[] {
  return (badges ?? []).filter(isBadge);
}

/** O selo que aparece do lado do nome: o escolhido, se a pessoa tem; senão o primeiro que ela tem. */
export function shownBadge(badges?: readonly string[] | null, featured?: string | null): Badge | null {
  const own = ownBadges(badges);
  return own.find((b) => b === featured) ?? own[0] ?? null;
}
