import { useCallback, useEffect, useRef, useState } from 'react';

import { createIdea, deleteIdea, fetchIdeas, ideaErrorMessage, voteIdea } from './api/ideas';
import { applyVote, type Idea, type IdeaSort } from './ideas';
import { debounce, LIVE_DEBOUNCE_MS, onLive } from './realtime';

/**
 * Estado do mural de ideias. Voto é otimista (muda na hora, volta se o banco recusar) e não reordena
 * a lista: a ordem da aba Top se ajusta no próximo carregamento, para a linha não fugir do dedo.
 */
export function useIdeas(userId: string | undefined) {
  const [sort, setSort] = useState<IdeaSort>('top');
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);

  const ideasRef = useRef(ideas);
  ideasRef.current = ideas;
  const sortRef = useRef(sort);
  sortRef.current = sort;
  /** Só a resposta da busca mais recente vale (troca de aba no meio de um carregamento). */
  const requestId = useRef(0);
  /** Ideias com voto indo pro servidor: toques nelas esperam a resposta. */
  const pending = useRef(new Set<string>());

  /** `silent`: atualização ao vivo/depois de mandar, sem piscar o carregando nem trocar a lista por erro. */
  const load = useCallback((silent: boolean) => {
    const id = ++requestId.current;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    fetchIdeas(sortRef.current)
      .then((list) => {
        if (id === requestId.current) setIdeas(list);
      })
      .catch((e) => {
        if (id === requestId.current && !silent) setError(ideaErrorMessage(e, 'load'));
      })
      .finally(() => {
        if (id === requestId.current && !silent) setLoading(false);
      });
  }, []);

  const reload = useCallback(() => load(false), [load]);

  useEffect(() => {
    load(false);
  }, [sort, load]);

  // ao vivo: ideia nova/apagada ou voto de outra pessoa (o meu a tela já mostrou)
  useEffect(() => {
    const live = debounce(() => load(true), LIVE_DEBOUNCE_MS);
    const off = onLive((event) => {
      if (event.kind === 'resync') return live();
      if ((event.table === 'ideas' || event.table === 'idea_votes') && !event.mine) live();
    });
    return () => {
      off();
      live.cancel();
    };
  }, [load]);

  const vote = useCallback(
    (ideaId: string, tapped: 1 | -1) => {
      if (!userId || pending.current.has(ideaId)) return;
      const before = ideasRef.current.find((i) => i.id === ideaId);
      if (!before) return;
      const next = applyVote(before, tapped);
      const patch = (values: Pick<Idea, 'score' | 'myVote'>) =>
        setIdeas((list) => list.map((i) => (i.id === ideaId ? { ...i, ...values } : i)));
      patch(next);
      setVoteError(null);
      pending.current.add(ideaId);
      voteIdea(ideaId, userId, next.myVote)
        .catch((e) => {
          patch({ score: before.score, myVote: before.myVote });
          setVoteError(ideaErrorMessage(e, 'vote'));
        })
        .finally(() => pending.current.delete(ideaId));
    },
    [userId],
  );

  const create = useCallback(
    async (text: string) => {
      if (!userId) return;
      await createIdea(text, userId);
      load(true);
    },
    [userId, load],
  );

  const remove = useCallback(async (ideaId: string) => {
    await deleteIdea(ideaId);
    setIdeas((list) => list.filter((i) => i.id !== ideaId));
  }, []);

  return { sort, setSort, ideas, loading, error, voteError, reload, vote, create, remove };
}
