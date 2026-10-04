import type { Session, Subscription } from '@supabase/supabase-js';

import { supabase } from '../supabase';
import type { Tables } from '../../types/database';

export type Profile = Tables<'profiles'>;

/**
 * Manda o código de 6 dígitos. `createUser`: primeiro acesso pode criar a conta (o convite é checado no
 * banco); "esqueci a senha" não, para email desconhecido não virar conta nova.
 */
export async function sendOtp(email: string, { createUser = true }: { createUser?: boolean } = {}): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: createUser },
  });
  if (error) throw error;
}

export async function signInWithPassword(email: string, password: string): Promise<Session | null> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

/** Define (ou troca) a senha e marca na conta que ela já tem senha. */
export async function setPassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password, data: { has_password: true } });
  if (error) throw error;
}

/** A conta já criou senha? (marca em user_metadata, gravada por `setPassword`). */
export function hasPassword(session: Session | null): boolean {
  return session?.user.user_metadata?.has_password === true;
}

export async function verifyOtp(email: string, token: string): Promise<Session | null> {
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
  return data.session;
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthChange(callback: (session: Session | null) => void): Subscription {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return data.subscription;
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Traduz erros do Supabase para mensagens em PT-BR. */
export function authErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const msg = raw.toLowerCase();
  if (msg.includes('invalid login credentials'))
    return 'Email ou senha errados. Tenta de novo ou usa "Esqueci a senha".';
  if (msg.includes('should be different from the old password'))
    return 'Essa já é a sua senha. Escolhe uma diferente.';
  if (msg.includes('password should be at least') || msg.includes('weak password'))
    return 'Senha fraca. Usa pelo menos 8 caracteres.';
  if (msg.includes('signups not allowed'))
    return 'Não achamos uma conta com esse email. Se é seu primeiro acesso, usa "Primeiro acesso".';
  if (msg.includes('rate limit') || msg.includes('too many') || msg.includes('seconds'))
    return 'Muitas tentativas. Aguarde um pouco e tente novamente.';
  if (msg.includes('expired') || msg.includes('invalid'))
    return 'Código inválido ou expirado. Confira o código ou peça um novo.';
  if (msg.includes('network') || msg.includes('fetch'))
    return 'Sem conexão. Verifique sua internet e tente novamente.';
  if (msg.includes('email'))
    return 'Email inválido. Confira o endereço e tente novamente.';
  return 'Algo deu errado. Tente novamente.';
}
