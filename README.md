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

## Deploy web no Cloudflare Pages

O build web é um SPA estático (`web.output: "single"`) e pode ser instalado como PWA no iPhone.

1. No Cloudflare Pages, crie um projeto conectado ao repositório.
2. **Build command:** `npm run build:web` (ou `npx expo export -p web`)
3. **Build output directory:** `dist`
4. Em *Environment variables*, defina `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
5. `public/_redirects` (`/* /index.html 200`) é copiado para `dist/` e faz o fallback de SPA para o roteamento.
