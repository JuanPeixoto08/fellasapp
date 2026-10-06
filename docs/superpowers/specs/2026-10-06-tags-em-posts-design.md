# Tags (#) em posts — design

Data: 2026-10-06 · Status: aprovado em conversa, aguardando revisão do spec escrito

## Objetivo

Os fellas marcam posts com `#tags` escritas no próprio texto (`#artes_avantajadas`, `#imagens_aleatorias`)
e tocam numa tag para ver todos os posts com ela.

**Sucesso:** escrever `#` no compositor sugere as tags que já existem; a tag no post aparece como link;
tocar abre a página da tag com os posts dela, no formato do feed.

### O que o Juan decidiu
- Tags **livres, no texto** (como Twitter/Instagram), com **sugestão ao digitar `#`**. Não é lista fixa.
- **Sem aba/lista de tags por enquanto**: chega-se numa tag só tocando nela num post.
- Abordagem de dados **1**: coluna `posts.tags` preenchida pelo banco (gatilho), não busca no texto na hora
  nem tabela separada.
- Regras: tag aceita letras (com acento), números e `_`, de 2 a 30 caracteres, sem diferenciar maiúscula;
  vira link **só em posts** (comentário continua texto).

### Verificado
- O banco (Supabase, `ctype en_US.UTF-8`) aceita acentos em `[[:alnum:]]` e `lower('ÉÇÃO') = 'éção'`:
  a regra do app (`\p{L}\p{N}_`) e a do banco batem para letras latinas acentuadas.

### Fora do escopo (depois, se fizer falta)
Aba/lista de tags; tags em comentários; seguir tag; editar tags de post publicado (posts não são editáveis
no app); notificação por tag.

## 1. O que aparece e onde

### Tag no post
- `#tag` no texto de um **post** aparece em **negrito, cor `brand`**, como a `@menção` (`MentionText`), e é
  tocável (papel `link`, rótulo "Ver posts com #tag"). Toque → `/tag/<tag em minúsculas>`.
- Em **comentários** a `#` continua texto comum.

### Compositor de post
- Digitando `#` + letras (tag ativa no cursor), aparece a caixinha no mesmo visual da `MentionSuggestions`:
  até 5 tags existentes que começam com o digitado, cada uma com o número de posts
  (`#artes_avantajadas · 12`). Tocar completa a tag e um espaço. Nenhuma sugestão: segue digitando e a
  tag nova nasce ao postar.
- Vale para o compositor de post (página no celular, topo do feed e janela no computador). Campo de
  comentário: não.
- `@` e `#` nunca ficam ativos ao mesmo tempo (é o caractere antes do cursor que decide).

### Página da tag (`/tag/[name]`)
- Cabeçalho de pilha (`stackHeader`) com título `#tag`; logo abaixo, "N posts" em `textMuted`.
- Lista no formato do feed (`PostCard`, fio entre posts), mais novo primeiro, rolagem infinita, curtir,
  reagir, abrir post e apagar o meu (igual ao feed).
- Vazio: `EmptyState` "Ninguém usou #tag ainda." / "Posta algo com ela."
- Erro: `EmptyState` com "Tentar de novo".
- No computador mantém a moldura (barra lateral + coluna da direita).

## 2. Banco (`supabase/migrations/0016_post_tags.sql`, idempotente)

