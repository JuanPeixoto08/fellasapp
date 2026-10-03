import { supabase } from '../supabase';
import type { Database } from '../../types/database';

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Post = Database['public']['Tables']['posts']['Row'];

const BUCKET = 'post-images';
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export function validateUsername(username: string): string | null {
  if (!USERNAME_RE.test(username)) {
    return 'Username deve ter 3-20 caracteres: letras minúsculas, números e _';
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

export async function listPostsByUser(id: string): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('author_id', id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Bucket privado: converte o caminho salvo (avatar_url / image_url) em URL assinada. */
export async function getSignedUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

export type UpdateProfileInput = {
  display_name: string;
  username: string;
  bio: string;
  avatarUri?: string;
};

export async function updateMyProfile(input: UpdateProfileInput): Promise<Profile> {
  const username = input.username.trim().toLowerCase();
  const invalid = validateUsername(username);
  if (invalid) throw new Error(invalid);

  const userId = await getCurrentUserId();
  const fields: Pick<Profile, 'display_name' | 'username' | 'bio'> & { avatar_url?: string } = {
    display_name: input.display_name.trim(),
    username,
    bio: input.bio.trim(),
  };

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
