-- fellasapp: reacoes com qualquer emoji (seletor completo no app).
-- Troca a lista fixa de 6 emojis por um limite de tamanho. Idempotente.
-- char_length conta code points: o maior emoji do Unicode atual tem 8 (familias com ZWJ);
-- 16 da folga para tons de pele sem abrir espaco para texto livre.

alter table public.post_reactions drop constraint if exists post_reactions_emoji_check;
alter table public.post_reactions drop constraint if exists post_reactions_emoji_len;
alter table public.post_reactions
  add constraint post_reactions_emoji_len check (char_length(emoji) between 1 and 16);

alter table public.comment_reactions drop constraint if exists comment_reactions_emoji_check;
alter table public.comment_reactions drop constraint if exists comment_reactions_emoji_len;
alter table public.comment_reactions
  add constraint comment_reactions_emoji_len check (char_length(emoji) between 1 and 16);
