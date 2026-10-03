import { supabase } from '../supabase';
import type { Database } from '../../types/database';
import { BUCKET } from './storage';

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Post = Database['public']['Tables']['posts']['Row'];

// Mesmo limite do check em profiles.username (0001_init.sql). O trigger de cadastro gera nomes
// de até 29 caracteres, então um limite menor aqui travava o "Salvar" de quem nunca mexeu no usuário.
const USERNAME_RE = /^[a-z0-9_]{3,30}$/;

export function validateUsername(username: string): string | null {
  if (!USERNAME_RE.test(username)) {
    return 'O usuário precisa ter de 3 a 30 caracteres: letras minúsculas, números e _';
  }
  return null;
}

export async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Não autenticado');
  return data.user.id;
}

export async function getProfile(id: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function listMembers(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('is_member', true)
    .order('username', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export type UpdateProfileInput = {
  display_name: string;
  username: string;
  bio: string;
  avatarUri?: string;
  /** Campos extras: string vazia vira null; undefined não altera. */
  accent_color?: string | null;
  status?: string | null;
  location?: string | null;
  /** ISO `AAAA-MM-DD`. */
  birthday?: string | null;
};

/** Converte "DD/MM/AAAA" em "AAAA-MM-DD"; vazio -> null; inválido -> undefined. */
export function parseBirthday(text: string): string | null | undefined {
  const v = text.trim();
  if (!v) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  if (!m) return undefined;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    return undefined;
  }
  if (date.getTime() > Date.now()) return undefined;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** "AAAA-MM-DD" -> "DD/MM/AAAA". */
export function formatBirthday(iso: string | null | undefined): string {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

const emptyToNull = (v: string | null): string | null => (v?.trim() ? v.trim() : null);

export async function updateMyProfile(input: UpdateProfileInput): Promise<Profile> {
  const username = input.username.trim().toLowerCase();
  const invalid = validateUsername(username);
  if (invalid) throw new Error(invalid);

  const userId = await getCurrentUserId();
  const fields: Database['public']['Tables']['profiles']['Update'] = {
    display_name: input.display_name.trim(),
    username,
    bio: input.bio.trim(),
  };

  if (input.accent_color !== undefined) fields.accent_color = emptyToNull(input.accent_color);
  if (input.status !== undefined) fields.status = emptyToNull(input.status);
  if (input.location !== undefined) fields.location = emptyToNull(input.location);
  if (input.birthday !== undefined) fields.birthday = emptyToNull(input.birthday);

  if (input.avatarUri) {
    const blob = await (await fetch(input.avatarUri)).blob();
    const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: blob.type || 'image/jpeg' });
    if (upErr) throw upErr;
    fields.avatar_url = path;
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(fields)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
