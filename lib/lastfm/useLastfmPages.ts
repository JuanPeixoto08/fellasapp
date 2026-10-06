import { useCallback, useEffect, useRef, useState } from 'react';

import { LastfmError } from './api';
import type { LastfmPage } from './types';

/**
 * Lista do Last.fm em páginas (rolagem infinita). `key` identifica a lista (usuário + sub-aba +
 * período): trocou, recomeça do zero e a resposta atrasada da anterior é ignorada. null = não busca.
 */
export function useLastfmPages<T>(key: string | null, fetchPage: (page: number) => Promise<LastfmPage<T>>) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LastfmError | null>(null);
  const requestId = useRef(0);
  const busy = useRef(false);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const load = useCallback((next: number, reset: boolean) => {
    const id = ++requestId.current;
    busy.current = true;
    setLoading(true);
    if (reset) setError(null);
    fetchRef
      .current(next)
      .then((p) => {
        if (id !== requestId.current) return;
        setItems((prev) => (reset ? p.items : [...prev, ...p.items]));
        setPage(p.page);
        setTotalPages(p.totalPages);
        setError(null);
      })
      .catch((e) => {
        if (id === requestId.current) setError(e instanceof LastfmError ? e : new LastfmError('other'));
      })
      .finally(() => {
        if (id === requestId.current) {
          busy.current = false;
          setLoading(false);
        }
      });
  }, []);

  useEffect(() => {
    setItems([]);
    setPage(0);
    setTotalPages(0);
    setError(null);
    if (key) load(1, true);
    else {
      requestId.current += 1;
      busy.current = false;
      setLoading(false);
    }
  }, [key, load]);

  const loadMore = useCallback(() => {
    if (!key || busy.current || error || page === 0 || page >= totalPages) return;
    load(page + 1, false);
  }, [key, error, page, totalPages, load]);

  const reload = useCallback(() => {
    if (key) load(1, true);
  }, [key, load]);

  return { items, loading, error, loadMore, reload };
}
