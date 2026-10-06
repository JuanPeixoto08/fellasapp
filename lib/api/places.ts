import type { Database } from '../../types/database';
import { supabase } from '../supabase';

export type PlaceSuggestion = Database['public']['Functions']['place_suggestions']['Returns'][number];

/** Locais já usados cuja chave começa com o digitado (mais usados primeiro); vazio = os mais usados. */
export async function suggestPlaces(prefix: string, limit = 5): Promise<PlaceSuggestion[]> {
  const { data, error } = await supabase.rpc('place_suggestions', { p_prefix: prefix, p_limit: limit });
  if (error) throw error;
  return (data ?? []) as PlaceSuggestion[];
}

/** Quantos posts foram feitos no local (cabeçalho da página do local). */
export async function countPlacePosts(key: string): Promise<number> {
  const { count, error } = await supabase
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('place_key', key);
  if (error) throw error;
  return count ?? 0;
}
