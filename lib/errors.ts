/**
 * Mensagem pt-BR para falhas de rede/Supabase. A mensagem crua (em inglês, técnica) nunca vai
 * pra tela: casos conhecidos ganham texto próprio, o resto cai no `fallback` da tela.
 */
export function friendlyError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? '');
  const msg = raw.toLowerCase();
  if (msg.includes('network') || msg.includes('failed to fetch'))
    return 'Sem conexão. Confere a internet e tenta de novo.';
  if (msg.includes('maximum allowed size') || msg.includes('payload too large'))
    return 'A foto passou de 5 MB. Escolhe uma menor.';
  return fallback;
}

/** Violação de unicidade do Postgres (ex.: username já usado). */
export function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: unknown })?.code === '23505';
}