```sql
-- tags de um texto: '#' no começo ou depois de algo que não é letra/número/_/#, 2 a 30 de
-- [[:alnum:]_], sem continuar colado; minúsculas e sem repetir
create or replace function public.extract_tags(p_body text) returns text[]
language sql immutable as $$
  select coalesce(array_agg(distinct lower(m[1])), '{}')
    from regexp_matches(coalesce(p_body, ''), '(?:^|[^[:alnum:]_#])#([[:alnum:]_]{2,30})(?![[:alnum:]_])', 'g') as m;
$$;

alter table public.posts add column if not exists tags text[] not null default '{}';
create index if not exists posts_tags_idx on public.posts using gin (tags);

-- gatilho before insert/update of body: new.tags := extract_tags(new.body)
-- backfill: update public.posts set tags = public.extract_tags(body);

create or replace function public.tag_suggestions(p_prefix text, p_limit integer default 5)
returns table (tag text, posts integer)
language sql stable security invoker set search_path = public as $$
  select t, count(*)::integer
    from public.posts p, unnest(p.tags) as t
   where t like lower(p_prefix) || '%'
   group by t
   order by count(*) desc, t
   limit least(greatest(p_limit, 1), 20);
$$;
```
- `security invoker`: a RLS de `posts` (só membros) vale para as sugestões.
- `p_prefix` vazio devolve as mais usadas.
- `posts.tags` não precisa de grant: só o gatilho escreve.
- `%` e `_` digitados no prefixo: `_` é parte válida de tag e no `like` vira curinga de 1 caractere; o
  efeito é sugerir algumas tags a mais, inofensivo. `%` não chega (não é caractere de tag; o app só manda
  o que casou com a regra).

## 3. Código do app

| Unidade | Faz |
|---|---|
| `lib/tags.ts` | `TAG_MIN = 2`, `TAG_MAX = 30`; `extractTags(text)` (mesma regra do banco, `\p{L}\p{N}_`, minúsculas, sem repetir); `activeTag(text, cursor)` → `{ start, query } \| null`; `insertTag(text, active, tag)`; `normalizeTag(raw)` |
| `lib/mentions.ts` | `splitMentions` vira o separador de texto rico: com `{ tags: true }` também devolve partes `{ text, tag }` |
| `components/MentionText.tsx` | prop `tags?: boolean`; parte tag → `Text` negrito `brand`, `accessibilityRole="link"`, toque abre `/tag/<tag>` |
| `components/TagSuggestions.tsx` | caixinha (visual da `MentionSuggestions`): busca `suggestTags(query)` com debounce curto, mostra `#tag · N` |
| `components/feed/Composer.tsx` | `#` ativo → `TagSuggestions`; `@` ativo → `MentionSuggestions` (como hoje) |
| `components/PostCard.tsx` | `MentionText` do corpo com `tags` |
| `lib/api/tags.ts` | `suggestTags(prefix): Promise<{ tag, posts }[]>` (rpc), `countTagPosts(tag): Promise<number>` |
| `lib/api/posts.ts` | `FeedFilter.tag` → `contains('tags', [tag])` em `listFeed` |
| `lib/usePostList.ts` | opção `tag` repassada ao `listFeed`; tempo real: post novo só conta se o texto tiver a tag |
| `app/tag/[name].tsx` | tela da tag; rota registrada em `app/_layout.tsx` |

UI: Impeccable (modo Operate), tokens de `lib/theme.ts` e primitivos de `components/ui`. Copy no tom do
`PRODUCT.md`.

## 4. Erros

| Situação | O que a pessoa vê |
|---|---|
| Sugestões falham | Caixinha não aparece (dá pra postar normal) |
| Página da tag não carrega | `EmptyState` "Não deu pra carregar essa tag" + "Tentar de novo" |
| Contagem falha | Cabeçalho sem "N posts" (a lista aparece) |
| Tag inexistente/sem posts | Estado vazio da seção 1 |

## 5. Testes
- `lib/tags`: acento, `_`, números; 1 caractere não é tag, 30 é, 31 não casa; `ab#cd` e `##x` não;
  maiúsculas viram minúsculas; repetidas uma vez só; tag no começo, no meio e com pontuação depois
  (`#praia!`).
- `activeTag`/`insertTag`: cursor no meio da tag, depois de espaço não está ativa, completar põe espaço.
- `splitMentions` com tags: `@` e `#` no mesmo texto; sem `{ tags: true }` a `#` fica texto.
- `MentionText`: post com tag mostra link e toque navega; comentário não.
- Compositor: digitar `#ar` mostra sugestões e tocar completa.
- API: `listFeed({ tag })` filtra com `contains`; `suggestTags` chama a função com o prefixo.
- Tela da tag: lista, vazio, erro com tentar de novo, contagem no topo.
- `npx tsc --noEmit` e `npm test` passam.
