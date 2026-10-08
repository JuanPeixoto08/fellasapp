# Supabase – fellasapp

Schema, RLS e storage do grupo fechado. Nenhuma chave é commitada: use `.env`
(`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`).

## Aplicar

**Supabase CLI**
```bash
supabase link --project-ref <ref>
supabase db push          # aplica supabase/migrations/*.sql
```
`supabase db reset` (local) também roda `seed.sql`.

**SQL editor**: cole `migrations/0001_init.sql` e execute (é idempotente).

**Atenção:** as migrations seguintes também precisam ser aplicadas, em ordem (`db push` ou colar
cada uma no SQL editor; todas são idempotentes):

| Migration | O que traz | Sem ela… |
| --- | --- | --- |
| `0002_profile_extras.sql` | cor do perfil, status, cidade, aniversário | salvar o perfil com esses campos falha |
| `0003_reactions.sql` | tabelas `post_reactions` e `comment_reactions` + RLS | o feed e os posts não carregam (o app busca as reações junto) |
| `0004_reactions_any_emoji.sql` | reação com qualquer emoji (troca a lista fixa de 6 por limite de tamanho) | reagir com emoji fora dos 6 da barra rápida falha |
| `0005_post_images.sql` | até 4 fotos por post (coluna `images`, migra a foto atual de cada post) | postar com 2+ fotos falha (1 foto continua funcionando) |
| `0012_invites.sql` | admin (`profiles.is_admin`, o @oliveira já sai admin) e link de convite de uso único (`invite_links`) | gerar link e abrir convite falham |
| `0013_ideas.sql` | mural de ideias: `ideas`, `idea_votes` (+1/−1), `ideas_feed(sort)` e tempo real | a tela Ideias não carrega nem vota |
| `0014_pinned_post.sql` | post fixado no perfil (`profiles.pinned_post_id` + `set_pinned_post`) | fixar post falha e o perfil não mostra o fixado |
| `0015_profile_banner.sql` | banner do perfil (`profiles.banner_url`) | salvar banner falha |
| `0016_post_tags.sql` | #tags em posts: `posts.tags` (gatilho tira do texto), `tag_suggestions` | página da tag e sugestões de # falham |
| `0017_tag_list.sql` | tela Tags: `tag_suggestions` aceita até 200 | a lista de tags para em 20 |
| `0018_profile_badges.sql` | selos do perfil (`profiles.badges`); @oliveira verificado | posts e comentários não carregam (o app busca `badges` do autor) |
| `0019_lastfm_user.sql` | usuário do Last.fm no perfil (`profiles.lastfm_user`) | salvar perfil com Last.fm falha |
| `0020_post_location.sql` | local nos posts: `posts.location` + `place_key` (gatilho), `place_suggestions` | postar com local, sugestões de local e página do local falham (post sem local funciona) |
| `0021_stories.sql` | stories: `stories`, `story_views`, `story_reactions`, notificação `story_reaction`, limpeza de 24 h (linhas e, via função `stories-media`, arquivos no Cloudinary) | faixa e postar story falham. Antes: segredo `stories_cron_secret` no Vault e a função publicada |
| `0022_comment_images.sql` | até 4 imagens por comentário: `comments.images` (caminhos no bucket `post-images`), comentário só com imagem passa a valer | abrir post falha (a lista de comentários pede `images`) |
| `0023_profile_display.sql` | "O que aparece no perfil": `profiles.show_now_playing` (ouvindo agora nos posts e no perfil) e `profiles.hidden_badges` (selos escondidos) | feed, posts e comentários não carregam (o app busca esses campos do autor) |
| `0024_featured_badge.sql` | selo escolhido para aparecer do lado do nome (`profiles.featured_badge`); `hidden_badges` da 0023 fica sem uso | feed, posts e comentários não carregam (o app busca `featured_badge` do autor) |

**Função `stories-media` (Edge Function)**: publique sempre com
`npx supabase functions deploy stories-media --no-verify-jwt`. A função confere o login sozinha; já a limpeza
(`/cleanup`) é chamada pelo cron do banco só com o cabeçalho `x-cron-secret`, sem login. Sem `--no-verify-jwt`
o gateway do Supabase recusa essa chamada e os arquivos nunca são apagados. Segredos da função:
`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` e `STORIES_CRON_SECRET`. No Vault do
banco: `stories_cron_secret` (mesmo valor de `STORIES_CRON_SECRET`). Nunca escreva os valores no repositório.

Em Auth > Providers, habilite Email (OTP / magic link).

## Modelo de acesso

- `allowed_emails`: lista de convidados. Só membros leem; escrita via link de convite (`redeem_invite`), SQL editor ou service role.
- `invite_links`: links de convite (uso único, 7 dias). Só admin lê; escrita só por `create_invite_link()` (admin) e `redeem_invite()` (quem abriu o link, sem login).
- Ao se cadastrar, o trigger cria o `profile` com `is_member = true` se o email estiver em `allowed_emails`; caso contrário `false` (o app deve mostrar "sem convite").
- Se o convite for adicionado depois do cadastro, o profile existente é promovido automaticamente.
- Só membros leem/escrevem posts, likes, comentários e profiles; cada um só edita/apaga o que é seu. Não-membros só enxergam o próprio profile.
- `is_member` não é editável pelo cliente (grant por coluna).
- Storage `post-images`: bucket **privado**; membros leem (use `createSignedUrl`), upload em `<user_id>/<arquivo>`, máx. 5 MB, só imagens. Guarde o path em `posts.image_url`.

## Convidar um amigo

Pelo app: o admin abre o próprio perfil, toca no ícone de convidar (pessoa com +) e em **Gerar link de
convite**. O link (`https://fellasapp.pages.dev/convite/<token>`) vale para **uma pessoa só, por 7 dias**.
Quem abre põe o email; nessa hora o email entra em `allowed_emails` e o link fica preso a ele. Depois a
pessoa recebe o código, entra e cai direto em "Crie sua senha". Email errado: gere outro link.

Admin é `profiles.is_admin`, que o app não consegue editar. Para conferir ou trocar, no SQL editor:
```sql
select username, is_admin from public.profiles where is_admin;
update public.profiles set is_admin = true where username = 'outro_fella';
```

Conta nova só nasce pelo link: o login não tem mais "Primeiro acesso" (só "Esqueci a senha", que não
cria conta). Email liberado direto no SQL editor também precisa de um link para criar a conta; nesse caso
o link não é gasto, porque o email já estava na lista.

## Tipos

`types/database.ts` é escrito à mão no formato do `supabase gen types typescript`.
Se alterar o schema, atualize-o (ou regenere com a CLI).
