-- fellasapp: a pessoa escolhe qual selo aparece do lado do nome (entre os que ela tem). Idempotente.
-- Substitui o "esconder selo" da 0023: selo não se esconde, se escolhe. null = o primeiro que ela tem.
-- Escolher um selo que a pessoa não tem não vale nada: o app só mostra selo que está em badges
-- (e badges continua fora do grant: só o banco dá ou tira selo).
-- hidden_badges (0023) fica sem uso; sai numa migração depois que o app novo estiver no ar.

alter table public.profiles add column if not exists featured_badge text
  check (featured_badge is null or char_length(featured_badge) <= 30);

grant update (featured_badge) on public.profiles to authenticated;
