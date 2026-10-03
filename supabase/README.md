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

Em Auth > Providers, habilite Email (OTP / magic link).

## Modelo de acesso

- `allowed_emails`: lista de convidados. Só membros leem; escrita só via SQL editor / service role.
- Ao se cadastrar, o trigger cria o `profile` com `is_member = true` se o email estiver em `allowed_emails`; caso contrário `false` (o app deve mostrar "sem convite").
- Se o convite for adicionado depois do cadastro, o profile existente é promovido automaticamente.
- Só membros leem/escrevem posts, likes, comentários e profiles; cada um só edita/apaga o que é seu. Não-membros só enxergam o próprio profile.
- `is_member` não é editável pelo cliente (grant por coluna).
- Storage `post-images`: bucket **privado**; membros leem (use `createSignedUrl`), upload em `<user_id>/<arquivo>`, máx. 5 MB, só imagens. Guarde o path em `posts.image_url`.

## Convidar um amigo

No SQL editor (email em minúsculas):
```sql
insert into public.allowed_emails (email)
values ('amigo@email.com')
on conflict do nothing;
```
O amigo então entra no app com esse email.

## Tipos

`types/database.ts` é escrito à mão no formato do `supabase gen types typescript`.
Se alterar o schema, atualize-o (ou regenere com a CLI).
