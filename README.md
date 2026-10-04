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
