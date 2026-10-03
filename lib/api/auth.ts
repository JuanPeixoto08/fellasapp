import type { Session, Subscription } from '@supabase/supabase-js';

import { supabase } from '../supabase';
import type { Tables } from '../../types/database';

export type Profile = Tables<'profiles'>;

export async function sendOtp(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
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
