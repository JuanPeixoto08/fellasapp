import type { Database } from '../../types/database';
import { supabase } from '../supabase';
import { normalizeTag } from '../tags';

export type TagSuggestion = Database['public']['Functions']['tag_suggestions']['Returns'][number];

/** Tags que já existem começando com o que foi digitado (mais usadas primeiro). */
export async function suggestTags(prefix: string, limit = 5): Promise<TagSuggestion[]> {
  const { data, error } = await supabase.rpc('tag_suggestions', { p_prefix: normalizeTag(prefix), p_limit: limit });
  if (error) throw error;
  return (data ?? []) as TagSuggestion[];
}

/** Quantos posts têm a tag (cabeçalho da página da tag). */
export async function countTagPosts(tag: string): Promise<number> {
  const { count, error } = await supabase
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .contains('tags', [tag]);
  if (error) throw error;
  return count ?? 0;
}
