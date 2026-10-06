import { Platform, Share } from 'react-native';

import type { Tables } from '../../types/database';
import { supabase } from '../supabase';

/** Site do app: quem recebe o convite ainda não tem o app, então o link sempre abre na web. */
export const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || 'https://fellasapp.pages.dev';

const LIST_LIMIT = 20;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type InviteLink = {
  token: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  usedEmail: string | null;
};
export type InviteStatus = 'used' | 'open' | 'expired';

type InviteRow = Pick<Tables<'invite_links'>, 'token' | 'created_at' | 'expires_at' | 'used_at' | 'used_email'>;

export function inviteUrl(token: string): string {
  return `${WEB_URL}/convite/${token}`;
}

export function inviteStatus(link: InviteLink, now: Date = new Date()): InviteStatus {
  if (link.usedAt) return 'used';
  return new Date(link.expiresAt).getTime() < now.getTime() ? 'expired' : 'open';
}

/** Só admin (o banco confere). Devolve o token novo; vale 7 dias, para uma pessoa só. */
export async function createInviteLink(): Promise<string> {
  const { data, error } = await supabase.rpc('create_invite_link');
  if (error) throw error;
  return data as string;
}

/** Os últimos links do admin, mais novos primeiro. */
export async function listInviteLinks(): Promise<InviteLink[]> {
  const { data, error } = await supabase
    .from('invite_links')
    .select('token, created_at, expires_at, used_at, used_email')
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT);
  if (error) throw error;
  return ((data ?? []) as InviteRow[]).map((r) => ({
    token: r.token,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    usedAt: r.used_at,
    usedEmail: r.used_email,
  }));
}

class InvalidEmailError extends Error {
  constructor() {
    super('invalid_email');
  }
}

/**
 * Quem abriu o link (ainda sem conta) gasta o convite com o email dele: o email entra na lista de
 * convidados e o link fica preso a ele. Devolve o email como ficou gravado.
 */
export async function redeemInvite(token: string, rawEmail: string): Promise<string> {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new InvalidEmailError();
  const { error } = await supabase.rpc('redeem_invite', { p_token: token, p_email: email });
  if (error) throw error;
  return email;
}

/** Convite que não tem mais volta: a tela troca o formulário por um aviso. */
export function isDeadInvite(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? '');
  return ['invite_used', 'invite_expired', 'invite_not_found'].some((k) => msg.includes(k));
}

/** Celular: folha de compartilhar do sistema. Web: copia o link. */
export async function shareInvite(url: string): Promise<'shared' | 'copied'> {
  if (Platform.OS === 'web') {
    await navigator.clipboard.writeText(url);
    return 'copied';
  }
  await Share.share({ message: `Bora pro fellas? Entra por aqui: ${url}` });
  return 'shared';
}

export function inviteErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  const msg = String((error as { message?: string } | null)?.message ?? error ?? '').toLowerCase();
  if (msg.includes('invalid_email')) return 'Isso não parece um email. Confere e tenta de novo.';
  if (msg.includes('invite_used')) return 'Esse convite já foi usado. Pede um novo pra quem te chamou.';
  if (msg.includes('invite_expired')) return 'Esse convite venceu. Pede um novo pra quem te chamou.';
  if (msg.includes('invite_not_found')) return 'Esse convite não existe. Confere se o link veio inteiro.';
  if (code === '42501' || msg.includes('not_admin')) return 'Só o admin pode gerar convite.';
  if (msg.includes('network') || msg.includes('fetch')) return 'Sem conexão. Confere a internet e tenta de novo.';
  return 'Algo deu errado. Tenta de novo.';
}
