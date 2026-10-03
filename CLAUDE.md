# fellasapp

Rede social fechada da FellasInc (Expo RN iOS/Android + web PWA, Supabase). Texto da interface em pt-BR.

## Frontend
- **Todo frontend usa a skill Impeccable** (`impeccable`, modo Operate, plataforma adaptive). Leia `PRODUCT.md` e `DESIGN.md` antes de mexer em UI.
- **Telas usam tokens de `lib/theme.ts` e componentes de `components/ui`.** Sem cores, tamanhos, raios ou fontes soltos nas telas. Falta um primitivo? Adicione-o em `components/ui` com tokens.
- Tema claro/escuro via `useTheme()`. Copy no tom do `PRODUCT.md`.
- Não mudar lógica/dados de features ao refazer apresentação.

## Comandos
- `npx tsc --noEmit` e `npm test` devem passar.
