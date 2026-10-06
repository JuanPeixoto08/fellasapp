/**
 * Selos do perfil (`profiles.badges`, 0018). Só o banco dá selo (a coluna não é editável pelo app).
 * Novos selos entram aqui.
 */
export type Badge = 'verified';

export function hasBadge(badges: readonly string[] | null | undefined, badge: Badge): boolean {
  return !!badges?.includes(badge);
}
