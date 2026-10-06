import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createIdea, deleteIdea, fetchIdeas, ideaErrorMessage, voteIdea } from './api/ideas';
import { applyVote, type Idea, type IdeaSort } from './ideas';
import { useMemberDirectory } from './memberDirectory';
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
  /** Tem carregamento normal esperando (carregando na tela): quem terminar por último responde por ele. */
  const showing = useRef(false);
  /** Chegou lista do banco com voto meu ainda indo: confere de novo quando os votos terminarem. */
  const stale = useRef(false);

  /** `silent`: atualização ao vivo/depois de mandar, sem piscar o carregando nem trocar a lista por erro. */
  const load = useCallback((silent: boolean) => {
    const id = ++requestId.current;
    if (!silent) {
      showing.current = true;
      setLoading(true);
      setError(null);
    }
    fetchIdeas(sortRef.current)
      .then((list) => {
        if (id !== requestId.current) return;
        if (pending.current.size > 0) {
          // a busca pode ter sido feita antes do meu voto chegar no banco: o voto da tela vale
          stale.current = true;
          const local = new Map(ideasRef.current.filter((i) => pending.current.has(i.id)).map((i) => [i.id, i]));
          list = list.map((i) => {
            const mine = local.get(i.id);
            return mine ? { ...i, score: mine.score, myVote: mine.myVote } : i;
          });
        }
        setIdeas(list);
      })
      .catch((e) => {
        if (id === requestId.current && showing.current) setError(ideaErrorMessage(e, 'load'));
      })
      .finally(() => {
        if (id === requestId.current && showing.current) {
          showing.current = false;
          setLoading(false);
        }
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
        .finally(() => {
          pending.current.delete(ideaId);
          if (pending.current.size === 0 && stale.current) {
            stale.current = false;
            load(true);
          }
        });
    },
    [userId, load],
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

  // nome e foto do autor na hora de mostrar: o diretório de membros pode chegar depois das ideias
  const directory = useMemberDirectory();
  const shown = useMemo(() => {
    const byId = new Map(directory.map((m) => [m.id, m]));
    return ideas.map((i) => {
      const m = byId.get(i.author.id);
      return m ? { ...i, author: { id: m.id, name: m.name, avatarUrl: m.avatarUrl } } : i;
    });
  }, [ideas, directory]);

  return { sort, setSort, ideas: shown, loading, error, voteError, reload, vote, create, remove };
}
