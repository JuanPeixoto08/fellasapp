# fellasapp

Rede social fechada da FellasInc (Expo RN iOS/Android + web PWA, Supabase). Texto da interface em pt-BR.

## Frontend
- **Todo frontend usa a skill Impeccable** (`impeccable`, modo Operate, plataforma adaptive). Leia `PRODUCT.md` e `DESIGN.md` antes de mexer em UI.
- **Telas usam tokens de `lib/theme.ts` e componentes de `components/ui`.** Sem cores, tamanhos, raios ou fontes soltos nas telas. Falta um primitivo? Adicione-o em `components/ui` com tokens.
- Tema claro/escuro via `useTheme()`. Copy no tom do `PRODUCT.md`.
- Não mudar lógica/dados de features ao refazer apresentação.

## Fellas Inc. (games/idle)
- **Caixinha de informação:** toda coisa nova com número ou efeito (gerador, melhoria, bônus, convidado, planta, item
  de minigame) ganha caixinha (`dica.ts` monta o texto, `dicaTela.ts` mostra: mouse no PC e
  foco no teclado; no celular não tem, a pedido do Juan). Ela diz o que a coisa faz **agora**, em números da pessoa. A spec de cada entrega diz onde entra
  caixinha e onde não; não entra onde o próprio item já mostra tudo (ex.: o cartão da Horta).
- Toda entrega nova ganha uma entrada no começo de `novidades.ts` (patch notes).

## Comandos
- `npx tsc --noEmit` e `npm test` devem passar.
