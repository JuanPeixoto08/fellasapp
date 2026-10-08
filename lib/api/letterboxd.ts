import { supabase } from '../supabase';
import { toPostMedia, type ReviewMedia } from '../postMedia';

/** Edge Function que lê as reviews do Letterboxd de quem chama (supabase/functions/letterboxd-reviews). */
export const LETTERBOXD_FUNCTION_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''}/functions/v1/letterboxd-reviews`;

export type LetterboxdErrorKind = 'no_user' | 'not_found' | 'unavailable' | 'offline';

const MESSAGES: Record<LetterboxdErrorKind, string> = {
  no_user: 'Coloca seu usuário do Letterboxd em Editar perfil pra puxar suas reviews.',
  not_found: 'Não achamos esse usuário no Letterboxd. Confere em Editar perfil.',
  unavailable: 'O Letterboxd não respondeu agora. Tenta de novo daqui a pouco.',
  offline: 'Sem conexão. Confere a internet e tenta de novo.',
};

export class LetterboxdError extends Error {
  constructor(readonly kind: LetterboxdErrorKind) {
    super(MESSAGES[kind]);
  }
}

/** As suas reviews recentes do Letterboxd (até 50), já no formato do anexo e conferidas. */
export async function listMyReviews(): Promise<ReviewMedia[]> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new LetterboxdError('unavailable');
  let res: Response;
  try {
    res = await fetch(LETTERBOXD_FUNCTION_URL, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new LetterboxdError('offline');
  }
  const body = (await res.json().catch(() => null)) as { reviews?: unknown[]; error?: string } | null;
  if (!res.ok) {
    const kind = body?.error === 'no_user' || body?.error === 'not_found' ? body.error : 'unavailable';
    throw new LetterboxdError(kind);
  }
  return (body?.reviews ?? []).map(toPostMedia).filter((m): m is ReviewMedia => m?.kind === 'review');
}
