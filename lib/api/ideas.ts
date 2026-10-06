import type { Database } from '../../types/database';
import { friendlyError } from '../errors';
import { validateIdea, type Idea, type IdeaSort, type Vote } from '../ideas';
import { getMemberDirectory } from '../memberDirectory';
import { supabase } from '../supabase';

// o cliente do Supabase não é tipado pelo Database: as linhas da função vêm daqui
type FeedRow = Database['public']['Functions']['ideas_feed']['Returns'][number];

export type IdeaAction = 'load' | 'create' | 'vote' | 'remove' | 'refresh';

export const IDEA_ERRORS: Record<IdeaAction, string> = {
  load: 'Pode ter sido a conexão. Tenta de novo daqui a pouco.',
  create: 'Não deu pra mandar a ideia. Tenta de novo.',
  vote: 'Não deu pra votar. Tenta de novo.',
  remove: 'Não deu pra apagar a ideia. Tenta de novo.',
  refresh: 'Sua ideia foi! Só a lista que não atualizou: troca de aba pra ver.',
};

const toVote = (v: number | null): Vote => (v === 1 || v === -1 ? v : null);

/** O banco já ordena e soma os votos; aqui entram nome e foto do autor (diretório de membros). */
export async function fetchIdeas(sort: IdeaSort): Promise<Idea[]> {
  const { data, error } = await supabase.rpc('ideas_feed', { p_sort: sort });
  if (error) throw error;
  const byId = new Map(getMemberDirectory().map((m) => [m.id, m]));
  return ((data ?? []) as FeedRow[]).map((r) => {
    const member = byId.get(r.author_id);
    return {
      id: r.id,
      body: r.body,
      createdAt: r.created_at,
      score: r.score,
      myVote: toVote(r.my_vote),
      // saiu do grupo, ou o diretório ainda não carregou: a ideia continua aparecendo
      author: { id: r.author_id, name: member?.name ?? 'Alguém', avatarUrl: member?.avatarUrl ?? null },
    };
  });
}

export async function createIdea(text: string, authorId: string): Promise<void> {
  const body = validateIdea(text);
  if (!body) throw new Error('Ideia vazia ou longa demais');
  const { error } = await supabase.from('ideas').insert({ body, author_id: authorId });
  if (error) throw error;
}

/** +1/−1 grava (ou troca) o meu voto; null tira. */
export async function voteIdea(ideaId: string, userId: string, vote: Vote): Promise<void> {
  const { error } =
    vote === null
      ? await supabase.from('idea_votes').delete().eq('idea_id', ideaId).eq('user_id', userId)
      : await supabase
          .from('idea_votes')
          .upsert({ idea_id: ideaId, user_id: userId, value: vote }, { onConflict: 'idea_id,user_id' });
  if (error) throw error;
}

/** O banco só deixa o autor ou o admin; barrado, o delete volta vazio sem erro, então conferimos. */
export async function deleteIdea(ideaId: string): Promise<void> {
  const { data, error } = await supabase.from('ideas').delete().eq('id', ideaId).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Ideia não encontrada ou não é sua');
}

export function ideaErrorMessage(error: unknown, action: IdeaAction): string {
  return friendlyError(error, IDEA_ERRORS[action]);
}
