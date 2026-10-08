# fellasapp
App dos FellasInc — rede social fechada para um grupo de amigos (Expo / React Native + Supabase).

## Rodando

```bash
npm install
cp .env.example .env   # preencha as variáveis abaixo
npx expo start         # depois: i (iOS), a (Android) ou w (web)
```

### Variáveis de ambiente

| Variável | Descrição |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | chave anon (pública) do projeto Supabase |

`.env` está no `.gitignore`; nunca commite chaves.

## Scripts

- `npm test` — jest-expo + @testing-library/react-native
- `npx tsc --noEmit` — checagem de tipos
- `npm run build:web` — `expo export -p web`, gera `dist/`

## Créditos

Emojis das reações: [Twemoji](https://github.com/jdecked/twemoji) (gráficos sob CC-BY 4.0), servidos pelo jsDelivr.

## Deploy web no Cloudflare Pages

No ar em **https://fellasapp.pages.dev**. O build web é um SPA estático (`web.output: "single"`) e pode ser instalado como PWA (iPhone: Safari → Adicionar à Tela de Início).

- Projeto Pages `fellasapp` (upload direto, não ligado ao Git). Cada push no `main` publica pelo workflow `.github/workflows/deploy-web.yml` (typecheck + testes + build + `wrangler pages deploy`).
- Segredos do repositório no GitHub: `CLOUDFLARE_API_TOKEN` (Account · Cloudflare Pages · Edit), `CLOUDFLARE_ACCOUNT_ID`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Publicar na mão: `npm run build:web` e `npx wrangler pages deploy dist --project-name fellasapp --branch main`.
- `npm run build:web` roda `scripts/fix-web-export.mjs` depois do `expo export`: o Pages ignora pastas `node_modules`, onde o Expo põe fontes e ícones; o script as move para `assets/vendor`.
- `public/_redirects` (`/* /index.html 200`) é copiado para `dist/` e faz o fallback de SPA para o roteamento.
- No Supabase, *Authentication → URL Configuration → Site URL* = `https://fellasapp.pages.dev`.

## Fellas Games (`games/`)

As mesas (Blackjack; Poker depois) são um projeto Vite + Three.js à parte em `games/`, fora do bundle do app.
O workflow builda depois do app e publica em `/games/<jogo>/` no mesmo Pages, na mesma origem: a mesa usa a
sessão do Supabase que o app já guardou, sem novo login. Toda regra (baralho, pagamento, créditos) roda no banco
(`supabase/migrations/0027_fellas_games.sql` e `0028_blackjack.sql`).

- `npm run dev --prefix games` → `http://localhost:5173/games/blackjack/` (login de teste só no dev).
- `?mock` joga contra as migrações rodando no navegador (PGlite), sem Supabase; `games/dev/frames.html` mostra a
  mesa no tamanho do celular e do PC lado a lado.
- `npm test --prefix games` roda as regras do banco de verdade (PGlite) e a lógica da tela.
