# Fellas Inc., entrega 1 (núcleo): plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou
> superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** publicar a Fellas Inc. jogável: 30 geradores em 5 eras, ~200 melhorias, oportunidades com caixinha e
limite diário, estratégias por era, temporada semanal com placa e selo "unicórnio da semana", placar, cenas animadas
com o fundador padrão e a linha "Fellas Inc." na aba Games do app.

**Arquitetura:** o banco é a autoridade. O catálogo (geradores, melhorias, estratégias) é escrito uma vez em TypeScript
(`games/idle/catalogo.ts`) e vira SQL gerado (`0033`), com um teste que trava os dois iguais. A lógica (`0034`) faz toda
conta no Postgres só quando o jogador age (sem cron por minuto, sem Realtime). A página `games/idle/` (DOM + canvas 2D,
sem Three.js) só anima o número a partir do último estado do banco, com as mesmas fórmulas em `economia.ts` (teste de
paridade com o SQL).

**Tecnologias:** Postgres/Supabase (plpgsql, RLS, pg_cron), Vite + TypeScript + Vitest + PGlite (`games/`), Expo/React
Native + Jest (app).

**Spec:** `docs/superpowers/specs/2026-10-10-fellas-inc-design.md` (seções 1–4, 8, 9, 11 e 12, entrega 1).

**Ajustes de implementação em relação à spec** (sem mudar comportamento):
- Duas migrações em vez de uma: `0033_fellas_inc_catalogo.sql` (gerada) e `0034_fellas_inc.sql` (lógica).
- Valuation em `double precision` (não `numeric`): a mesma precisão do `number` do TypeScript, o que deixa a paridade
  exata o bastante, e passa de 10^300.
- Estratégias que dependem de Contratar/Propriedades (Networking, Marca forte, Monopólio, Cultura de startup) entram no
  catálogo com `ativa = false` e aparecem como "chega com Contratar/o Mapa do rolê". Na era 4 só "Abrir capital" fica
  disponível até a entrega 2.
- Ícones de estratégia ficam para depois: as estratégias aparecem como cartões de texto. Ícones das melhorias de
  gerador são o sprite do gerador com moldura de nível desenhada em CSS; os das sinergias são os dois sprites.

## Restrições globais

- Fellas Inc. **não toca nos créditos do cassino**: nada de `game_wallets`, `game_ledger`, `games_move`, Blackjack, Poker,
  fiado ou `weekly_champion` no código novo.
- Toda tabela com RLS; leitura para membros (`public.is_member()`); escrita só por funções `security definer
  set search_path = public`; funções internas com `revoke all ... from public, anon, authenticated`.
- Erros de usuário: `raise exception '<codigo>' using errcode = 'P0001'`; não membro: `raise exception 'not_member'
  using errcode = '42501'`. Códigos novos começam com `idle_`.
- Todo `update public.`/`delete from public.` com `where` (o `pg_safeupdate` do Supabase barra sem; o teste
  `__tests__/safeUpdateMigrations.test.ts` confere).
- Migrações idempotentes (`create ... if not exists`, `create or replace`, `drop policy if exists`).
- Interface em pt-BR no tom do `PRODUCT.md`, sem emoji como ícone. Texto de usuário sempre por `textContent`.
- Commits sem `Co-Authored-By` nem qualquer marca de IA. Fluxo: branch `fellas-inc-nucleo`, no fim merge local na
  `main` e push (o Juan roda o `supabase db push` dele com `!`, conferindo as colunas antes).
- Comandos de `games/` rodam com `--prefix games` a partir da raiz, ou `cd games && ...`. Antes do merge:
  `npx tsc --noEmit`, `npm test`, `npm test --prefix games` e `npm run build --prefix games` passam.

## Foco da revisão

1. **Semana vira com a página aberta** (segunda 00:00): a próxima chamada devolve o estado da semana nova
   (`started = false`); a tela volta para "Abrir CNPJ" sem quebrar. Teste em `store.test.ts` (Task 13).
2. **Duas compras seguidas além do saldo** (toque duplo): o banco serializa pelo `for update`; a segunda recusa com
   `idle_cant_afford` e o app recarrega o estado. Teste no banco (Task 5).
3. **"Máx" com o valuation exatamente no preço**: arredondamento de ponto flutuante não pode cobrar mais do que tem nem
   comprar zero. Teste em `economia.test.ts` (Task 1) e no banco (Task 5).
4. **Alguém joga segunda 00:00:30, antes do cron do reset**: a placa da semana velha não pode se perder. `idle_lock`
   chama o reset antes de recriar o estado. Teste no banco (Task 7).
5. **Relógio do celular errado**: a animação usa o `server_now` devolvido pelo banco como âncora, não o relógio do
   aparelho. Teste em `store.test.ts` (Task 13).

---

## Estrutura de arquivos

```
supabase/migrations/0033_fellas_inc_catalogo.sql   GERADO por games/idle/catalogo.ts (não editar à mão)
supabase/migrations/0034_fellas_inc.sql            estado, contas, compras, estratégias, oportunidades, placar, reset
games/idle/
  index.html, main.ts, idle.css                    a página
  nomes.ts                                         textos: geradores, melhorias, estratégias (pode mudar à vontade)
  catalogo.ts                                      monta o catálogo (números) + catalogoSql()
  economia.ts                                      fórmulas (iguais às do SQL)
  oportunidades.ts                                 horário e tipo de cada oportunidade (igual ao SQL)
  formatar.ts                                      "R$ 12,3 mi"
  store.ts                                         âncora no relógio do banco, fase da tela, cena da vez
  palco.ts                                         toca as tiras de cena no canvas
  ativos.ts                                        URLs das imagens (import.meta.glob)
  tela.ts                                          DOM: valor, abas, listas, modais
  simulacao.ts                                     simulação de uma semana (balanceamento)
  assets/{cenas,geradores,oportunidades,gerais}/   arte copiada de ../fellas-inc-esbocos
  *.test.ts                                        testes (Vitest)
games/test/idle.test.ts, idleParidade.test.ts      testes do banco (PGlite com as migrações reais)
games/test/db.ts, games/dev/mockDb.ts              + 0033 e 0034 na lista de migrações
games/dev/mockIdle.ts                              API simulada (?mock)
games/shared/api.ts, types.ts, errors.ts           chamadas, formatos e erros novos
games/vite.config.ts                               entrada idle
lib/badges.ts, components/ui/PixelArt.tsx, UnicornBadge.tsx, UserBadge.tsx, index.ts   selo novo
lib/pixelArt.ts                                    os pixels do selo e do ícone do jogo
components/games/GameRows.tsx, app/(tabs)/games.tsx, lib/api/games.ts, types/database.ts   linha Fellas Inc.
__tests__/badges.test.tsx, gamesScreen.test.tsx, gamesApi.test.ts, fellasIncMigration.test.ts
```

---

### Task 1: Catálogo e fórmulas em TypeScript

**Files:**
- Create: `games/idle/nomes.ts`, `games/idle/catalogo.ts`, `games/idle/economia.ts`
- Test: `games/idle/catalogo.test.ts`, `games/idle/economia.test.ts`

**Interfaces:**
- Produz `catalogo: Catalogo`, `montarCatalogo(p?)`, `PARAMETROS`, tipos `Gerador`, `Melhoria`, `Estrategia`, `Catalogo`.
- Produz em `economia.ts`: `type Estado = { generators: number[]; upgrades: number[]; strategies: number[] }`,
  `era(cat, gens)`, `estrategiasAtivas(cat, s)`, `fatores(cat, s)`, `taxa(cat, s)`, `taxaPorUnidade(cat, s, gid)`,
  `custoMult(cat, s)`, `preco(custo, n, k, cm)`, `maxCompra(custo, n, v, cm)`, `podeComprarGerador(s, gid)`,
  `liberada(cat, m, s)`, `acumular(v, taxa, desdeMs, ateMs, boostAteMs)`, `TETO_SEGUNDOS`, `CRESCIMENTO`.
- Convenções: `generators[0]` é o gerador 1 (o SQL usa `int[]` com índice 1); `strategies[0]` é a era 2 e `-1` = não
  escolhida; ids de melhoria: gerador `g*10 + nível` (11…305), gerais `1001…1020`, sinergias `2001…2030`.

- [ ] **Step 1: Criar a branch**

```bash
git checkout -b fellas-inc-nucleo
```

- [ ] **Step 2: Escrever `games/idle/nomes.ts`**

```ts
// Textos da Fellas Inc.: dá pra trocar nomes e frases à vontade (a lógica usa só os ids e os números).
// Depois de mudar, regenere o catálogo do banco: ATUALIZAR_CATALOGO=1 npx vitest run idle/catalogo.test.ts (em games/).

/** Os 30 geradores, na ordem. A cada 6 começa uma era (e uma cena). */
export const GERADORES: readonly string[] = [
  'Você, no notebook da faculdade', 'Post motivacional no LinkedIn', 'Planilha no Excel',
  'Vendendo pra tia no grupo da família', 'Freela no Fiverr', 'Live na Twitch',
  'Estagiário', 'Impressora 3D', 'Grupo de vendas no zap', 'Dropshipping', 'Food truck', 'Loja no Mercado Livre',
  'PPP Podcast', 'Influencer parceiro', 'App na App Store', 'Curso online', 'Agência de marketing', 'Coworking próprio',
  'Grupo de trader', 'Investidor anjo', 'Fazenda de servidores', 'Rodada série A', 'Laboratório de inovação',
  'Fusão com a concorrência',
  'Rolê patrocinado', 'Comprar um time do Brasileirão', 'Ilha particular', 'Filial em Dubai', 'IPO na bolsa',
  'Foguete pra Marte',
];

/** As 5 melhorias de cada gerador (níveis 1, 10, 25, 50 e 100 unidades); cada uma dobra o gerador. */
export const MELHORIAS_GERADOR: readonly (readonly [string, string, string, string, string])[] = [
  ['Carregador original', 'Wi-Fi da biblioteca', 'Segundo monitor', 'Café de máquina', 'Noite virada'],
  ['Foto de terno', 'Textão com emoji', 'Selo de "open to work"', 'Post às 7h da manhã', 'Viralizou no feed'],
  ['PROCV', 'Tabela dinâmica', 'Macro que ninguém entende', 'Gráfico colorido', 'Planilha que ninguém mexe'],
  ['Áudio de 3 minutos', 'Figurinha de bom dia', 'Desconto de família', 'Fiado da tia', 'Tia influencer'],
  ['Cinco estrelas', 'Entrega no mesmo dia', 'Cliente gringo', 'Pacote premium', 'Top Rated'],
  ['Microfone bom', 'Overlay animado', 'Raid surpresa', 'Sub de 1 real', 'Live de 12 horas'],
  ['Crachá com foto', 'Vale-transporte', 'Cafeteira só dele', 'Hora extra (não paga)', 'Efetivação (talvez)'],
  ['Filamento roxo', 'Bico novo', 'Imprimindo a noite toda', 'Segunda impressora', 'Fazenda de impressoras'],
  ['Lista de transmissão', 'Mensagem fixada', 'Status com preço', 'Grupo 2 (lotado)', 'Grupo 3 (VIP)'],
  ['Fornecedor que responde', 'Frete em 40 dias', 'Anúncio no story', 'Loja com domínio próprio', 'Fornecedor nacional'],
  ['Molho da casa', 'Ponto na orla', 'Cardápio no QR', 'Segundo truck', 'Fila dobrando a esquina'],
  ['Frete grátis', 'Medalha amarela', 'Medalha verde', 'MercadoLíder', 'Full'],
  ['Microfone condensador', 'Corte pro TikTok', 'Convidado famoso', 'Episódio de 4 horas', 'Patrocínio de energético'],
  ['Publi com cupom', 'Arroba marcado', 'Recebidos', 'Stories de 15 em 15', 'Collab'],
  ['Ícone bonito', 'Modo escuro', 'Avaliação 4,9', 'Notificação na hora certa', 'App do Ano'],
  ['Aula bônus', 'Certificado com selo', 'Comunidade no Discord', 'Mentoria em grupo', 'Turma esgotada'],
  ['Mídia kit', 'Cliente fixo', 'Reels toda semana', 'Prêmio de agência', 'Conta grande'],
  ['Café liberado', 'Sala de reunião de vidro', 'Pufe colorido', 'Lista de espera', 'Segunda unidade'],
  ['Gráfico de velas', 'Alerta no celular', 'Stop no lugar certo', 'Bot de sinais', 'Mesa proprietária'],
  ['Pitch de 3 minutos', 'Café com investidor', 'Cheque assinado', 'Investidor que indica outro', 'Conselho consultivo'],
  ['Ar-condicionado', 'Nobreak', 'Rack novo', 'Refrigeração líquida', 'Data center próprio'],
  ['Deck bonito', 'Valuation pré-money', 'Lead investor', 'Rodada estendida', 'Série B à vista'],
  ['Post-its na parede', 'Design thinking', 'Hackathon', 'Patente registrada', 'Protótipo que funciona'],
  ['Due diligence', 'Aperto de mão', 'Sinergias (de verdade)', 'Logo novo', 'Monopólio (quase)'],
  ['Pulseira VIP', 'Open bar', 'DJ famoso', 'Camarote', 'Line-up internacional'],
  ['Virar SAF', 'Contratar técnico português', 'Patrocínio master', 'Estádio reformado', 'Título do Brasileirão'],
  ['Píer', 'Heliponto', 'Resort', 'Festa na ilha', 'Ilha vizinha'],
  ['Escritório no arranha-céu', 'Carro de luxo da firma', 'Visto de negócios', 'Parceiro xeique', 'Torre própria'],
  ['Tocar o sino', 'Ação em alta', 'Dividendos', 'Índice da bolsa', 'Bilionário na capa'],
  ['Motor reutilizável', 'Lançamento sem explodir', 'Estação em órbita', 'Base na Lua', 'Colônia em Marte'],
];

/** Melhorias gerais: 4 por era, +% em toda a produção. */
export const GERAIS: readonly { nome: string; frase: string; mult: number; era: number }[] = [
  { era: 1, mult: 1.05, nome: 'Café coado na hora', frase: 'Ninguém trabalha sem café.' },
  { era: 1, mult: 1.05, nome: 'Wi-Fi do vizinho', frase: 'A senha era 12345678.' },
  { era: 1, mult: 1.1, nome: 'Cadeira gamer', frase: 'As costas agradecem.' },
  { era: 1, mult: 1.1, nome: 'Fone com cancelamento de ruído', frase: 'Foco total, mundo no mudo.' },
  { era: 2, mult: 1.1, nome: 'Quadro branco', frase: 'Agora o plano tem setas.' },
  { era: 2, mult: 1.1, nome: 'Pizza na sexta', frase: 'Moral da equipe lá em cima.' },
  { era: 2, mult: 1.15, nome: 'Extensão de 10 tomadas', frase: 'Tudo ligado ao mesmo tempo.' },
  { era: 2, mult: 1.15, nome: 'Ar-condicionado na garagem', frase: 'Calor vencido.' },
  { era: 3, mult: 1.15, nome: 'Plano de saúde', frase: 'Benefício de empresa grande.' },
  { era: 3, mult: 1.15, nome: 'Day off no aniversário', frase: 'Parabéns, volta amanhã.' },
  { era: 3, mult: 1.2, nome: 'Happy hour pago', frase: 'A firma paga a primeira rodada.' },
  { era: 3, mult: 1.2, nome: 'Logo em neon', frase: 'Foto pro LinkedIn garantida.' },
  { era: 4, mult: 1.2, nome: 'Escorregador no escritório', frase: 'Reunião acaba mais rápido.' },
  { era: 4, mult: 1.2, nome: 'Sala de jogos', frase: 'Pingue-pongue também é networking.' },
  { era: 4, mult: 1.25, nome: 'Chef na cozinha', frase: 'Almoço que vira post.' },
  { era: 4, mult: 1.25, nome: 'Consultoria cara', frase: 'Slides lindos, conselho óbvio.' },
  { era: 5, mult: 1.25, nome: 'Jatinho da firma', frase: 'Reunião em outro estado antes do almoço.' },
  { era: 5, mult: 1.25, nome: 'Reunião no iate', frase: 'Pauta: o pôr do sol.' },
  { era: 5, mult: 1.3, nome: 'Cultura de dono', frase: 'Todo mundo pensa como sócio.' },
  { era: 5, mult: 1.3, nome: 'Lenda do mercado', frase: 'Tem até documentário sobre você.' },
];

/** Sinergias: cada unidade da fonte dá +porUnidade no alvo. */
export const SINERGIAS: readonly { nome: string; fonte: number; alvo: number; porUnidade: number }[] = [
  { fonte: 1, alvo: 2, porUnidade: 0.01, nome: 'Post escrito no notebook' },
  { fonte: 2, alvo: 3, porUnidade: 0.01, nome: 'Planilha de engajamento' },
  { fonte: 3, alvo: 4, porUnidade: 0.01, nome: 'Tabela de preços pra família' },
  { fonte: 4, alvo: 5, porUnidade: 0.01, nome: 'Tia indica freela' },
  { fonte: 5, alvo: 6, porUnidade: 0.01, nome: 'Cliente assiste a live' },
  { fonte: 6, alvo: 7, porUnidade: 0.005, nome: 'Live contrata estagiário' },
  { fonte: 7, alvo: 8, porUnidade: 0.01, nome: 'Estagiário opera a impressora' },
  { fonte: 8, alvo: 9, porUnidade: 0.01, nome: 'Foto do produto no zap' },
  { fonte: 9, alvo: 10, porUnidade: 0.01, nome: 'Zap vira loja' },
  { fonte: 10, alvo: 11, porUnidade: 0.01, nome: 'Molho importado' },
  { fonte: 11, alvo: 12, porUnidade: 0.01, nome: 'Marmita no Mercado Livre' },
  { fonte: 12, alvo: 13, porUnidade: 0.005, nome: 'Vendedor vai pro PPP' },
  { fonte: 13, alvo: 14, porUnidade: 0.01, nome: 'Influencer no PPP' },
  { fonte: 14, alvo: 15, porUnidade: 0.01, nome: 'Cupom do app' },
  { fonte: 15, alvo: 16, porUnidade: 0.01, nome: 'Curso de como fazer app' },
  { fonte: 16, alvo: 17, porUnidade: 0.01, nome: 'Aluno vira cliente' },
  { fonte: 17, alvo: 18, porUnidade: 0.01, nome: 'Agência no coworking' },
  { fonte: 18, alvo: 19, porUnidade: 0.005, nome: 'Coworking de traders' },
  { fonte: 19, alvo: 20, porUnidade: 0.01, nome: 'Trader apresenta investidor' },
  { fonte: 20, alvo: 21, porUnidade: 0.01, nome: 'Anjo paga os servidores' },
  { fonte: 21, alvo: 22, porUnidade: 0.01, nome: 'Métricas pro deck' },
  { fonte: 22, alvo: 23, porUnidade: 0.01, nome: 'Rodada banca o laboratório' },
  { fonte: 23, alvo: 24, porUnidade: 0.01, nome: 'Inovação compra a concorrente' },
  { fonte: 24, alvo: 25, porUnidade: 0.005, nome: 'Fusão dá festa' },
  { fonte: 25, alvo: 26, porUnidade: 0.01, nome: 'Rolê no estádio' },
  { fonte: 26, alvo: 27, porUnidade: 0.01, nome: 'Time treina na ilha' },
  { fonte: 27, alvo: 28, porUnidade: 0.01, nome: 'Ilha com voo pra Dubai' },
  { fonte: 28, alvo: 29, porUnidade: 0.01, nome: 'Dubai na bolsa' },
  { fonte: 29, alvo: 30, porUnidade: 0.01, nome: 'IPO paga o foguete' },
  { fonte: 1, alvo: 30, porUnidade: 0.01, nome: 'Do quarto pra Marte' },
];

export type EstrategiaTexto = {
  era: number; opcao: number; nome: string; frase: string;
  ativa?: boolean; requer?: 'contratos' | 'propriedades';
  genDe?: number; genAte?: number; genMult?: number; prodMult?: number; custoMult?: number;
  oppBonusMult?: number; oppExtra?: number; oppSegundos?: number; porGeradorDistinto?: number;
  sociais?: Record<string, number>;
};

/** Estratégias: 3 por era (2 a 5). `ativa: false` = depende de algo que ainda não chegou. */
export const ESTRATEGIAS: readonly EstrategiaTexto[] = [
  { era: 2, opcao: 0, nome: 'Bootstrapping', frase: 'Cresce com o que tem: os geradores do 1 ao 12 rendem 50% a mais.', genDe: 1, genAte: 12, genMult: 1.5 },
  { era: 2, opcao: 1, nome: 'Queimar caixa', frase: 'Tudo custa 25% a mais, mas a produção sobe 60%.', custoMult: 1.25, prodMult: 1.6 },
  { era: 2, opcao: 2, nome: 'Networking', frase: 'Contratos e propriedades valem o dobro.', ativa: false, requer: 'contratos', sociais: { contratoEfeitoMult: 2, propriedadeEfeitoMult: 2 } },
  { era: 3, opcao: 0, nome: 'Viralizar', frase: 'Oportunidades rendem o dobro e o limite do dia sobe 3.', oppBonusMult: 2, oppExtra: 3 },
  { era: 3, opcao: 1, nome: 'Foco no produto', frase: 'Os geradores do 13 ao 18 rendem o dobro.', genDe: 13, genAte: 18, genMult: 2 },
  { era: 3, opcao: 2, nome: 'Marca forte', frase: '+5% de produção por propriedade sua.', ativa: false, requer: 'propriedades', sociais: { porPropriedade: 0.05 } },
  { era: 4, opcao: 0, nome: 'Abrir capital', frase: 'Produção +30%, mas contratar custa o dobro.', prodMult: 1.3, sociais: { contratoCustoMult: 2 } },
  { era: 4, opcao: 1, nome: 'Monopólio', frase: 'Suas propriedades rendem o dobro; tomar custa 50% a mais pra você.', ativa: false, requer: 'propriedades', sociais: { propriedadeBeneficioMult: 2, tomarCustoMult: 1.5 } },
  { era: 4, opcao: 2, nome: 'Cultura de startup', frase: '+15% por contratado, e seus contratados ganham o triplo.', ativa: false, requer: 'contratos', sociais: { porContratado: 0.15, empregadoMult: 3 } },
  { era: 5, opcao: 0, nome: 'Expansão global', frase: 'Os geradores do 25 ao 30 rendem o dobro.', genDe: 25, genAte: 30, genMult: 2 },
  { era: 5, opcao: 1, nome: 'Holding', frase: '+3% de produção por gerador diferente que você tem.', porGeradorDistinto: 0.03 },
  { era: 5, opcao: 2, nome: 'Rolê eterno', frase: 'Oportunidades ficam 30 segundos na tela e o limite do dia sobe 5.', oppSegundos: 30, oppExtra: 5 },
];

/** Nome de cada era (é a cena). */
export const ERAS: readonly string[] = ['Quarto', 'Garagem', 'Escritório', 'Andar inteiro', 'Sede'];
```

- [ ] **Step 3: Escrever o teste do catálogo `games/idle/catalogo.test.ts`** (a parte do SQL entra na Task 3)

```ts
import { describe, expect, it } from 'vitest';

import { catalogo, montarCatalogo, PARAMETROS } from './catalogo';

describe('catálogo', () => {
  it('30 geradores em 5 eras de 6, custo e renda crescentes', () => {
    const g = catalogo.geradores;
    expect(g).toHaveLength(30);
    expect(g.map((x) => x.era)).toEqual(Array.from({ length: 30 }, (_, i) => Math.floor(i / 6) + 1));
    expect(g[0]).toMatchObject({ id: 1, custo: 15, renda: 0.5 });
    for (let i = 1; i < 30; i++) {
      expect(g[i].custo).toBeGreaterThan(g[i - 1].custo);
      expect(g[i].renda).toBeGreaterThan(g[i - 1].renda);
    }
  });

  it('melhorias: 150 de gerador, 20 gerais, 30 sinergias, ids únicos', () => {
    const m = catalogo.melhorias;
    expect(m.filter((x) => x.tipo === 'gerador')).toHaveLength(150);
    expect(m.filter((x) => x.tipo === 'geral')).toHaveLength(20);
    expect(m.filter((x) => x.tipo === 'sinergia')).toHaveLength(30);
    expect(new Set(m.map((x) => x.id)).size).toBe(200);
    expect(m.find((x) => x.id === 71)).toMatchObject({ tipo: 'gerador', gerador: 7, nivel: 1, requer: 1, nome: 'Crachá com foto' });
    expect(m.find((x) => x.id === 305)).toMatchObject({ gerador: 30, nivel: 5, requer: 100 });
  });

  it('12 estratégias; as que dependem de contratos/propriedades vêm desligadas', () => {
    const e = catalogo.estrategias;
    expect(e).toHaveLength(12);
    expect(e.filter((x) => !x.ativa).map((x) => x.nome)).toEqual(['Networking', 'Marca forte', 'Monopólio', 'Cultura de startup']);
    expect(e.find((x) => x.nome === 'Queimar caixa')).toMatchObject({ custoMult: 1.25, prodMult: 1.6, genMult: 1 });
  });

  it('montarCatalogo usa os parâmetros', () => {
    const c = montarCatalogo({ ...PARAMETROS, custoInicial: 20 });
    expect(c.geradores[0].custo).toBe(20);
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npx vitest run idle/catalogo.test.ts` (em `games/`)
Expected: FAIL, `Cannot find module './catalogo'`.

- [ ] **Step 5: Escrever `games/idle/catalogo.ts`**

```ts
// Catálogo da Fellas Inc. montado a partir dos textos (nomes.ts) e dos parâmetros de balanceamento.
// É a fonte única: o banco recebe uma cópia gerada (0033, ver catalogoSql) e um teste trava os dois iguais.
import { ESTRATEGIAS, GERADORES, GERAIS, MELHORIAS_GERADOR, SINERGIAS } from './nomes';

/** Balanceamento (ajustado pela simulação, Task 2). custo_g = custoInicial·crescimentoCusto^(g-1);
 *  renda_g = custo_g / (retornoInicial·crescimentoRetorno^(g-1)) (segundos pra se pagar). */
export const PARAMETROS = { custoInicial: 15, crescimentoCusto: 3.2, retornoInicial: 30, crescimentoRetorno: 1.18 };
export type Parametros = typeof PARAMETROS;

/** Quantas unidades liberam cada nível de melhoria de gerador, e o preço (× custo base do gerador). */
export const NIVEIS = [1, 10, 25, 50, 100] as const;
export const PRECO_NIVEL = [10, 50, 500, 50_000, 5_000_000] as const;
/** Preço das gerais (× custo do primeiro gerador da era), na ordem em que aparecem na era. */
export const PRECO_GERAL = [20, 40, 80, 160] as const;
/** Sinergia: preço (× custo do alvo) e quantas unidades de cada lado pedem. */
export const PRECO_SINERGIA = 100;
export const REQUER_SINERGIA = 15;

export type Gerador = { id: number; era: number; nome: string; custo: number; renda: number };
export type Melhoria =
  | { id: number; tipo: 'gerador'; nome: string; frase: string; preco: number; gerador: number; nivel: number; requer: number }
  | { id: number; tipo: 'geral'; nome: string; frase: string; preco: number; mult: number; requerEra: number }
  | {
      id: number; tipo: 'sinergia'; nome: string; frase: string; preco: number;
      fonte: number; alvo: number; porUnidade: number; requerFonte: number; requerAlvo: number;
    };
export type Estrategia = {
  era: number; opcao: number; nome: string; frase: string; ativa: boolean; requer: 'contratos' | 'propriedades' | null;
  genDe: number | null; genAte: number | null; genMult: number; prodMult: number; custoMult: number;
  oppBonusMult: number; oppExtra: number; oppSegundos: number; porGeradorDistinto: number;
  sociais: Record<string, number>;
};
export type Catalogo = { geradores: Gerador[]; melhorias: Melhoria[]; estrategias: Estrategia[] };

export function montarCatalogo(p: Parametros = PARAMETROS): Catalogo {
  const geradores: Gerador[] = GERADORES.map((nome, i) => {
    const custo = p.custoInicial * p.crescimentoCusto ** i;
    return { id: i + 1, era: Math.floor(i / 6) + 1, nome, custo, renda: custo / (p.retornoInicial * p.crescimentoRetorno ** i) };
  });
  const melhorias: Melhoria[] = [];
  geradores.forEach((g) =>
    MELHORIAS_GERADOR[g.id - 1].forEach((nome, k) =>
      melhorias.push({
        id: g.id * 10 + k + 1, tipo: 'gerador', nome, frase: `Dobra o que "${g.nome}" rende.`,
        preco: g.custo * PRECO_NIVEL[k], gerador: g.id, nivel: k + 1, requer: NIVEIS[k],
      }),
    ),
  );
  GERAIS.forEach((x, i) => {
    const primeiro = geradores[(x.era - 1) * 6];
    const ordem = GERAIS.slice(0, i).filter((y) => y.era === x.era).length;
    melhorias.push({
      id: 1001 + i, tipo: 'geral', nome: x.nome, frase: `${x.frase} Produção +${Math.round((x.mult - 1) * 100)}%.`,
      preco: primeiro.custo * PRECO_GERAL[ordem], mult: x.mult, requerEra: x.era,
    });
  });
  SINERGIAS.forEach((x, i) => {
    const especial = x.fonte === 1 && x.alvo === 30;
    melhorias.push({
      id: 2001 + i, tipo: 'sinergia', nome: x.nome,
      frase: `Cada "${geradores[x.fonte - 1].nome}" dá +${x.porUnidade * 100}% em "${geradores[x.alvo - 1].nome}".`,
      preco: geradores[x.alvo - 1].custo * PRECO_SINERGIA, fonte: x.fonte, alvo: x.alvo, porUnidade: x.porUnidade,
      requerFonte: especial ? 100 : REQUER_SINERGIA, requerAlvo: especial ? 1 : REQUER_SINERGIA,
    });
  });
  const estrategias: Estrategia[] = ESTRATEGIAS.map((e) => ({
    era: e.era, opcao: e.opcao, nome: e.nome, frase: e.frase, ativa: e.ativa ?? true, requer: e.requer ?? null,
    genDe: e.genDe ?? null, genAte: e.genAte ?? null, genMult: e.genMult ?? 1, prodMult: e.prodMult ?? 1,
    custoMult: e.custoMult ?? 1, oppBonusMult: e.oppBonusMult ?? 1, oppExtra: e.oppExtra ?? 0,
    oppSegundos: e.oppSegundos ?? 10, porGeradorDistinto: e.porGeradorDistinto ?? 0, sociais: e.sociais ?? {},
  }));
  return { geradores, melhorias, estrategias };
}

export const catalogo = montarCatalogo();
```

- [ ] **Step 6: Rodar o teste do catálogo e ver passar**

Run: `npx vitest run idle/catalogo.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 7: Escrever `games/idle/economia.test.ts`**

```ts
import { describe, expect, it } from 'vitest';

import { catalogo as cat } from './catalogo';
import { acumular, custoMult, era, liberada, maxCompra, podeComprarGerador, preco, taxa, taxaPorUnidade, type Estado } from './economia';

const vazio = (): Estado => ({ generators: Array(30).fill(0), upgrades: [], strategies: [-1, -1, -1, -1] });
const com = (pares: [number, number][], extra: Partial<Estado> = {}): Estado => {
  const s = { ...vazio(), ...extra };
  s.generators = [...s.generators];
  for (const [g, n] of pares) s.generators[g - 1] = n;
  return s;
};

describe('era', () => {
  it('é a era do gerador mais alto que você tem', () => {
    expect(era(cat, vazio().generators)).toBe(1);
    expect(era(cat, com([[1, 3], [7, 1]]).generators)).toBe(2);
    expect(era(cat, com([[25, 1]]).generators)).toBe(5);
  });
});

describe('taxa', () => {
  it('soma renda × quantidade', () => {
    expect(taxa(cat, com([[1, 2]]))).toBeCloseTo(1, 10);
  });
  it('melhoria de gerador dobra só aquele gerador', () => {
    const s = com([[1, 2], [2, 1]], { upgrades: [11] });
    expect(taxa(cat, s)).toBeCloseTo(2 + cat.geradores[1].renda, 10);
  });
  it('geral multiplica tudo; sinergia soma por unidade da fonte', () => {
    expect(taxa(cat, com([[1, 1]], { upgrades: [1001] }))).toBeCloseTo(0.5 * 1.05, 10);
    const s = com([[1, 10], [2, 1]], { upgrades: [2001] });
    expect(taxa(cat, s)).toBeCloseTo(5 + cat.geradores[1].renda * 1.1, 10);
  });
  it('estratégias: Bootstrapping +50% nos 1–12, Queimar caixa +60% em tudo, Holding +3% por gerador diferente', () => {
    expect(taxa(cat, com([[1, 1], [7, 1]], { strategies: [0, -1, -1, -1] }))).toBeCloseTo((0.5 + cat.geradores[6].renda) * 1.5, 10);
    expect(taxa(cat, com([[1, 1]], { strategies: [1, -1, -1, -1] }))).toBeCloseTo(0.5 * 1.6, 10);
    expect(taxa(cat, com([[1, 1], [2, 1]], { strategies: [-1, -1, -1, 1] }))).toBeCloseTo((0.5 + cat.geradores[1].renda) * 1.06, 10);
  });
  it('taxaPorUnidade × quantidade fecha com a taxa (sem estratégia de gerador distinto)', () => {
    const s = com([[1, 4], [3, 2]], { upgrades: [11, 1001] });
    expect(4 * taxaPorUnidade(cat, s, 1) + 2 * taxaPorUnidade(cat, s, 3)).toBeCloseTo(taxa(cat, s), 10);
  });
});

describe('preço e compra', () => {
  it('cada unidade custa 15% a mais; comprar k soma a série', () => {
    expect(preco(15, 0, 1, 1)).toBeCloseTo(15, 10);
    expect(preco(15, 1, 1, 1)).toBeCloseTo(17.25, 10);
    expect(preco(15, 0, 2, 1)).toBeCloseTo(32.25, 10);
    expect(preco(15, 0, 1, 1.25)).toBeCloseTo(18.75, 10);
  });
  it('máx: com o valuation exatamente no preço de k compra k (nem mais, nem zero)', () => {
    for (const k of [1, 2, 7, 10, 33]) {
      const v = preco(15, 3, k, 1);
      expect(maxCompra(15, 3, v, 1)).toBe(k);
      expect(maxCompra(15, 3, v * 0.999999, 1)).toBe(k - 1);
    }
    expect(maxCompra(15, 0, 0, 1)).toBe(0);
  });
  it('custoMult multiplica as estratégias escolhidas', () => {
    expect(custoMult(cat, vazio())).toBe(1);
    expect(custoMult(cat, { ...vazio(), strategies: [1, -1, -1, -1] })).toBe(1.25);
  });
  it('gerador só libera depois de ter o anterior', () => {
    expect(podeComprarGerador(vazio(), 1)).toBe(true);
    expect(podeComprarGerador(vazio(), 2)).toBe(false);
    expect(podeComprarGerador(com([[1, 1]]), 2)).toBe(true);
  });
  it('melhorias liberam por quantidade, era ou dupla de sinergia', () => {
    const m = (id: number) => cat.melhorias.find((x) => x.id === id)!;
    expect(liberada(cat, m(11), com([[1, 1]]))).toBe(true);
    expect(liberada(cat, m(12), com([[1, 9]]))).toBe(false);
    expect(liberada(cat, m(1005), com([[1, 1]]))).toBe(false);
    expect(liberada(cat, m(1005), com([[7, 1]]))).toBe(true);
    expect(liberada(cat, m(2001), com([[1, 15], [2, 14]]))).toBe(false);
    expect(liberada(cat, m(2001), com([[1, 15], [2, 15]]))).toBe(true);
  });
});

describe('acumular', () => {
  it('soma taxa × tempo, com teto de 8 horas', () => {
    expect(acumular(10, 0.5, 0, 100_000, null)).toBeCloseTo(60, 10);
    expect(acumular(0, 1, 0, 10 * 3600_000, null)).toBeCloseTo(8 * 3600, 6);
  });
  it('produção ×5 só dentro da janela do bônus', () => {
    expect(acumular(0, 1, 0, 100_000, 60_000)).toBeCloseTo(100 + 4 * 60, 10);
    expect(acumular(0, 1, 70_000, 100_000, 60_000)).toBeCloseTo(30, 10);
  });
  it('tempo negativo não tira nada', () => {
    expect(acumular(5, 1, 1000, 0, null)).toBe(5);
  });
});
```

- [ ] **Step 8: Rodar e ver falhar**

Run: `npx vitest run idle/economia.test.ts`
Expected: FAIL, `Cannot find module './economia'`.

- [ ] **Step 9: Escrever `games/idle/economia.ts`**

```ts
// Fórmulas da Fellas Inc. Iguais às do banco (0034): o banco decide, a tela só anima. Um teste de paridade
// (games/test/idleParidade.test.ts) compara as duas com estados de exemplo.
import type { Catalogo, Estrategia, Melhoria } from './catalogo';

export type Estado = { generators: number[]; upgrades: number[]; strategies: number[] };

export const CRESCIMENTO = 1.15;
export const TETO_SEGUNDOS = 8 * 3600;

export function era(cat: Catalogo, gens: number[]): number {
  let e = 1;
  for (const g of cat.geradores) if (gens[g.id - 1] > 0) e = Math.max(e, g.era);
  return e;
}

export function estrategiasAtivas(cat: Catalogo, s: Estado): Estrategia[] {
  return cat.estrategias.filter((e) => s.strategies[e.era - 2] === e.opcao);
}

const porId = new WeakMap<Catalogo, Map<number, Melhoria>>();
function melhoria(cat: Catalogo, id: number): Melhoria | undefined {
  let m = porId.get(cat);
  if (!m) porId.set(cat, (m = new Map(cat.melhorias.map((x) => [x.id, x]))));
  return m.get(id);
}

/** Quanto cada unidade de cada gerador rende (sem o multiplicador global) e o multiplicador global. */
export function fatores(cat: Catalogo, s: Estado): { porGerador: number[]; global: number } {
  const est = estrategiasAtivas(cat, s);
  const dobras = Array(30).fill(0);
  const sinergia = Array(30).fill(1);
  let global = 1;
  for (const id of s.upgrades) {
    const m = melhoria(cat, id);
    if (!m) continue;
    if (m.tipo === 'gerador') dobras[m.gerador - 1]++;
    else if (m.tipo === 'geral') global *= m.mult;
    else sinergia[m.alvo - 1] += m.porUnidade * s.generators[m.fonte - 1];
  }
  for (const e of est) global *= e.prodMult;
  const distintos = s.generators.filter((n) => n > 0).length;
  global *= 1 + est.reduce((a, e) => a + e.porGeradorDistinto, 0) * distintos;
  const porGerador = cat.geradores.map((g) => {
    let mult = 1;
    for (const e of est) if (e.genDe !== null && e.genAte !== null && g.id >= e.genDe && g.id <= e.genAte) mult *= e.genMult;
    return g.renda * 2 ** dobras[g.id - 1] * sinergia[g.id - 1] * mult;
  });
  return { porGerador, global };
}

export function taxa(cat: Catalogo, s: Estado): number {
  const f = fatores(cat, s);
  let soma = 0;
  for (let i = 0; i < 30; i++) soma += s.generators[i] * f.porGerador[i];
  return soma * f.global;
}

export function taxaPorUnidade(cat: Catalogo, s: Estado, gid: number): number {
  const f = fatores(cat, s);
  return f.porGerador[gid - 1] * f.global;
}

export function custoMult(cat: Catalogo, s: Estado): number {
  return estrategiasAtivas(cat, s).reduce((a, e) => a * e.custoMult, 1);
}

/** Preço de comprar k unidades tendo n: custo·1,15^n·(1,15^k − 1)/0,15·cm. */
export function preco(custo: number, n: number, k: number, cm: number): number {
  return ((custo * CRESCIMENTO ** n * (CRESCIMENTO ** k - 1)) / (CRESCIMENTO - 1)) * cm;
}

/** Quantas unidades dá pra comprar com v (nunca cobra mais do que v). */
export function maxCompra(custo: number, n: number, v: number, cm: number): number {
  if (v <= 0) return 0;
  let k = Math.floor(Math.log((v * (CRESCIMENTO - 1)) / (custo * CRESCIMENTO ** n * cm) + 1) / Math.log(CRESCIMENTO));
  while (k > 0 && preco(custo, n, k, cm) > v) k--;
  while (preco(custo, n, k + 1, cm) <= v) k++;
  return Math.max(k, 0);
}

export function podeComprarGerador(s: Estado, gid: number): boolean {
  return gid === 1 || s.generators[gid - 2] >= 1;
}

export function liberada(cat: Catalogo, m: Melhoria, s: Estado): boolean {
  if (m.tipo === 'gerador') return s.generators[m.gerador - 1] >= m.requer;
  if (m.tipo === 'geral') return era(cat, s.generators) >= m.requerEra;
  return s.generators[m.fonte - 1] >= m.requerFonte && s.generators[m.alvo - 1] >= m.requerAlvo;
}

/** Valuation depois de render de `desdeMs` até `ateMs` (teto de 8h; ×5 dentro do bônus que vai até `boostAteMs`). */
export function acumular(v: number, r: number, desdeMs: number, ateMs: number, boostAteMs: number | null): number {
  const dt = Math.min(Math.max((ateMs - desdeMs) / 1000, 0), TETO_SEGUNDOS);
  let boost = 0;
  if (boostAteMs !== null && boostAteMs > desdeMs) boost = Math.max(0, Math.min((Math.min(ateMs, boostAteMs) - desdeMs) / 1000, dt));
  return v + r * dt + r * 4 * boost;
}
```

O `maxCompra` também confere `k + 1` porque o `log` pode errar para baixo por um ulp; o SQL faz o mesmo (Task 5).

- [ ] **Step 10: Rodar e ver passar**

Run: `npx vitest run idle/economia.test.ts idle/catalogo.test.ts`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add games/idle/nomes.ts games/idle/catalogo.ts games/idle/catalogo.test.ts games/idle/economia.ts games/idle/economia.test.ts
git commit -m "Fellas Inc.: catálogo (30 geradores, 200 melhorias, 12 estratégias) e fórmulas"
```

---

### Task 2: Simulação da semana e ajuste do balanceamento

**Files:**
- Create: `games/idle/simulacao.ts`
- Test: `games/idle/simulacao.test.ts`
- Modify (se precisar ajustar): `games/idle/catalogo.ts` (só o objeto `PARAMETROS`)

**Interfaces:**
- Consome: `montarCatalogo`, `PARAMETROS`, `taxa`, `taxaPorUnidade`, `preco`, `custoMult`, `liberada`,
  `podeComprarGerador`, `era`, `estrategiasAtivas`, `acumular` (Task 1).
- Produz: `simular(cat?: Catalogo, dias?: number): Marcos` com
  `type Marcos = { segundaNotebook: number | null; era: Record<number, number | null>; compras1h: number; gerador30: number | null }`.

- [ ] **Step 1: Escrever o teste `games/idle/simulacao.test.ts`**

```ts
import { describe, expect, it } from 'vitest';

import { simular } from './simulacao';

const H = 3600;
const DIA = 24 * H;

// Jogador que abre 3x por dia (meio-dia, 17h, meia-noite) e sempre compra o que se paga mais rápido.
// A primeira sessão dura 1h. Os alvos são os da spec (seção 1.3).
describe('ritmo da semana', () => {
  const m = simular();
  it('2º notebook em até 15 s', () => expect(m.segundaNotebook).not.toBeNull() && expect(m.segundaNotebook!).toBeLessThanOrEqual(15));
  it('era 2 entre 10 e 15 min', () => {
    expect(m.era[2]).not.toBeNull();
    expect(m.era[2]!).toBeGreaterThanOrEqual(10 * 60);
    expect(m.era[2]!).toBeLessThanOrEqual(15 * 60);
  });
  it('era 3 no dia 1', () => expect(m.era[3]!).toBeLessThan(DIA));
  it('era 4 no dia 2 ou 3', () => {
    expect(m.era[4]!).toBeGreaterThanOrEqual(DIA);
    expect(m.era[4]!).toBeLessThan(3 * DIA);
  });
  it('era 5 no dia 4 ou 5', () => {
    expect(m.era[5]!).toBeGreaterThanOrEqual(3 * DIA);
    expect(m.era[5]!).toBeLessThan(5 * DIA);
  });
  it('60 a 100 compras na primeira hora', () => {
    expect(m.compras1h).toBeGreaterThanOrEqual(60);
    expect(m.compras1h).toBeLessThanOrEqual(100);
  });
  it('gerador 30 não sai numa semana jogando assim (raro de propósito)', () => expect(m.gerador30).toBeNull());
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run idle/simulacao.test.ts`
Expected: FAIL, `Cannot find module './simulacao'`.

- [ ] **Step 3: Escrever `games/idle/simulacao.ts`**

```ts
// Simulação de uma semana da Fellas Inc. para travar o ritmo (simulacao.test.ts). Jogador "esperto mas ocupado":
// primeira sessão de 1h; depois abre ao meio-dia, às 17h e à meia-noite por 10 min; em cada abertura pega até 3
// oportunidades guardadas (15 min de produção), escolhe a primeira estratégia ativa e compra, de 5 em 5 segundos,
// sempre o que tem o melhor ganho de taxa por real.
import { catalogo as padrao, type Catalogo } from './catalogo';
import { acumular, custoMult, era, liberada, podeComprarGerador, preco, taxa, taxaPorUnidade, type Estado } from './economia';

export type Marcos = { segundaNotebook: number | null; era: Record<number, number | null>; compras1h: number; gerador30: number | null };

const H = 3600;
const DIA = 24 * H;
const PASSO = 5;

function sessoes(dias: number): [number, number][] {
  const s: [number, number][] = [[0, H]];
  for (let d = 0; d < dias; d++) for (const h of [12, 17, 24]) s.push([d * DIA + h * H, d * DIA + h * H + 10 * 60]);
  return s;
}

export function simular(cat: Catalogo = padrao, dias = 7): Marcos {
  const s: Estado = { generators: Array(30).fill(0), upgrades: [], strategies: [-1, -1, -1, -1] };
  s.generators[0] = 1;
  let v = 10;
  let relogio = 0;
  const marcos: Marcos = { segundaNotebook: null, era: { 2: null, 3: null, 4: null, 5: null }, compras1h: 0, gerador30: null };
  let oppHoje = 0;
  let dia = 0;

  const avancar = (ate: number) => {
    v = acumular(v, taxa(cat, s), relogio * 1000, ate * 1000, null);
    relogio = ate;
  };
  const comprar = () => {
    for (let i = 0; i < 40; i++) {
      const e = era(cat, s.generators);
      if (e >= 2 && s.strategies[e - 2] < 0) {
        s.strategies[e - 2] = cat.estrategias.find((x) => x.era === e && x.ativa)!.opcao;
      }
      const cm = custoMult(cat, s);
      const base = taxa(cat, s);
      let melhor: { score: number; preco: number; aplicar: () => void } | null = null;
      for (const g of cat.geradores) {
        if (!podeComprarGerador(s, g.id)) continue;
        const p = preco(g.custo, s.generators[g.id - 1], 1, cm);
        if (p > v) continue;
        const score = taxaPorUnidade(cat, s, g.id) / p;
        if (!melhor || score > melhor.score) melhor = { score, preco: p, aplicar: () => s.generators[g.id - 1]++ };
      }
      for (const m of cat.melhorias) {
        if (s.upgrades.includes(m.id) || !liberada(cat, m, s)) continue;
        const p = m.preco * cm;
        if (p > v) continue;
        s.upgrades.push(m.id);
        const ganho = taxa(cat, s) - base;
        s.upgrades.pop();
        const score = ganho / p;
        if (!melhor || score > melhor.score) melhor = { score, preco: p, aplicar: () => s.upgrades.push(m.id) };
      }
      if (!melhor) return;
      v -= melhor.preco;
      melhor.aplicar();
      if (relogio <= H) marcos.compras1h++;
      if (marcos.segundaNotebook === null && s.generators[0] >= 2) marcos.segundaNotebook = relogio;
      const agora = era(cat, s.generators);
      for (let k = 2; k <= agora; k++) if (marcos.era[k] === null) marcos.era[k] = relogio;
      if (marcos.gerador30 === null && s.generators[29] > 0) marcos.gerador30 = relogio;
    }
  };

  for (const [ini, fim] of sessoes(dias)) {
    avancar(ini);
    const d = Math.floor(ini / DIA);
    if (d !== dia) { dia = d; oppHoje = 0; }
    if (ini > 0) {
      const pegar = Math.min(3, 10 - oppHoje);
      for (let i = 0; i < pegar; i++) v += taxa(cat, s) * 900;
      oppHoje += pegar;
    }
    for (let t = ini; t < fim; t += PASSO) {
      avancar(t);
      comprar();
    }
  }
  return marcos;
}
```

- [ ] **Step 4: Rodar o teste**

Run: `npx vitest run idle/simulacao.test.ts`
Expected: PASS, ou FAIL em algum marco. Se falhar, ajuste **só** `PARAMETROS` em `catalogo.ts` com esta tabela,
uma mudança por vez, e rode de novo até tudo passar:

| Sintoma | Ajuste |
|---|---|
| era 2 antes de 10 min, ou compras1h > 100 | `crescimentoCusto` +0,1 |
| era 2 depois de 15 min, ou compras1h < 60 | `crescimentoCusto` −0,1 |
| eras 3–5 cedo demais (com a era 2 certa) | `crescimentoRetorno` +0,02 |
| eras 3–5 tarde demais | `crescimentoRetorno` −0,02 |
| gerador 30 saiu na semana | `crescimentoRetorno` +0,02 |
| 2º notebook depois de 15 s | não mexa em `custoInicial`/`retornoInicial` (15 e 30 dão 10 s); confira o `simular` |

Expected ao final: PASS (7 testes). Anote os valores finais no comentário de `PARAMETROS`.

- [ ] **Step 5: Commit**

```bash
git add games/idle/simulacao.ts games/idle/simulacao.test.ts games/idle/catalogo.ts
git commit -m "Fellas Inc.: simulação da semana trava o ritmo (eras, compras da 1ª hora, gerador 30 raro)"
```

---

### Task 3: Catálogo no banco (migração 0033 gerada)

**Files:**
- Modify: `games/idle/catalogo.ts` (acrescentar `catalogoSql`)
- Modify: `games/idle/catalogo.test.ts` (acrescentar o teste do arquivo)
- Create (gerado): `supabase/migrations/0033_fellas_inc_catalogo.sql`

**Interfaces:**
- Produz: `catalogoSql(cat?: Catalogo): string`; tabelas `idle_cat_gen(id, era, nome, custo, renda)`,
  `idle_cat_upg(id, tipo, nome, frase, preco, gerador, nivel, requer, mult, requer_era, fonte, alvo, por_unidade,
  requer_fonte, requer_alvo)`, `idle_cat_est(era, opcao, nome, frase, ativa, requer, gen_de, gen_ate, gen_mult,
  prod_mult, custo_mult, opp_bonus_mult, opp_extra, opp_segundos, por_gerador_distinto, sociais)`.

- [ ] **Step 1: Acrescentar o teste ao fim de `games/idle/catalogo.test.ts`**

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { catalogoSql } from './catalogo';

const ARQUIVO = resolve(__dirname, '../../supabase/migrations/0033_fellas_inc_catalogo.sql');

describe('0033 (catálogo no banco)', () => {
  it('é exatamente o que catalogo.ts gera', () => {
    const sql = catalogoSql();
    if (process.env.ATUALIZAR_CATALOGO) writeFileSync(ARQUIVO, sql);
    expect(readFileSync(ARQUIVO, 'utf8').replace(/\r\n/g, '\n')).toBe(sql);
  });
  it('escapa aspas simples nos textos', () => {
    expect(catalogoSql()).toContain("'Selo de \"open to work\"'");
    expect(catalogoSql({ geradores: [{ id: 1, era: 1, nome: "Pão d'água", custo: 1, renda: 1 }], melhorias: [], estrategias: [] }))
      .toContain("'Pão d''água'");
  });
});
```

(Os `import` vão para o topo do arquivo, junto com os outros.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run idle/catalogo.test.ts`
Expected: FAIL, `catalogoSql is not a function` (ou não exportado).

- [ ] **Step 3: Acrescentar `catalogoSql` ao fim de `games/idle/catalogo.ts`**

```ts
const txt = (s: string) => `'${s.replace(/'/g, "''")}'`;
const num = (n: number | null) => (n === null ? 'null' : String(n));

/** A migração 0033 inteira. Regerar: ATUALIZAR_CATALOGO=1 npx vitest run idle/catalogo.test.ts (em games/). */
export function catalogoSql(cat: Catalogo = catalogo): string {
  const gen = cat.geradores.map((g) => `  (${g.id}, ${g.era}, ${txt(g.nome)}, ${num(g.custo)}, ${num(g.renda)})`);
  const upg = cat.melhorias.map((m) => {
    const c = (k: string) => num(((m as Record<string, unknown>)[k] as number | undefined) ?? null);
    return `  (${m.id}, ${txt(m.tipo)}, ${txt(m.nome)}, ${txt(m.frase)}, ${num(m.preco)}, ${c('gerador')}, ${c('nivel')}, ${c('requer')}, ${c('mult')}, ${c('requerEra')}, ${c('fonte')}, ${c('alvo')}, ${c('porUnidade')}, ${c('requerFonte')}, ${c('requerAlvo')})`;
  });
  const est = cat.estrategias.map(
    (e) =>
      `  (${e.era}, ${e.opcao}, ${txt(e.nome)}, ${txt(e.frase)}, ${e.ativa}, ${e.requer ? txt(e.requer) : 'null'}, ${num(e.genDe)}, ${num(e.genAte)}, ${num(e.genMult)}, ${num(e.prodMult)}, ${num(e.custoMult)}, ${num(e.oppBonusMult)}, ${num(e.oppExtra)}, ${num(e.oppSegundos)}, ${num(e.porGeradorDistinto)}, ${txt(JSON.stringify(e.sociais))}::jsonb)`,
  );
  const lista = (linhas: string[]) => (linhas.length ? `${linhas.join(',\n')};\n` : '');
  return `-- fellasapp: Fellas Inc. (idle), catálogo: geradores, melhorias e estratégias. Idempotente.
-- GERADO por games/idle/catalogo.ts: não edite à mão. Regerar: ATUALIZAR_CATALOGO=1 npx vitest run idle/catalogo.test.ts (em games/).

create table if not exists public.idle_cat_gen (
  id int primary key, era int not null, nome text not null, custo double precision not null, renda double precision not null
);
create table if not exists public.idle_cat_upg (
  id int primary key, tipo text not null check (tipo in ('gerador', 'geral', 'sinergia')), nome text not null, frase text not null,
  preco double precision not null, gerador int, nivel int, requer int, mult double precision, requer_era int,
  fonte int, alvo int, por_unidade double precision, requer_fonte int, requer_alvo int
);
create table if not exists public.idle_cat_est (
  era int not null, opcao int not null, nome text not null, frase text not null, ativa boolean not null, requer text,
  gen_de int, gen_ate int, gen_mult double precision not null, prod_mult double precision not null,
  custo_mult double precision not null, opp_bonus_mult double precision not null, opp_extra int not null,
  opp_segundos int not null, por_gerador_distinto double precision not null, sociais jsonb not null,
  primary key (era, opcao)
);

alter table public.idle_cat_gen enable row level security;
alter table public.idle_cat_upg enable row level security;
alter table public.idle_cat_est enable row level security;
revoke all on public.idle_cat_gen, public.idle_cat_upg, public.idle_cat_est from anon, authenticated;
grant select on public.idle_cat_gen, public.idle_cat_upg, public.idle_cat_est to authenticated;
drop policy if exists "idle_cat_gen_select_members" on public.idle_cat_gen;
create policy "idle_cat_gen_select_members" on public.idle_cat_gen for select to authenticated using (public.is_member());
drop policy if exists "idle_cat_upg_select_members" on public.idle_cat_upg;
create policy "idle_cat_upg_select_members" on public.idle_cat_upg for select to authenticated using (public.is_member());
drop policy if exists "idle_cat_est_select_members" on public.idle_cat_est;
create policy "idle_cat_est_select_members" on public.idle_cat_est for select to authenticated using (public.is_member());

delete from public.idle_cat_gen where true;
delete from public.idle_cat_upg where true;
delete from public.idle_cat_est where true;

insert into public.idle_cat_gen (id, era, nome, custo, renda) values
${lista(gen)}
insert into public.idle_cat_upg (id, tipo, nome, frase, preco, gerador, nivel, requer, mult, requer_era, fonte, alvo, por_unidade, requer_fonte, requer_alvo) values
${lista(upg)}
insert into public.idle_cat_est (era, opcao, nome, frase, ativa, requer, gen_de, gen_ate, gen_mult, prod_mult, custo_mult, opp_bonus_mult, opp_extra, opp_segundos, por_gerador_distinto, sociais) values
${lista(est)}`;
}
```

- [ ] **Step 4: Gerar o arquivo e rodar o teste**

Run (em `games/`): `ATUALIZAR_CATALOGO=1 npx vitest run idle/catalogo.test.ts` e depois `npx vitest run idle/catalogo.test.ts`
Expected: as duas PASS; `supabase/migrations/0033_fellas_inc_catalogo.sql` criado (30 + 200 + 12 linhas de insert).

- [ ] **Step 5: Registrar a 0033 nos testes do banco e no `?mock`**

Em `games/test/db.ts`, acrescente ao fim de `MIGRATIONS`: `'0033_fellas_inc_catalogo.sql',`.
Em `games/dev/mockDb.ts`, acrescente `import m33 from '../../supabase/migrations/0033_fellas_inc_catalogo.sql?raw';`
depois do `m31` e troque `for (const m of [m27, m28, m29, m30, m31])` por `for (const m of [m27, m28, m29, m30, m31, m33])`.

- [ ] **Step 6: Teste do banco com o catálogo, `games/test/idle.test.ts` (o arquivo cresce nas próximas tasks)**

```ts
import { beforeEach, describe, expect, it } from 'vitest';

import { catalogo } from '../idle/catalogo';
import { freshDb, type TestDb } from './db';

export const A = '00000000-0000-0000-0000-00000000000a';
export const B = '00000000-0000-0000-0000-00000000000b';
export const OUT = '00000000-0000-0000-0000-0000000000ff';

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;

beforeEach(async () => {
  t = await freshDb();
  for (const u of [A, B]) await t.member(u);
  await t.member(OUT, { isMember: false });
  await t.as(A);
});

describe('catálogo no banco', () => {
  it('tem os mesmos números do catalogo.ts', async () => {
    const gens = await q<{ id: number; custo: number; renda: number }>('select id, custo, renda from public.idle_cat_gen order by id');
    expect(gens.map((g) => [g.id, g.custo, g.renda])).toEqual(catalogo.geradores.map((g) => [g.id, g.custo, g.renda]));
    expect((await q<{ n: number }>('select count(*)::int as n from public.idle_cat_upg'))[0].n).toBe(200);
    expect((await q<{ n: number }>('select count(*)::int as n from public.idle_cat_est where ativa'))[0].n).toBe(8);
  });
  it('membro lê; anônimo não', async () => {
    const lidos = await t.asRole<{ n: number }>('authenticated', 'select count(*)::int as n from public.idle_cat_gen');
    expect(lidos[0].n).toBe(30);
    await expect(t.asRole('anon', 'select * from public.idle_cat_gen')).rejects.toThrow();
  });
});
```

- [ ] **Step 7: Rodar**

Run (em `games/`): `npx vitest run test/idle.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 8: Commit**

```bash
git add games/idle/catalogo.ts games/idle/catalogo.test.ts supabase/migrations/0033_fellas_inc_catalogo.sql games/test/db.ts games/dev/mockDb.ts games/test/idle.test.ts
git commit -m "Fellas Inc.: catálogo no banco (0033 gerada do catalogo.ts, com trava de igualdade)"
```

---

### Task 4: Estado da semana, contas e "Abrir CNPJ" (0034, parte 1)

**Files:**
- Create: `supabase/migrations/0034_fellas_inc.sql`
- Modify: `games/test/db.ts`, `games/dev/mockDb.ts` (0034 nas listas)
- Test: `games/test/idle.test.ts`

**Interfaces:**
- Consome: `public.is_member()`, `public.games_week_start(ts)`, `public.games_today()` (0027); tabelas da 0033.
- Produz (SQL): tabelas `idle_state`, `idle_weeks`; internas `idle_era(int[])`, `idle_rate(idle_state)`,
  `idle_cost_mult(idle_state)`, `idle_settle(idle_state, timestamptz)`, `idle_lock(uuid)`, `idle_save(idle_state)`,
  `idle_json(idle_state)`; RPCs `idle_open()`, `idle_start()`. As funções de oportunidade usadas em `idle_json`
  (`idle_opp_list`, `idle_opp_cap`) entram já aqui com a versão completa (Task 6 só testa e usa).
- JSON de estado (todas as RPCs devolvem): `{ user_id, week_start, started, valuation, rate, generators[30],
  upgrades[], strategies[4], era, boost_until, half_price, opp_claimed[], opp_left, server_now }`.

- [ ] **Step 1: Escrever os testes (acrescentar em `games/test/idle.test.ts`)**

```ts
type Estado = {
  user_id: string; week_start: string; started: boolean; valuation: number; rate: number; generators: number[];
  upgrades: number[]; strategies: number[]; era: number; boost_until: string | null; half_price: boolean;
  opp_claimed: number[]; opp_left: number; server_now: string;
};
const recuar = (uid: string, segundos: number) =>
  q(`update public.idle_state set settled_at = settled_at - make_interval(secs => $2) where user_id = $1`, [uid, segundos]);

describe('idle_open / idle_start', () => {
  it('primeira vez cria o estado da semana sem empresa aberta', async () => {
    const s = await t.rpc<Estado>('idle_open');
    expect(s).toMatchObject({ user_id: A, started: false, valuation: 0, rate: 0, era: 1, strategies: [-1, -1, -1, -1], upgrades: [], half_price: false });
    expect(s.generators).toEqual(Array(30).fill(0));
  });
  it('não membro é barrado', async () => {
    await t.as(OUT);
    await expect(t.rpc('idle_open')).rejects.toThrow(/not_member/);
  });
  it('Abrir CNPJ: 1 notebook e R$ 10; abrir de novo é erro', async () => {
    const s = await t.rpc<Estado>('idle_start');
    expect(s).toMatchObject({ started: true, valuation: 10, rate: 0.5 });
    expect(s.generators[0]).toBe(1);
    await expect(t.rpc('idle_start')).rejects.toThrow(/idle_started/);
  });
  it('bater o ponto acumula taxa × tempo', async () => {
    await t.rpc('idle_start');
    await recuar(A, 100);
    const s = await t.rpc<Estado>('idle_open');
    expect(s.valuation).toBeCloseTo(60, 0);
  });
  it('teto de 8 horas', async () => {
    await t.rpc('idle_start');
    await recuar(A, 10 * 3600);
    expect((await t.rpc<Estado>('idle_open')).valuation).toBeCloseTo(10 + 0.5 * 8 * 3600, 0);
  });
  it('quem não abriu a empresa não acumula', async () => {
    await t.rpc('idle_open');
    await recuar(A, 3600);
    expect((await t.rpc<Estado>('idle_open')).valuation).toBe(0);
  });
  it('ninguém escreve direto no estado', async () => {
    await t.rpc('idle_start');
    await expect(t.asRole('authenticated', `update public.idle_state set valuation = 1e9 where user_id = '${A}'`)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run test/idle.test.ts`
Expected: FAIL, `function public.idle_open() does not exist`.

- [ ] **Step 3: Escrever `supabase/migrations/0034_fellas_inc.sql` (parte 1)**

```sql
-- fellasapp: Fellas Inc. (idle), núcleo: estado da semana, contas, compras, estratégias, oportunidades, placar e reset.
-- Depende da 0027 (is_member, games_week_start, games_today) e da 0033 (catálogo). Não toca nos créditos do cassino.
-- Tudo é conta feita quando o jogador age (sem cron por minuto): produção = taxa × tempo desde a última ação, com
-- teto de 8h. As mesmas fórmulas existem em games/idle/economia.ts (teste de paridade). Idempotente.

create table if not exists public.idle_state (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  week_start  date not null,
  started     boolean not null default false,
  valuation   double precision not null default 0 check (valuation >= 0),
  generators  int[] not null default array_fill(0, array[30]),
  upgrades    int[] not null default '{}',
  strategies  smallint[] not null default '{-1,-1,-1,-1}',
  boost_until timestamptz,
  half_price  boolean not null default false,
  opp_claimed bigint[] not null default '{}',
  opp_day     date,
  opp_count   int not null default 0,
  settled_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.idle_weeks (
  week_start date primary key,
  unicorn_id uuid references public.profiles (id) on delete set null,
  podium     jsonb not null default '[]',
  closed_at  timestamptz not null default now()
);

alter table public.idle_state enable row level security;
alter table public.idle_weeks enable row level security;
revoke all on public.idle_state, public.idle_weeks from anon, authenticated;
grant select on public.idle_state, public.idle_weeks to authenticated;
drop policy if exists "idle_state_select_members" on public.idle_state;
create policy "idle_state_select_members" on public.idle_state for select to authenticated using (public.is_member());
drop policy if exists "idle_weeks_select_members" on public.idle_weeks;
create policy "idle_weeks_select_members" on public.idle_weeks for select to authenticated using (public.is_member());

-- era = a do gerador mais alto que a pessoa tem (1 se nenhum)
create or replace function public.idle_era(gens int[])
returns int language sql stable set search_path = public as $$
  select coalesce(max(c.era), 1) from public.idle_cat_gen c where gens[c.id] > 0
$$;

-- produção por segundo (igual a economia.ts: taxa)
create or replace function public.idle_rate(s public.idle_state)
returns double precision language sql stable set search_path = public as $$
  with est as (
    select e.* from public.idle_cat_est e where e.opcao = s.strategies[e.era - 1]
  ), gen as (
    select c.renda * s.generators[c.id]
         * power(2::double precision, (select count(*) from public.idle_cat_upg u
                                        where u.tipo = 'gerador' and u.gerador = c.id and u.id = any (s.upgrades)))
         * (1 + coalesce((select sum(u.por_unidade * s.generators[u.fonte]) from public.idle_cat_upg u
                           where u.tipo = 'sinergia' and u.alvo = c.id and u.id = any (s.upgrades)), 0))
         * coalesce((select exp(sum(ln(e.gen_mult))) from est e where c.id between e.gen_de and e.gen_ate), 1) as v
      from public.idle_cat_gen c
  )
  select coalesce((select sum(v) from gen), 0)
       * coalesce((select exp(sum(ln(u.mult))) from public.idle_cat_upg u where u.tipo = 'geral' and u.id = any (s.upgrades)), 1)
       * coalesce((select exp(sum(ln(e.prod_mult))) from est e), 1)
       * (1 + coalesce((select sum(e.por_gerador_distinto) from est e), 0)
            * (select count(*) from public.idle_cat_gen c where s.generators[c.id] > 0))
$$;

create or replace function public.idle_cost_mult(s public.idle_state)
returns double precision language sql stable set search_path = public as $$
  select coalesce(exp(sum(ln(e.custo_mult))), 1) from public.idle_cat_est e where e.opcao = s.strategies[e.era - 1]
$$;

-- fecha a conta até ts (teto de 8h; ×5 dentro do bônus): igual a economia.ts acumular
create or replace function public.idle_settle(s public.idle_state, ts timestamptz default now())
returns public.idle_state language plpgsql stable set search_path = public as $$
declare
  v_dt    double precision;
  v_boost double precision := 0;
  v_rate  double precision;
begin
  if not s.started or ts <= s.settled_at then
    s.settled_at := greatest(s.settled_at, ts);
    return s;
  end if;
  v_rate := public.idle_rate(s);
  v_dt := least(extract(epoch from ts - s.settled_at), 8 * 3600);
  if s.boost_until is not null and s.boost_until > s.settled_at then
    v_boost := greatest(0, least(extract(epoch from least(ts, s.boost_until) - s.settled_at), v_dt));
  end if;
  s.valuation := s.valuation + v_rate * v_dt + v_rate * 4 * v_boost;
  s.settled_at := ts;
  return s;
end;
$$;

-- oportunidades: horário e tipo saem de uma conta com o usuário e a janela de 10 min (igual a oportunidades.ts)
create or replace function public.idle_opp_seed(u uuid)
returns bigint language sql immutable as $$
  select ('x' || '0' || substr(replace(u::text, '-', ''), 1, 7))::bit(32)::int::bigint
$$;

create or replace function public.idle_opp_at(u uuid, w bigint)
returns timestamptz language sql immutable set search_path = public as $$
  select to_timestamp(w * 600 + mod(public.idle_opp_seed(u) * 31 + w * 7919, 590))
$$;

create or replace function public.idle_opp_kind(u uuid, w bigint)
returns int language sql immutable set search_path = public as $$
  select mod(public.idle_opp_seed(u) + w * 13, 3)::int
$$;

-- as até 3 mais recentes que já apareceram, não foram pegas e têm menos de 4h
create or replace function public.idle_opp_list(s public.idle_state, ts timestamptz default now())
returns bigint[] language sql stable set search_path = public as $$
  select coalesce(array_agg(w order by w desc), '{}') from (
    select w
      from generate_series(floor(extract(epoch from ts - interval '4 hours') / 600)::bigint,
                           floor(extract(epoch from ts) / 600)::bigint) w
     where public.idle_opp_at(s.user_id, w) <= ts
       and public.idle_opp_at(s.user_id, w) >= ts - interval '4 hours'
       and not (w = any (s.opp_claimed))
     order by w desc
     limit 3
  ) x
$$;

create or replace function public.idle_opp_cap(s public.idle_state)
returns int language sql stable set search_path = public as $$
  select 10 + coalesce((select sum(e.opp_extra)::int from public.idle_cat_est e where e.opcao = s.strategies[e.era - 1]), 0)
$$;

create or replace function public.idle_json(s public.idle_state)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'user_id', s.user_id, 'week_start', s.week_start, 'started', s.started, 'valuation', s.valuation,
    'rate', public.idle_rate(s), 'generators', to_jsonb(s.generators), 'upgrades', to_jsonb(s.upgrades),
    'strategies', to_jsonb(s.strategies), 'era', public.idle_era(s.generators), 'boost_until', s.boost_until,
    'half_price', s.half_price, 'opp_claimed', to_jsonb(s.opp_claimed),
    'opp_left', greatest(0, public.idle_opp_cap(s)
                             - case when s.opp_day = public.games_today() then s.opp_count else 0 end),
    'server_now', now())
$$;

-- reset da semana (corpo completo na Task 7; aqui só existe para idle_lock compilar)
create or replace function public.idle_weekly_reset()
returns void language plpgsql security definer set search_path = public as $$ begin end $$;

-- linha da pessoa na semana atual, travada; semana virou antes do cron: fecha a velha primeiro
create or replace function public.idle_lock(p_user uuid)
returns public.idle_state language plpgsql volatile set search_path = public as $$
declare
  s      public.idle_state;
  v_week date := public.games_week_start();
begin
  insert into public.idle_state (user_id, week_start) values (p_user, v_week) on conflict (user_id) do nothing;
  select * into s from public.idle_state where user_id = p_user for update;
  if s.week_start < v_week then
    perform public.idle_weekly_reset();
    insert into public.idle_state (user_id, week_start) values (p_user, v_week) on conflict (user_id) do nothing;
    select * into s from public.idle_state where user_id = p_user for update;
  end if;
  return s;
end;
$$;

create or replace function public.idle_save(s public.idle_state)
returns void language sql volatile set search_path = public as $$
  update public.idle_state
     set started = s.started, valuation = s.valuation, generators = s.generators, upgrades = s.upgrades,
         strategies = s.strategies, boost_until = s.boost_until, half_price = s.half_price,
         opp_claimed = s.opp_claimed, opp_day = s.opp_day, opp_count = s.opp_count,
         settled_at = s.settled_at, updated_at = now()
   where user_id = s.user_id
$$;

-- abrir o jogo = bater o ponto: fecha a conta até agora (o teto de 8h recomeça a contar)
create or replace function public.idle_open()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare s public.idle_state;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_settle(public.idle_lock(auth.uid()));
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;

-- "Abrir CNPJ": a empresa começa com 1 notebook e R$ 10
create or replace function public.idle_start()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare s public.idle_state;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_lock(auth.uid());
  if s.started then
    raise exception 'idle_started' using errcode = 'P0001';
  end if;
  s.started := true;
  s.valuation := 10;
  s.generators[1] := 1;
  s.settled_at := now();
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;
```

O bloco de permissões das funções fica no fim do arquivo, e é reescrito inteiro na Task 7 (quando todas existem). Por
enquanto, acrescente ao fim:

```sql
revoke all on function public.idle_era(int[]) from public, anon, authenticated;
revoke all on function public.idle_rate(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_cost_mult(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_settle(public.idle_state, timestamptz) from public, anon, authenticated;
revoke all on function public.idle_opp_seed(uuid) from public, anon, authenticated;
revoke all on function public.idle_opp_at(uuid, bigint) from public, anon, authenticated;
revoke all on function public.idle_opp_kind(uuid, bigint) from public, anon, authenticated;
revoke all on function public.idle_opp_list(public.idle_state, timestamptz) from public, anon, authenticated;
revoke all on function public.idle_opp_cap(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_json(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_weekly_reset() from public, anon, authenticated;
revoke all on function public.idle_lock(uuid) from public, anon, authenticated;
revoke all on function public.idle_save(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_open() from public, anon;
revoke all on function public.idle_start() from public, anon;
grant execute on function public.idle_open() to authenticated;
grant execute on function public.idle_start() to authenticated;
```

- [ ] **Step 4: Registrar a 0034** em `games/test/db.ts` (`'0034_fellas_inc.sql',` no fim de `MIGRATIONS`) e em
`games/dev/mockDb.ts` (`import m34 from '../../supabase/migrations/0034_fellas_inc.sql?raw';` e `m34` no fim do `for`).

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run test/idle.test.ts`
Expected: PASS (catálogo + 7 de idle_open/idle_start).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0034_fellas_inc.sql games/test/db.ts games/dev/mockDb.ts games/test/idle.test.ts
git commit -m "Fellas Inc.: estado da semana, conta da produção com teto de 8h e Abrir CNPJ (0034)"
```

---

### Task 5: Comprar geradores e melhorias; escolher estratégia

**Files:**
- Modify: `supabase/migrations/0034_fellas_inc.sql`
- Test: `games/test/idle.test.ts`

**Interfaces:**
- Produz (SQL): internas `idle_price(double precision, int, int, double precision)`,
  `idle_max_qty(double precision, int, double precision, double precision)`, `idle_upg_unlocked(idle_cat_upg, int[])`;
  RPCs `idle_buy(p_kind text, p_id int, p_qty int default 1)` (`p_kind` em `'gerador' | 'melhoria'`; `p_qty` 1, 10 ou
  0 = máx) e `idle_pick_strategy(p_era int, p_opcao int)`.
- Erros: `idle_not_started`, `idle_strategy_pending`, `idle_cant_afford`, `idle_locked`, `idle_owned`,
  `idle_strategy_set`, `idle_bad_choice`.

- [ ] **Step 1: Escrever os testes (acrescentar em `games/test/idle.test.ts`)**

```ts
const dar = (uid: string, v: number) => q('update public.idle_state set valuation = $2 where user_id = $1', [uid, v]);
const ter = (uid: string, g: number, n: number) => q('update public.idle_state set generators[$2] = $3 where user_id = $1', [uid, g, n]);
const buy = (kind: 'gerador' | 'melhoria', id: number, qty = 1) => t.rpc<Estado>('idle_buy', { p_kind: kind, p_id: id, p_qty: qty });

describe('idle_buy', () => {
  beforeEach(async () => { await t.rpc('idle_start'); });

  it('sem abrir CNPJ é erro', async () => {
    await t.as(B);
    await expect(buy('gerador', 1)).rejects.toThrow(/idle_not_started/);
  });
  it('compra 1 gerador e desconta 15·1,15^n', async () => {
    await dar(A, 100);
    const s = await buy('gerador', 1);
    expect(s.generators[0]).toBe(2);
    expect(s.valuation).toBeCloseTo(100 - 17.25, 1);
  });
  it('sem valuation: idle_cant_afford', async () => {
    await dar(A, 1);
    await expect(buy('gerador', 1)).rejects.toThrow(/idle_cant_afford/);
  });
  it('duas compras seguidas além do saldo: a segunda recusa', async () => {
    await dar(A, 20);
    await buy('gerador', 1);
    await expect(buy('gerador', 1)).rejects.toThrow(/idle_cant_afford/);
  });
  it('gerador só libera com o anterior', async () => {
    await dar(A, 1e9);
    await expect(buy('gerador', 3)).rejects.toThrow(/idle_locked/);
    await buy('gerador', 2);
    await buy('gerador', 3);
  });
  it('comprar 10 e máx (com o valuation exatamente no preço)', async () => {
    await dar(A, 1e6);
    expect((await buy('gerador', 1, 10)).generators[0]).toBe(11);
    const preco7 = (await q<{ p: number }>('select public.idle_price(15, 11, 7, 1) as p'))[0].p;
    await dar(A, preco7);
    const s = await buy('gerador', 1, 0);
    expect(s.generators[0]).toBe(18);
    expect(s.valuation).toBeCloseTo(0, 0); // sobra só o que rendeu nos milissegundos da chamada
  });
  it('qtd inválida e gerador inexistente: idle_bad_choice', async () => {
    await dar(A, 1e6);
    await expect(buy('gerador', 1, 3)).rejects.toThrow(/idle_bad_choice/);
    await expect(buy('gerador', 31)).rejects.toThrow(/idle_bad_choice/);
    await expect(t.rpc('idle_buy', { p_kind: 'xx', p_id: 1, p_qty: 1 })).rejects.toThrow(/idle_bad_choice/);
  });
  it('melhoria de nível 1 dobra o gerador; repetir é idle_owned; nível 2 sem 10 unidades é idle_locked', async () => {
    await dar(A, 1e6);
    const s = await buy('melhoria', 11);
    expect(s.upgrades).toEqual([11]);
    expect(s.rate).toBeCloseTo(1, 6);
    await expect(buy('melhoria', 11)).rejects.toThrow(/idle_owned/);
    await expect(buy('melhoria', 12)).rejects.toThrow(/idle_locked/);
  });
  it('meia-preço vale só na próxima compra unitária e depois some', async () => {
    await dar(A, 100);
    await q('update public.idle_state set half_price = true where user_id = $1', [A]);
    const s = await buy('gerador', 1);
    expect(s.valuation).toBeCloseTo(100 - 17.25 / 2, 1);
    expect(s.half_price).toBe(false);
  });
});

describe('estratégia por era', () => {
  beforeEach(async () => { await t.rpc('idle_start'); await dar(A, 1e9); await ter(A, 7, 1); });
  const pick = (era: number, opcao: number) => t.rpc<Estado>('idle_pick_strategy', { p_era: era, p_opcao: opcao });

  it('entrou na era 2 sem escolher: nenhuma compra passa', async () => {
    await expect(buy('gerador', 1)).rejects.toThrow(/idle_strategy_pending/);
  });
  it('escolhe uma vez; repetir é idle_strategy_set; opção desligada é idle_bad_choice; era futura é idle_locked', async () => {
    await expect(pick(2, 2)).rejects.toThrow(/idle_bad_choice/);
    expect((await pick(2, 0)).strategies).toEqual([0, -1, -1, -1]);
    await expect(pick(2, 1)).rejects.toThrow(/idle_strategy_set/);
    await expect(pick(3, 0)).rejects.toThrow(/idle_locked/);
    await buy('gerador', 1);
  });
  it('Queimar caixa: compras custam 25% a mais', async () => {
    await pick(2, 1);
    await dar(A, 100);
    const s = await buy('gerador', 1);
    expect(s.valuation).toBeCloseTo(100 - 17.25 * 1.25, 1);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run test/idle.test.ts`
Expected: FAIL, `function public.idle_buy(...) does not exist`.

- [ ] **Step 3: Acrescentar à 0034 (antes do bloco de permissões)**

```sql
-- preço de k unidades tendo n (igual a economia.ts preco)
create or replace function public.idle_price(p_custo double precision, p_n int, p_k int, p_cm double precision)
returns double precision language sql immutable as $$
  select p_custo * power(1.15::double precision, p_n) * (power(1.15::double precision, p_k) - 1) / 0.15::double precision * p_cm
$$;

-- quantas unidades cabem em v (igual a economia.ts maxCompra)
create or replace function public.idle_max_qty(p_custo double precision, p_n int, p_v double precision, p_cm double precision)
returns int language plpgsql immutable set search_path = public as $$
declare k int;
begin
  if p_v <= 0 then
    return 0;
  end if;
  k := floor(ln(p_v * 0.15::double precision / (p_custo * power(1.15::double precision, p_n) * p_cm) + 1) / ln(1.15::double precision))::int;
  while k > 0 and public.idle_price(p_custo, p_n, k, p_cm) > p_v loop
    k := k - 1;
  end loop;
  while public.idle_price(p_custo, p_n, k + 1, p_cm) <= p_v loop
    k := k + 1;
  end loop;
  return greatest(k, 0);
end;
$$;

create or replace function public.idle_upg_unlocked(u public.idle_cat_upg, gens int[])
returns boolean language sql stable set search_path = public as $$
  select case u.tipo
    when 'gerador' then gens[u.gerador] >= u.requer
    when 'geral' then public.idle_era(gens) >= u.requer_era
    else gens[u.fonte] >= u.requer_fonte and gens[u.alvo] >= u.requer_alvo
  end
$$;

create or replace function public.idle_buy(p_kind text, p_id int, p_qty int default 1)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s      public.idle_state;
  g      public.idle_cat_gen;
  u      public.idle_cat_upg;
  v_era  int;
  v_cm   double precision;
  v_n    int;
  v_k    int;
  v_preco double precision;
  v_meia boolean := false;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_lock(auth.uid());
  if not s.started then
    raise exception 'idle_not_started' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s);
  v_era := public.idle_era(s.generators);
  if v_era >= 2 and s.strategies[v_era - 1] < 0 then
    raise exception 'idle_strategy_pending' using errcode = 'P0001';
  end if;
  v_cm := public.idle_cost_mult(s);

  if p_kind = 'gerador' then
    select * into g from public.idle_cat_gen where id = p_id;
    if not found then
      raise exception 'idle_bad_choice' using errcode = 'P0001';
    end if;
    if p_id > 1 and s.generators[p_id - 1] < 1 then
      raise exception 'idle_locked' using errcode = 'P0001';
    end if;
    v_n := s.generators[p_id];
    if p_qty = 0 then
      v_k := public.idle_max_qty(g.custo, v_n, s.valuation, v_cm);
      if v_k < 1 then
        raise exception 'idle_cant_afford' using errcode = 'P0001';
      end if;
    elsif p_qty in (1, 10) then
      v_k := p_qty;
    else
      raise exception 'idle_bad_choice' using errcode = 'P0001';
    end if;
    v_preco := public.idle_price(g.custo, v_n, v_k, v_cm);
    if s.half_price and v_k = 1 then
      v_preco := v_preco / 2;
      v_meia := true;
    end if;
    if v_preco > s.valuation then
      raise exception 'idle_cant_afford' using errcode = 'P0001';
    end if;
    s.valuation := s.valuation - v_preco;
    s.generators[p_id] := v_n + v_k;
  elsif p_kind = 'melhoria' then
    select * into u from public.idle_cat_upg where id = p_id;
    if not found then
      raise exception 'idle_bad_choice' using errcode = 'P0001';
    end if;
    if p_id = any (s.upgrades) then
      raise exception 'idle_owned' using errcode = 'P0001';
    end if;
    if not public.idle_upg_unlocked(u, s.generators) then
      raise exception 'idle_locked' using errcode = 'P0001';
    end if;
    v_preco := u.preco * v_cm;
    if s.half_price then
      v_preco := v_preco / 2;
      v_meia := true;
    end if;
    if v_preco > s.valuation then
      raise exception 'idle_cant_afford' using errcode = 'P0001';
    end if;
    s.valuation := s.valuation - v_preco;
    s.upgrades := array_append(s.upgrades, p_id);
  else
    raise exception 'idle_bad_choice' using errcode = 'P0001';
  end if;

  if v_meia then
    s.half_price := false;
  end if;
  s.valuation := greatest(s.valuation, 0);
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;

create or replace function public.idle_pick_strategy(p_era int, p_opcao int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare s public.idle_state;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_lock(auth.uid());
  if not s.started then
    raise exception 'idle_not_started' using errcode = 'P0001';
  end if;
  if p_era < 2 or p_era > public.idle_era(s.generators) then
    raise exception 'idle_locked' using errcode = 'P0001';
  end if;
  if s.strategies[p_era - 1] >= 0 then
    raise exception 'idle_strategy_set' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.idle_cat_est e where e.era = p_era and e.opcao = p_opcao and e.ativa) then
    raise exception 'idle_bad_choice' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s); -- o tempo até agora rende com a regra antiga
  s.strategies[p_era - 1] := p_opcao;
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;
```

E no bloco de permissões:

```sql
revoke all on function public.idle_price(double precision, int, int, double precision) from public, anon, authenticated;
revoke all on function public.idle_max_qty(double precision, int, double precision, double precision) from public, anon, authenticated;
revoke all on function public.idle_upg_unlocked(public.idle_cat_upg, int[]) from public, anon, authenticated;
revoke all on function public.idle_buy(text, int, int) from public, anon;
revoke all on function public.idle_pick_strategy(int, int) from public, anon;
grant execute on function public.idle_buy(text, int, int) to authenticated;
grant execute on function public.idle_pick_strategy(int, int) to authenticated;
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run test/idle.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0034_fellas_inc.sql games/test/idle.test.ts
git commit -m "Fellas Inc.: comprar geradores (1, 10, máx) e melhorias, estratégia obrigatória por era"
```

---

### Task 6: Oportunidades

**Files:**
- Create: `games/idle/oportunidades.ts`
- Test: `games/idle/oportunidades.test.ts`, `games/test/idle.test.ts`
- Modify: `supabase/migrations/0034_fellas_inc.sql` (RPC de pegar)

**Interfaces:**
- Produz (TS): `semente(uid)`, `instante(uid, w): number` (ms), `tipo(uid, w): 0 | 1 | 2`, `pendentes(uid, agoraMs,
  pegas: number[]): number[]` (até 3, da mais nova pra mais velha), `aoVivo(uid, agoraMs, duracaoS): number | null`,
  `TEXTO_TIPO: Record<0|1|2, string>`.
- Produz (SQL): `idle_claim_opportunity(p_window bigint)`. Tipo 0 = 15 min de produção na hora; 1 = ×5 por 60 s;
  2 = próxima compra pela metade. "Viralizar" multiplica 0 e 1 por `opp_bonus_mult`.
- Erros: `idle_opp_gone`, `idle_opp_cap`.

- [ ] **Step 1: Teste TS `games/idle/oportunidades.test.ts`**

```ts
import { describe, expect, it } from 'vitest';

import { aoVivo, instante, pendentes, semente, tipo } from './oportunidades';

const U = '00000000-0000-0000-0000-00000000000a';
const V = '1234abcd-0000-0000-0000-000000000000';

describe('oportunidades', () => {
  it('semente = 7 primeiros hex do uuid', () => {
    expect(semente(U)).toBe(0);
    expect(semente(V)).toBe(0x1234abc);
  });
  it('cada janela de 10 min tem uma, num segundo entre 0 e 589', () => {
    for (let w = 2_980_000; w < 2_980_050; w++) {
      const t = instante(V, w);
      expect(t).toBeGreaterThanOrEqual(w * 600_000);
      expect(t).toBeLessThan(w * 600_000 + 590_000);
      expect([0, 1, 2]).toContain(tipo(V, w));
    }
  });
  it('pendentes: até 3, já passaram, menos de 4h, sem as pegas', () => {
    const agora = 2_980_100 * 600_000 + 300_000;
    const p = pendentes(V, agora, []);
    expect(p).toHaveLength(3);
    for (const w of p) {
      expect(instante(V, w)).toBeLessThanOrEqual(agora);
      expect(instante(V, w)).toBeGreaterThanOrEqual(agora - 4 * 3600_000);
    }
    expect(pendentes(V, agora, [p[0]])).not.toContain(p[0]);
  });
  it('ao vivo só durante os segundos em que ela está na tela', () => {
    const w = 2_980_100;
    const t = instante(V, w);
    expect(aoVivo(V, t + 5000, 10)).toBe(w);
    expect(aoVivo(V, t + 11_000, 10)).toBeNull();
    expect(aoVivo(V, t + 25_000, 30)).toBe(w);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run idle/oportunidades.test.ts` → FAIL (módulo não existe).

- [ ] **Step 3: Escrever `games/idle/oportunidades.ts`**

```ts
// Oportunidades ("cookie dourado"): uma por janela de 10 min, num segundo sorteado pela conta abaixo (igual ao
// banco: idle_opp_at / idle_opp_kind na 0034). Não precisa ser segredo: o banco confere a janela antes de pagar.
export const JANELA_S = 600;
export const VALIDADE_S = 4 * 3600;

export const semente = (uid: string) => parseInt(uid.replace(/-/g, '').slice(0, 7), 16);

/** Quando a oportunidade da janela w aparece (ms). */
export const instante = (uid: string, w: number) => (w * JANELA_S + ((semente(uid) * 31 + w * 7919) % 590)) * 1000;

export const tipo = (uid: string, w: number) => ((semente(uid) + w * 13) % 3) as 0 | 1 | 2;

export const TEXTO_TIPO: Record<0 | 1 | 2, string> = {
  0: '15 minutos de produção na hora',
  1: 'Produção ×5 por 1 minuto',
  2: 'Próxima compra pela metade',
};

/** As até 3 mais recentes que já apareceram, têm menos de 4h e não foram pegas (igual a idle_opp_list). */
export function pendentes(uid: string, agoraMs: number, pegas: number[]): number[] {
  const ate = Math.floor(agoraMs / 1000 / JANELA_S);
  const de = Math.floor((agoraMs / 1000 - VALIDADE_S) / JANELA_S);
  const out: number[] = [];
  for (let w = ate; w >= de && out.length < 3; w--) {
    const t = instante(uid, w);
    if (t <= agoraMs && t >= agoraMs - VALIDADE_S * 1000 && !pegas.includes(w)) out.push(w);
  }
  return out;
}

/** A janela cuja oportunidade está passando na tela agora (fica `duracaoS` segundos), ou null. */
export function aoVivo(uid: string, agoraMs: number, duracaoS: number): number | null {
  const w = Math.floor(agoraMs / 1000 / JANELA_S);
  const t = instante(uid, w);
  return agoraMs >= t && agoraMs <= t + duracaoS * 1000 ? w : null;
}
```

- [ ] **Step 4: Rodar** — `npx vitest run idle/oportunidades.test.ts` → PASS.

- [ ] **Step 5: Testes do banco (acrescentar em `games/test/idle.test.ts`)**

```ts
import { pendentes, tipo } from '../idle/oportunidades';

const claim = (w: number) => t.rpc<Estado>('idle_claim_opportunity', { p_window: w });

describe('oportunidades no banco', () => {
  beforeEach(async () => { await t.rpc('idle_start'); });

  it('o banco e a tela concordam nas pendentes', async () => {
    const s = await t.rpc<Estado>('idle_open');
    expect(pendentes(A, Date.parse(s.server_now), [])).toEqual(
      (await q<{ l: string[] }>(`select public.idle_opp_list(s, $2::timestamptz) as l from public.idle_state s where user_id = $1`, [A, s.server_now]))[0].l.map(Number),
    );
  });
  it('pega uma (cada tipo com o seu bônus) e não pega de novo', async () => {
    const s0 = await t.rpc<Estado>('idle_open');
    const lista = pendentes(A, Date.parse(s0.server_now), []);
    const w = lista[0];
    const antes = s0.valuation;
    const s = await claim(w);
    if (tipo(A, w) === 0) expect(s.valuation).toBeCloseTo(antes + 0.5 * 900, 0);
    if (tipo(A, w) === 1) expect(Date.parse(s.boost_until!) - Date.parse(s.server_now)).toBeGreaterThan(55_000);
    if (tipo(A, w) === 2) expect(s.half_price).toBe(true);
    expect(s.opp_claimed.map(Number)).toContain(w);
    expect(s.opp_left).toBe(9);
    await expect(claim(w)).rejects.toThrow(/idle_opp_gone/);
  });
  it('janela do futuro ou velha demais: idle_opp_gone', async () => {
    const s = await t.rpc<Estado>('idle_open');
    const agoraW = Math.floor(Date.parse(s.server_now) / 600_000);
    await expect(claim(agoraW + 2)).rejects.toThrow(/idle_opp_gone/);
    await expect(claim(agoraW - 30)).rejects.toThrow(/idle_opp_gone/);
  });
  it('limite de 10 por dia; dia novo zera', async () => {
    await q(`update public.idle_state set opp_day = public.games_today(), opp_count = 10 where user_id = $1`, [A]);
    const s = await t.rpc<Estado>('idle_open');
    expect(s.opp_left).toBe(0);
    const w = pendentes(A, Date.parse(s.server_now), [])[0];
    await expect(claim(w)).rejects.toThrow(/idle_opp_cap/);
    await q(`update public.idle_state set opp_day = public.games_today() - 1 where user_id = $1`, [A]);
    await claim(w);
  });
});
```

- [ ] **Step 6: Rodar e ver falhar** — `npx vitest run test/idle.test.ts` → FAIL (`idle_claim_opportunity` não existe).

- [ ] **Step 7: Acrescentar à 0034 (antes do bloco de permissões)**

```sql
create or replace function public.idle_claim_opportunity(p_window bigint)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s      public.idle_state;
  v_mult double precision;
  v_rate double precision;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_lock(auth.uid());
  if not s.started then
    raise exception 'idle_not_started' using errcode = 'P0001';
  end if;
  if not (p_window = any (public.idle_opp_list(s))) then
    raise exception 'idle_opp_gone' using errcode = 'P0001';
  end if;
  if s.opp_day is distinct from public.games_today() then
    s.opp_day := public.games_today();
    s.opp_count := 0;
  end if;
  if s.opp_count >= public.idle_opp_cap(s) then
    raise exception 'idle_opp_cap' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s);
  v_mult := coalesce((select exp(sum(ln(e.opp_bonus_mult))) from public.idle_cat_est e where e.opcao = s.strategies[e.era - 1]), 1);
  v_rate := public.idle_rate(s);
  case public.idle_opp_kind(s.user_id, p_window)
    when 0 then s.valuation := s.valuation + v_rate * 900 * v_mult;
    when 1 then s.boost_until := greatest(now(), coalesce(s.boost_until, now())) + make_interval(secs => 60 * v_mult);
    else s.half_price := true;
  end case;
  s.opp_claimed := array_append(s.opp_claimed, p_window);
  s.opp_count := s.opp_count + 1;
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;
```

E no bloco de permissões:

```sql
revoke all on function public.idle_claim_opportunity(bigint) from public, anon;
grant execute on function public.idle_claim_opportunity(bigint) to authenticated;
```

- [ ] **Step 8: Rodar** — `npx vitest run test/idle.test.ts idle/oportunidades.test.ts` → PASS.

- [ ] **Step 9: Commit**

```bash
git add games/idle/oportunidades.ts games/idle/oportunidades.test.ts supabase/migrations/0034_fellas_inc.sql games/test/idle.test.ts
git commit -m "Fellas Inc.: oportunidades guardadas (até 3, 4h), limite diário e os três bônus"
```

---

### Task 7: Placar, reset de segunda, placa e selo

**Files:**
- Modify: `supabase/migrations/0034_fellas_inc.sql`
- Test: `games/test/idle.test.ts`

**Interfaces:**
- Produz: RPC `idle_board()` → `[{ user_id, valuation, era, strategies }]` (ordem decrescente, só quem abriu a
  empresa na semana); `idle_weekly_reset()` completo; cron `fellas-inc-reset` `0 3 * * 1`; selo `weekly_unicorn`;
  `idle_weeks.podium` = top 3 `[{ user_id, valuation, era, strategies }]`.

- [ ] **Step 1: Testes (acrescentar em `games/test/idle.test.ts`)**

```ts
const envelhecer = () => q('update public.idle_state set week_start = week_start - 7 where true');

describe('placar', () => {
  it('só quem abriu a empresa, do maior pro menor valuation', async () => {
    await t.rpc('idle_start');
    await dar(A, 500);
    await t.as(B);
    await t.rpc('idle_start');
    await dar(B, 900);
    const rows = await t.rpc<{ user_id: string; valuation: number; era: number }[]>('idle_board');
    expect(rows.map((r) => r.user_id)).toEqual([B, A]);
    expect(rows[0].valuation).toBeGreaterThanOrEqual(900);
  });
});

describe('reset de segunda', () => {
  beforeEach(async () => {
    await t.rpc('idle_start');
    await dar(A, 500);
    await t.as(B);
    await t.rpc('idle_start');
    await dar(B, 900);
  });

  it('grava a placa, passa o selo pro unicórnio e zera a semana', async () => {
    await q(`update public.profiles set badges = '{weekly_unicorn}' where id = $1`, [A]);
    await envelhecer();
    await q('select public.idle_weekly_reset()');
    const [semana] = await q<{ unicorn_id: string; podium: { user_id: string; valuation: number }[] }>('select unicorn_id, podium from public.idle_weeks');
    expect(semana.unicorn_id).toBe(B);
    expect(semana.podium.map((p) => p.user_id)).toEqual([B, A]);
    expect(await q('select id from public.profiles where \'weekly_unicorn\' = any (badges)')).toEqual([{ id: B }]);
    expect(await q('select * from public.idle_state')).toEqual([]);
  });
  it('não mexe no troféu do cassino', async () => {
    await q(`update public.profiles set badges = '{weekly_champion}' where id = $1`, [A]);
    await envelhecer();
    await q('select public.idle_weekly_reset()');
    expect(await q('select badges from public.profiles where id = $1', [A])).toEqual([{ badges: ['weekly_champion'] }]);
  });
  it('quem joga antes do cron: a placa da semana velha não se perde', async () => {
    await envelhecer();
    const s = await t.rpc<Estado>('idle_open');
    expect(s.started).toBe(false);
    expect((await q<{ unicorn_id: string }>('select unicorn_id from public.idle_weeks'))[0].unicorn_id).toBe(B);
  });
  it('sem semana velha não faz nada; cron registrado', async () => {
    await q('select public.idle_weekly_reset()');
    expect(await q('select * from public.idle_weeks')).toEqual([]);
    expect(await q(`select schedule, command from cron.jobs where name = 'fellas-inc-reset'`)).toEqual([
      { schedule: '0 3 * * 1', command: 'select public.idle_weekly_reset()' },
    ]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run test/idle.test.ts` → FAIL (`idle_board` não existe; reset vazio).

- [ ] **Step 3: Na 0034, trocar o `idle_weekly_reset` vazio da Task 4 por este (mesmo lugar) e acrescentar `idle_board`**

```sql
-- segunda 00:00 (Brasília): grava a placa, passa o selo de unicórnio e zera a semana. Também é chamada por
-- idle_lock se alguém jogar antes do cron. Não mexe no troféu do cassino (weekly_champion).
create or replace function public.idle_weekly_reset()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_new    date := public.games_week_start();
  v_old    date;
  v_podium jsonb;
  v_champ  uuid;
begin
  select max(week_start) into v_old from public.idle_state where week_start < v_new;
  if v_old is null then
    return;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id', x.user_id, 'valuation', x.v, 'era', x.era,
                                               'strategies', to_jsonb(x.strategies)) order by x.v desc), '[]')
    into v_podium
    from (select s.user_id, (public.idle_settle(s)).valuation as v, public.idle_era(s.generators) as era, s.strategies
            from public.idle_state s
           where s.week_start < v_new and s.started
           order by 2 desc
           limit 3) x;
  v_champ := (v_podium -> 0 ->> 'user_id')::uuid;
  insert into public.idle_weeks (week_start, unicorn_id, podium) values (v_old, v_champ, v_podium)
  on conflict (week_start) do nothing;
  update public.profiles set badges = array_remove(badges, 'weekly_unicorn') where 'weekly_unicorn' = any (badges);
  if v_champ is not null then
    update public.profiles set badges = array_append(badges, 'weekly_unicorn') where id = v_champ;
  end if;
  delete from public.idle_state where week_start < v_new;
end;
$$;

create or replace function public.idle_board()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object('user_id', x.user_id, 'valuation', x.v, 'era', x.era,
                                                 'strategies', to_jsonb(x.strategies)) order by x.v desc), '[]')
      from (select s.user_id, (public.idle_settle(s)).valuation as v, public.idle_era(s.generators) as era, s.strategies
              from public.idle_state s
             where s.week_start = public.games_week_start() and s.started) x);
end;
$$;
```

Mova a definição do `idle_weekly_reset` para **antes** de `idle_lock` (já está nesse lugar desde a Task 4: só troque o
corpo). Ao fim do bloco de permissões, acrescente:

```sql
revoke all on function public.idle_board() from public, anon;
grant execute on function public.idle_board() to authenticated;

select cron.schedule('fellas-inc-reset', '0 3 * * 1', $$select public.idle_weekly_reset()$$);
```

- [ ] **Step 4: Rodar** — `npx vitest run test/idle.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0034_fellas_inc.sql games/test/idle.test.ts
git commit -m "Fellas Inc.: placar, reset de segunda com placa e selo de unicórnio (cron fellas-inc-reset)"
```

---

### Task 8: Paridade TypeScript × banco

**Files:**
- Test: `games/test/idleParidade.test.ts`

**Interfaces:**
- Consome: `taxa`, `preco`, `maxCompra`, `custoMult`, `acumular` (Task 1); `idle_rate`, `idle_price`, `idle_max_qty`,
  `idle_cost_mult`, `idle_settle` (Tasks 4–5).

- [ ] **Step 1: Escrever `games/test/idleParidade.test.ts`**

```ts
import { beforeAll, describe, expect, it } from 'vitest';

import { catalogo } from '../idle/catalogo';
import { acumular, custoMult, maxCompra, preco, taxa, type Estado } from '../idle/economia';
import { freshDb, type TestDb } from './db';

const A = '00000000-0000-0000-0000-00000000000a';
let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;

// gerador pseudoaleatório fixo: os mesmos estados toda vez
function rng(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}
function estados(n: number): Estado[] {
  const r = rng(42);
  const out: Estado[] = [];
  for (let i = 0; i < n; i++) {
    const generators = Array.from({ length: 30 }, (_, g) => (r() < 0.7 - g * 0.02 ? Math.floor(r() * 120) : 0));
    const upgrades = catalogo.melhorias.filter(() => r() < 0.3).map((m) => m.id);
    const strategies = [0, 1, 2, 3].map((k) => {
      const ops = catalogo.estrategias.filter((e) => e.era === k + 2 && e.ativa).map((e) => e.opcao);
      return r() < 0.7 ? ops[Math.floor(r() * ops.length)] : -1;
    });
    out.push({ generators, upgrades, strategies });
  }
  return out;
}
const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(1, Math.abs(b));

beforeAll(async () => {
  t = await freshDb();
  await t.member(A);
});

describe('paridade', () => {
  it('taxa e multiplicador de custo', async () => {
    for (const s of estados(40)) {
      await q('delete from public.idle_state where true');
      await q(
        `insert into public.idle_state (user_id, week_start, started, generators, upgrades, strategies)
         values ($1, public.games_week_start(), true, $2, $3, $4)`,
        [A, s.generators, s.upgrades, s.strategies],
      );
      const [db] = await q<{ r: number; cm: number }>(
        'select public.idle_rate(s) as r, public.idle_cost_mult(s) as cm from public.idle_state s where user_id = $1',
        [A],
      );
      expect(rel(db.r, taxa(catalogo, s))).toBeLessThan(1e-9);
      expect(rel(db.cm, custoMult(catalogo, s))).toBeLessThan(1e-12);
    }
  });
  it('preço e máx', async () => {
    const r = rng(7);
    for (let i = 0; i < 200; i++) {
      const g = catalogo.geradores[Math.floor(r() * 30)];
      const n = Math.floor(r() * 300);
      const cm = [1, 1.25][Math.floor(r() * 2)];
      const v = preco(g.custo, n, 1 + Math.floor(r() * 40), cm) * (0.5 + r());
      const [db] = await q<{ p: number; k: number }>(
        'select public.idle_price($1, $2, 10, $3) as p, public.idle_max_qty($1, $2, $4, $3) as k',
        [g.custo, n, cm, v],
      );
      expect(rel(db.p, preco(g.custo, n, 10, cm))).toBeLessThan(1e-12);
      expect(db.k).toBe(maxCompra(g.custo, n, v, cm));
    }
  });
  it('fechar a conta (com teto e bônus)', async () => {
    const s = estados(1)[0];
    await q('delete from public.idle_state where true');
    await q(
      `insert into public.idle_state (user_id, week_start, started, valuation, generators, upgrades, strategies, settled_at, boost_until)
       values ($1, public.games_week_start(), true, 1000, $2, $3, $4, '2026-10-12 10:00:00+00', '2026-10-12 10:00:40+00')`,
      [A, s.generators, s.upgrades, s.strategies],
    );
    for (const ate of ['2026-10-12 10:01:00+00', '2026-10-12 23:00:00+00']) {
      const [db] = await q<{ v: number }>(
        `select (public.idle_settle(s, $2::timestamptz)).valuation as v from public.idle_state s where user_id = $1`,
        [A, ate],
      );
      const ts = acumular(1000, taxa(catalogo, s), Date.parse('2026-10-12T10:00:00Z'), Date.parse(ate.replace(' ', 'T').replace('+00', 'Z')), Date.parse('2026-10-12T10:00:40Z'));
      expect(rel(db.v, ts)).toBeLessThan(1e-9);
    }
  });
});
```

- [ ] **Step 2: Rodar** — `npx vitest run test/idleParidade.test.ts` → PASS. Se `maxCompra` divergir em algum caso,
o erro está em uma das duas pontas de `while` (Task 1 Step 9 / Task 5 Step 3): as duas têm que ter os dois laços.

- [ ] **Step 3: Commit**

```bash
git add games/test/idleParidade.test.ts
git commit -m "Fellas Inc.: teste de paridade das fórmulas (TypeScript × banco)"
```

---

### Task 9: Números grandes em pt-BR

**Files:**
- Create: `games/idle/formatar.ts`
- Test: `games/idle/formatar.test.ts`

**Interfaces:**
- Produz: `formatarValor(n: number): string` ("R$ 12,3 mi"), `formatarTaxa(n: number): string` ("+R$ 1,23 mil/s").

- [ ] **Step 1: Teste**

```ts
import { describe, expect, it } from 'vitest';

import { formatarTaxa, formatarValor } from './formatar';

describe('formatarValor', () => {
  it.each([
    [0, 'R$ 0'], [9.99, 'R$ 9'], [999, 'R$ 999'], [1000, 'R$ 1 mil'], [1234, 'R$ 1,23 mil'], [12_345, 'R$ 12,3 mil'],
    [999_999, 'R$ 999 mil'], [3_400_000, 'R$ 3,4 mi'], [1.2e9, 'R$ 1,2 bi'], [7.1e12, 'R$ 7,1 tri'], [5e15, 'R$ 5 quatri'],
    [2.5e18, 'R$ 2,5 quinti'], [1e21, 'R$ 1 sexti'], [1e24, 'R$ 1 septi'], [1e27, 'R$ 1 octi'], [4.2e30, 'R$ 4,2 noni'],
    [1e33, 'R$ 1 deci'],
  ])('%s → %s', (n, s) => expect(formatarValor(n)).toBe(s));
  it('trunca, nunca arredonda pra cima (999.999 não vira "1.000 mil")', () => expect(formatarValor(999_999.9)).toBe('R$ 999 mil'));
});

describe('formatarTaxa', () => {
  it('pequena com uma casa; grande abreviada', () => {
    expect(formatarTaxa(0.5)).toBe('+R$ 0,5/s');
    expect(formatarTaxa(1234)).toBe('+R$ 1,23 mil/s');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run idle/formatar.test.ts` → FAIL.

- [ ] **Step 3: Escrever `games/idle/formatar.ts`**

```ts
// Números da Fellas Inc. em pt-BR, resumidos e sempre truncados (nunca mostram mais do que a pessoa tem).
const UNIDADES = ['mil', 'mi', 'bi', 'tri', 'quatri', 'quinti', 'sexti', 'septi', 'octi', 'noni', 'deci'] as const;

function tres(x: number): string {
  const casas = x >= 100 ? 0 : x >= 10 ? 1 : 2;
  const f = 10 ** casas;
  return (Math.floor(x * f) / f).toLocaleString('pt-BR', { maximumFractionDigits: casas });
}

function resumir(n: number): string {
  if (n < 1000) return String(Math.floor(n));
  let i = -1;
  let x = n;
  while (x >= 1000 && i < UNIDADES.length - 1) {
    x /= 1000;
    i++;
  }
  return `${tres(x)} ${UNIDADES[i]}`;
}

export const formatarValor = (n: number) => `R$ ${resumir(Math.max(0, n))}`;

export function formatarTaxa(n: number): string {
  if (n < 10) return `+R$ ${(Math.floor(n * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}/s`;
  return `+R$ ${resumir(n)}/s`;
}
```

- [ ] **Step 4: Rodar** — PASS. **Step 5: Commit**

```bash
git add games/idle/formatar.ts games/idle/formatar.test.ts
git commit -m "Fellas Inc.: números grandes resumidos em pt-BR"
```

---

### Task 10: Chamadas, formatos, erros e o `?mock`

**Files:**
- Modify: `games/shared/api.ts`, `games/shared/types.ts`, `games/shared/errors.ts`, `games/shared/errors.test.ts`
- Create: `games/dev/mockIdle.ts`

**Interfaces:**
- Produz em `types.ts`: `IdleState` (formato da Task 4), `IdleBoardRow = { userId: string; name: string; valuation:
  number; era: number; strategies: number[] }`.
- Produz em `api.ts`: `idleOpen(): Promise<IdleState>`, `idleStart()`, `idleBuy(kind: 'gerador' | 'melhoria', id:
  number, qty?: 0 | 1 | 10)`, `idlePickStrategy(era: number, opcao: number)`, `idleClaim(window: number)`,
  `idleBoard(): Promise<IdleBoardRow[]>`. `mockIdle.ts` exporta os mesmos nomes mais `hasSession`, `myId`.

- [ ] **Step 1: Teste dos erros novos (acrescentar em `games/shared/errors.test.ts`)**

```ts
describe('erros da Fellas Inc.', () => {
  it.each([
    ['idle_not_started', 'Abre o CNPJ primeiro'],
    ['idle_started', 'Sua empresa já tá aberta'],
    ['idle_strategy_pending', 'Escolhe a estratégia da era antes'],
    ['idle_cant_afford', 'Valuation não cobre essa compra'],
    ['idle_locked', 'Isso ainda não liberou'],
    ['idle_owned', 'Você já tem essa melhoria'],
    ['idle_strategy_set', 'Essa estratégia já foi escolhida'],
    ['idle_bad_choice', 'Essa opção não existe'],
    ['idle_opp_gone', 'Essa oportunidade já passou'],
    ['idle_opp_cap', 'Chega de oportunidade por hoje'],
  ])('%s', (code, text) => {
    const e = toGameError({ message: code, code: 'P0001' });
    expect(e.code).toBe(code);
    expect(e.message).toBe(text);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run shared/errors.test.ts` → FAIL (`unknown`).

- [ ] **Step 3: Em `games/shared/errors.ts`**: acrescentar os 10 códigos ao tipo `GameErrorCode` (antes de
`| 'unknown'`), os textos acima ao `ERROR_TEXT` e os códigos ao array `FROM_DB`. Nenhum é pedaço de outro.

- [ ] **Step 4: Rodar** — PASS.

- [ ] **Step 5: Em `games/shared/types.ts`, acrescentar**

```ts
// Fellas Inc. (0034): o estado que toda função do idle devolve
export type IdleState = {
  user_id: string; week_start: string; started: boolean; valuation: number; rate: number;
  generators: number[]; upgrades: number[]; strategies: number[]; era: number;
  boost_until: string | null; half_price: boolean; opp_claimed: number[]; opp_left: number; server_now: string;
};
export type IdleBoardRow = { userId: string; name: string; valuation: number; era: number; strategies: number[] };
```

- [ ] **Step 6: Em `games/shared/api.ts`, acrescentar** (o `import type` junto dos outros tipos)

```ts
export const idleOpen = () => rpc<IdleState>('idle_open');
export const idleStart = () => rpc<IdleState>('idle_start');
export const idleBuy = (kind: 'gerador' | 'melhoria', id: number, qty: 0 | 1 | 10 = 1) =>
  rpc<IdleState>('idle_buy', { p_kind: kind, p_id: id, p_qty: qty });
export const idlePickStrategy = (era: number, opcao: number) => rpc<IdleState>('idle_pick_strategy', { p_era: era, p_opcao: opcao });
export const idleClaim = (window: number) => rpc<IdleState>('idle_claim_opportunity', { p_window: window });

export async function idleBoard(): Promise<IdleBoardRow[]> {
  const rows = await rpc<{ user_id: string; valuation: number; era: number; strategies: number[] }[]>('idle_board');
  const quem = await fellas(rows.map((r) => r.user_id));
  return rows.map((r) => ({
    userId: r.user_id, valuation: r.valuation, era: r.era, strategies: r.strategies,
    name: quem.find((f) => f.id === r.user_id)?.name ?? 'Alguém',
  }));
}
```

- [ ] **Step 7: Criar `games/dev/mockIdle.ts`**

```ts
// Só no dev (?mock): a Fellas Inc. contra as migrações rodando no navegador (dev/mockDb.ts). Mesmos nomes e
// formatos de shared/api.ts. Os bots abrem a empresa para o placar ter gente. Nunca entra no build.
import type { IdleBoardRow, IdleState } from '../shared/types';
import { call, FRIENDS, ME } from './mockDb';

const bots = (async () => {
  for (const [id] of FRIENDS) await call('select public.idle_start() as v', [], id).catch(() => undefined);
})();

export const idleOpen = () => call<IdleState>('select public.idle_open() as v');
export const idleStart = () => call<IdleState>('select public.idle_start() as v');
export const idleBuy = (kind: 'gerador' | 'melhoria', id: number, qty: 0 | 1 | 10 = 1) =>
  call<IdleState>('select public.idle_buy($1, $2, $3) as v', [kind, id, qty]);
export const idlePickStrategy = (era: number, opcao: number) => call<IdleState>('select public.idle_pick_strategy($1, $2) as v', [era, opcao]);
export const idleClaim = (window: number) => call<IdleState>('select public.idle_claim_opportunity($1) as v', [window]);
export const hasSession = async () => true;
export const myId = async () => ME;

export async function idleBoard(): Promise<IdleBoardRow[]> {
  await bots;
  const rows = await call<{ user_id: string; valuation: number; era: number; strategies: number[] }[]>('select public.idle_board() as v');
  const names = await call<{ id: string; name: string }[]>(
    `select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', display_name)), '[]') as v from public.profiles`,
  );
  return rows.map((r) => ({ userId: r.user_id, valuation: r.valuation, era: r.era, strategies: r.strategies, name: names.find((n) => n.id === r.user_id)?.name ?? 'Alguém' }));
}

// console do dev: __rico(1e12) põe valuation na sua empresa para testar o resto do jogo
(window as unknown as { __rico: (v: number) => Promise<void> }).__rico = async (v) => {
  const { ready } = await import('./mockDb');
  const db = await ready;
  await db.query('update public.idle_state set valuation = $2 where user_id = $1', [ME, v]);
};
```

(`FRIENDS` em `mockDb.ts` é `[string, string, number][]`, o id vem primeiro.)

- [ ] **Step 8: Typecheck e testes de `games/`** — `npx tsc --noEmit && npx vitest run` (em `games/`) → sem erros, PASS.

- [ ] **Step 9: Commit**

```bash
git add games/shared/api.ts games/shared/types.ts games/shared/errors.ts games/shared/errors.test.ts games/dev/mockIdle.ts
git commit -m "Fellas Inc.: chamadas, formatos e erros em pt-BR; versão ?mock"
```

---

### Task 11: Arte que falta e cópia para `games/idle/assets/`

Esta task roda **fora do repositório**, em `C:/Users/juan/Documents/PROJETOSLLM/fellas-inc-esbocos`, com o mesmo
processo das cenas e sprites aprovados (agentes artistas, `cena-util.js`, contorno preto de 1px, linha única entre
objetos colados, paleta `P`). Leia `BRIEF-CENAS.md` e `BRIEF-SPRITES.md` lá antes de começar.

**Files (fora do repo):** `geradores-extra.js`, `cena6.js`, `oportunidades.js`, `gerais.js` e o que eles gravam.
**Files (no repo):** `games/idle/assets/cenas/*.png`, `assets/geradores/*.png`, `assets/oportunidades/*.png`,
`assets/gerais/*.png`.

- [ ] **Step 1: 25 geradores novos** (32x32, 4 quadros a 20 cs, `salvarSprite('gerador-NN', ...)` com NN de dois
dígitos), para os ids 2–6, 8–12, 14–18, 20–24 e 26–30, com os nomes de `games/idle/nomes.ts`. Cada um com 3
rodadas de revisão em `sprites/gerador-NN-8x.png` (tema escuro e claro). Aceite: contorno preto fechado, nada
semitransparente, 1px de margem, animação visível em 2x.

- [ ] **Step 2: Cena 6 "em órbita"** (160x96, 8 quadros a 15 cs, `salvarCena('cena-6', ...)`): a torre da Fellas virou
foguete subindo, ou a empresa numa estação espacial com a Terra embaixo; o fundador de moletom preto e fone roxo, o
gato e o mascote amarelo escondidos; estrelas e propulsão animadas. 3 rodadas de revisão.

- [ ] **Step 3: Oportunidades** (24x24, 4 quadros a 15 cs, `salvarSprite('oportunidade-K', ...)`): K=0 investidor de
terno com maleta de dinheiro andando; K=1 celular com um post explodindo de curtidas; K=2 cliente gringo com chapéu e
mala. Precisam ler bem passando por cima da cena (contorno preto ajuda).

- [ ] **Step 4: Ícones das 20 gerais** (16x16, `salvarSprite('geral-1001' … 'geral-1020', ...)`), na ordem de `GERAIS`
em `nomes.ts` (café coado, wi-fi, cadeira gamer, fone, quadro branco, pizza, extensão, ar-condicionado, plano de saúde,
bolo de aniversário, chope, neon, escorregador, controle de videogame, chapéu de chef, apresentação de slides, jatinho,
iate, coroa de dono, troféu de lenda).

- [ ] **Step 5: Copiar para o repositório** (a partir da raiz do repo)

```bash
E=../fellas-inc-esbocos/png
D=games/idle/assets
mkdir -p $D/cenas $D/geradores $D/oportunidades $D/gerais
cp $E/cena-1-antes-animada-tira.png $D/cenas/cena-0-antes.png
cp $E/cena-1-abrindo-animada-tira.png $D/cenas/cena-0-abrindo.png
cp $E/cena-1-outline-animada-tira.png $D/cenas/cena-1.png
for n in 2 3 4 5 6; do cp $E/cena-$n-animada-tira.png $D/cenas/cena-$n.png; done
# os 5 que já existiam (gerador-1 a gerador-5) são os geradores 1, 7, 13, 19 e 25
cp $E/gerador-1-animada-tira.png $D/geradores/gerador-01.png
cp $E/gerador-2-animada-tira.png $D/geradores/gerador-07.png
cp $E/gerador-3-animada-tira.png $D/geradores/gerador-13.png
cp $E/gerador-4-animada-tira.png $D/geradores/gerador-19.png
cp $E/gerador-5-animada-tira.png $D/geradores/gerador-25.png
for n in 02 03 04 05 06 08 09 10 11 12 14 15 16 17 18 20 21 22 23 24 26 27 28 29 30; do
  cp $E/gerador-$n-animada-tira.png $D/geradores/gerador-$n.png
done
for k in 0 1 2; do cp $E/oportunidade-$k-animada-tira.png $D/oportunidades/oportunidade-$k.png; done
for n in $(seq 1001 1020); do cp $E/geral-$n.png $D/gerais/geral-$n.png; done
ls $D/cenas | wc -l; ls $D/geradores | wc -l; ls $D/oportunidades | wc -l; ls $D/gerais | wc -l
```

Expected: `8`, `30`, `3`, `20`. **Nada** de `lugares/` é copiado (privacidade: propriedades são da entrega 3 e ficam
só no banco).

- [ ] **Step 6: Commit**

```bash
git add games/idle/assets
git commit -m "Fellas Inc.: arte das cenas, 30 geradores, oportunidades e ícones das melhorias gerais"
```

---

### Task 12: Palco das cenas e ativos

**Files:**
- Create: `games/idle/palco.ts`, `games/idle/ativos.ts`
- Test: `games/idle/palco.test.ts`

**Interfaces:**
- Produz: `type NomeCena = 'cena-0-antes' | 'cena-0-abrindo' | 'cena-1' | … | 'cena-6'`, `CENAS: Record<NomeCena,
  { quadros: number; atrasoMs: number }>`, `quadroEm(nome, decorridoMs, umaVez): number | null` (null = acabou),
  `criarPalco(canvas, urls): { tocar(nome, opcoes?: { umaVez?: boolean; aoTerminar?: () => void }): void; parar(): void }`.
- `ativos.ts`: `ativos.cenas: Record<NomeCena, string>`, `ativos.gerador(id): string`, `ativos.oportunidade(k): string`,
  `ativos.geral(id): string | null`.

- [ ] **Step 1: Teste `games/idle/palco.test.ts`**

```ts
import { describe, expect, it } from 'vitest';

import { CENAS, quadroEm } from './palco';

describe('palco', () => {
  it('todas as cenas têm quadros e ritmo', () => {
    expect(CENAS['cena-0-abrindo']).toEqual({ quadros: 12, atrasoMs: 180 });
    expect(CENAS['cena-5'].quadros).toBe(12);
  });
  it('loop: quadro = tempo / atraso, dando a volta', () => {
    expect(quadroEm('cena-1', 0, false)).toBe(0);
    expect(quadroEm('cena-1', 149, false)).toBe(0);
    expect(quadroEm('cena-1', 150, false)).toBe(1);
    expect(quadroEm('cena-1', 150 * 8, false)).toBe(0);
  });
  it('uma vez: para no fim (null)', () => {
    expect(quadroEm('cena-0-abrindo', 180 * 11, true)).toBe(11);
    expect(quadroEm('cena-0-abrindo', 180 * 12, true)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Escrever `games/idle/palco.ts`**

```ts
// Toca as tiras de cena (quadros de 160x96 lado a lado) num canvas de 160x96; o CSS amplia por um inteiro.
export type NomeCena = 'cena-0-antes' | 'cena-0-abrindo' | 'cena-1' | 'cena-2' | 'cena-3' | 'cena-4' | 'cena-5' | 'cena-6';

export const CENAS: Record<NomeCena, { quadros: number; atrasoMs: number }> = {
  'cena-0-antes': { quadros: 8, atrasoMs: 150 },
  'cena-0-abrindo': { quadros: 12, atrasoMs: 180 },
  'cena-1': { quadros: 8, atrasoMs: 150 },
  'cena-2': { quadros: 8, atrasoMs: 150 },
  'cena-3': { quadros: 8, atrasoMs: 150 },
  'cena-4': { quadros: 8, atrasoMs: 150 },
  'cena-5': { quadros: 12, atrasoMs: 150 },
  'cena-6': { quadros: 8, atrasoMs: 150 },
};
export const LARGURA = 160;
export const ALTURA = 96;

export function quadroEm(nome: NomeCena, decorridoMs: number, umaVez: boolean): number | null {
  const { quadros, atrasoMs } = CENAS[nome];
  const q = Math.floor(decorridoMs / atrasoMs);
  if (umaVez) return q < quadros ? q : null;
  return q % quadros;
}

export function criarPalco(canvas: HTMLCanvasElement, urls: Record<NomeCena, string>) {
  canvas.width = LARGURA;
  canvas.height = ALTURA;
  const g = canvas.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const imagens = new Map<NomeCena, HTMLImageElement>();
  const imagem = (nome: NomeCena) => {
    let img = imagens.get(nome);
    if (!img) {
      img = new Image();
      img.src = urls[nome];
      imagens.set(nome, img);
    }
    return img;
  };
  let atual: { nome: NomeCena; inicio: number; umaVez: boolean; aoTerminar?: () => void } | null = null;
  let raf = 0;

  const quadro = (agora: number) => {
    raf = 0;
    if (!atual) return;
    const q = quadroEm(atual.nome, agora - atual.inicio, atual.umaVez);
    if (q === null) {
      const fim = atual.aoTerminar;
      atual = null;
      fim?.();
      return;
    }
    const img = imagem(atual.nome);
    if (img.complete && img.naturalWidth) g.drawImage(img, q * LARGURA, 0, LARGURA, ALTURA, 0, 0, LARGURA, ALTURA);
    if (!document.hidden) raf = requestAnimationFrame(quadro);
  };
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && atual && !raf) raf = requestAnimationFrame(quadro);
  });

  return {
    tocar(nome: NomeCena, opcoes: { umaVez?: boolean; aoTerminar?: () => void } = {}) {
      if (atual?.nome === nome && !opcoes.umaVez) return; // já está tocando: não reinicia o loop
      atual = { nome, inicio: performance.now(), umaVez: !!opcoes.umaVez, aoTerminar: opcoes.aoTerminar };
      imagem(nome);
      if (!raf) raf = requestAnimationFrame(quadro);
    },
    parar() {
      atual = null;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}
```

- [ ] **Step 4: Escrever `games/idle/ativos.ts`**

```ts
// URLs das imagens da Fellas Inc. (Vite troca pelos arquivos com hash no build).
import type { NomeCena } from './palco';

const pegar = (lista: Record<string, string>) =>
  Object.fromEntries(Object.entries(lista).map(([arq, url]) => [arq.split('/').pop()!.replace('.png', ''), url]));

const cenas = pegar(import.meta.glob('./assets/cenas/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>);
const geradores = pegar(import.meta.glob('./assets/geradores/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>);
const oportunidades = pegar(import.meta.glob('./assets/oportunidades/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>);
const gerais = pegar(import.meta.glob('./assets/gerais/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>);

export const ativos = {
  cenas: cenas as Record<NomeCena, string>,
  gerador: (id: number) => geradores[`gerador-${String(id).padStart(2, '0')}`],
  oportunidade: (k: 0 | 1 | 2) => oportunidades[`oportunidade-${k}`],
  geral: (id: number): string | null => gerais[`geral-${id}`] ?? null,
};
```

- [ ] **Step 5: Rodar** — `npx vitest run idle/palco.test.ts` → PASS. **Step 6: Commit**

```bash
git add games/idle/palco.ts games/idle/palco.test.ts games/idle/ativos.ts
git commit -m "Fellas Inc.: palco que toca as tiras de cena e o mapa dos ativos"
```

---

### Task 13: Estado da tela (âncora no relógio do banco, fase, cena)

**Files:**
- Create: `games/idle/store.ts`
- Test: `games/idle/store.test.ts`

**Interfaces:**
- Consome: `IdleState` (Task 10), `acumular`, `estrategiasAtivas` (Task 1), `catalogo`, `NomeCena`.
- Produz: `type Fase = 'carregando' | 'sem_sessao' | 'antes' | 'abrindo' | 'jogando'`, `type Ancora = { estado:
  IdleState; clienteMs: number; servidorMs: number }`, `ancorar(estado, clienteMs)`, `agoraServidor(a, clienteMs)`,
  `valuationAgora(a, clienteMs)`, `faseDoEstado(estado, faseAtual)`, `cenaDoEstado(estado, fase): NomeCena`,
  `estrategiaPendente(estado): number | null`, `segundosOportunidade(estado): number`.

- [ ] **Step 1: Teste `games/idle/store.test.ts`**

```ts
import { describe, expect, it } from 'vitest';

import type { IdleState } from '../shared/types';
import { agoraServidor, ancorar, cenaDoEstado, estrategiaPendente, faseDoEstado, segundosOportunidade, valuationAgora } from './store';

const base = (x: Partial<IdleState> = {}): IdleState => ({
  user_id: 'u', week_start: '2026-10-12', started: true, valuation: 100, rate: 2, generators: [1, ...Array(29).fill(0)],
  upgrades: [], strategies: [-1, -1, -1, -1], era: 1, boost_until: null, half_price: false, opp_claimed: [], opp_left: 10,
  server_now: '2026-10-12T12:00:00.000Z', ...x,
});

describe('âncora no relógio do banco', () => {
  it('relógio do celular 1h adiantado não muda o valor', () => {
    const cliente = Date.parse('2026-10-12T13:00:00Z'); // celular errado
    const a = ancorar(base(), cliente);
    expect(agoraServidor(a, cliente + 10_000)).toBe(Date.parse('2026-10-12T12:00:10Z'));
    expect(valuationAgora(a, cliente + 10_000)).toBeCloseTo(120, 10);
  });
  it('bônus ×5 conta só até boost_until', () => {
    const a = ancorar(base({ boost_until: '2026-10-12T12:00:05.000Z' }), 0);
    expect(valuationAgora(a, 10_000)).toBeCloseTo(100 + 2 * 10 + 2 * 4 * 5, 10);
  });
});

describe('fase e cena', () => {
  it('sem empresa aberta: antes; semana virou com a página aberta: volta pro antes', () => {
    expect(faseDoEstado(base({ started: false }), 'jogando')).toBe('antes');
    expect(faseDoEstado(base(), 'antes')).toBe('jogando');
    expect(faseDoEstado(base(), 'abrindo')).toBe('abrindo');
  });
  it('cena da era; foguete comprado = cena 6; antes = quarto apagado', () => {
    expect(cenaDoEstado(base({ era: 3 }), 'jogando')).toBe('cena-3');
    const g = Array(30).fill(1);
    expect(cenaDoEstado(base({ era: 5, generators: g }), 'jogando')).toBe('cena-6');
    expect(cenaDoEstado(base({ started: false }), 'antes')).toBe('cena-0-antes');
  });
  it('estratégia pendente = era ≥ 2 sem escolha', () => {
    expect(estrategiaPendente(base({ era: 1 }))).toBeNull();
    expect(estrategiaPendente(base({ era: 2 }))).toBe(2);
    expect(estrategiaPendente(base({ era: 2, strategies: [0, -1, -1, -1] }))).toBeNull();
  });
  it('Rolê eterno: oportunidade fica 30 s', () => {
    expect(segundosOportunidade(base())).toBe(10);
    expect(segundosOportunidade(base({ strategies: [0, 0, 0, 2] }))).toBe(30);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Escrever `games/idle/store.ts`**

```ts
// Estado da tela da Fellas Inc.: tudo que o banco devolve fica ancorado no relógio DELE (server_now), não no do
// celular. O número anima com a mesma conta do banco (economia.ts acumular).
import type { IdleState } from '../shared/types';
import { catalogo } from './catalogo';
import { acumular, estrategiasAtivas } from './economia';
import type { NomeCena } from './palco';

export type Fase = 'carregando' | 'sem_sessao' | 'antes' | 'abrindo' | 'jogando';
export type Ancora = { estado: IdleState; clienteMs: number; servidorMs: number };

export const ancorar = (estado: IdleState, clienteMs: number): Ancora => ({ estado, clienteMs, servidorMs: Date.parse(estado.server_now) });
export const agoraServidor = (a: Ancora, clienteMs: number) => a.servidorMs + (clienteMs - a.clienteMs);

export function valuationAgora(a: Ancora, clienteMs: number): number {
  const boost = a.estado.boost_until ? Date.parse(a.estado.boost_until) : null;
  return acumular(a.estado.valuation, a.estado.rate, a.servidorMs, agoraServidor(a, clienteMs), boost);
}

export function faseDoEstado(estado: IdleState, atual: Fase): Fase {
  if (!estado.started) return 'antes';
  return atual === 'abrindo' ? 'abrindo' : 'jogando';
}

export function cenaDoEstado(estado: IdleState, fase: Fase): NomeCena {
  if (fase === 'antes' || !estado.started) return 'cena-0-antes';
  if (estado.generators[29] > 0) return 'cena-6';
  return `cena-${Math.min(Math.max(estado.era, 1), 5)}` as NomeCena;
}

export function estrategiaPendente(estado: IdleState): number | null {
  return estado.started && estado.era >= 2 && estado.strategies[estado.era - 2] < 0 ? estado.era : null;
}

export function segundosOportunidade(estado: IdleState): number {
  return Math.max(10, ...estrategiasAtivas(catalogo, estado).map((e) => e.oppSegundos));
}
```

- [ ] **Step 4: Rodar** — PASS. **Step 5: Commit**

```bash
git add games/idle/store.ts games/idle/store.test.ts
git commit -m "Fellas Inc.: estado da tela ancorado no relógio do banco, fase e cena"
```

---

### Task 14: A página (tela, CSS, main, entrada do Vite)

**Files:**
- Create: `games/idle/index.html`, `games/idle/idle.css`, `games/idle/tela.ts`, `games/idle/main.ts`
- Test: `games/idle/tela.test.ts`
- Modify: `games/vite.config.ts`

**Interfaces:**
- Consome: tudo das Tasks 1, 6, 9, 10, 12 e 13; `el`, `button` de `games/shared/hud/hud.ts`.
- Produz: `criarTela(root, acoes): Tela` com `type Aba = 'geradores' | 'melhorias' | 'placar'`, `type Modelo = { fase;
  estado: IdleState | null; aba; placar: IdleBoardRow[] | null; aviso: string | null; ocupado: boolean; pendentes:
  number[]; aoVivo: number | null; caixaAberta: boolean }`, `type Acoes = { abrirCnpj(); comprar(tipo, id, qtd);
  escolher(era, opcao); pegar(janela); trocarAba(aba); caixa(aberta); tentarDeNovo() }`,
  `type Tela = { canvas; renderizar(m: Modelo); atualizarValor(valor: number); fatal(texto: string) }`.

- [ ] **Step 1: Teste `games/idle/tela.test.ts`**

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IdleState } from '../shared/types';
import { criarTela, type Acoes, type Modelo } from './tela';

const estado = (x: Partial<IdleState> = {}): IdleState => ({
  user_id: 'u', week_start: '2026-10-12', started: true, valuation: 0, rate: 0.5, generators: [1, ...Array(29).fill(0)],
  upgrades: [], strategies: [-1, -1, -1, -1], era: 1, boost_until: null, half_price: false, opp_claimed: [], opp_left: 10,
  server_now: '2026-10-12T12:00:00.000Z', ...x,
});
const modelo = (x: Partial<Modelo> = {}): Modelo => ({
  fase: 'jogando', estado: estado(), aba: 'geradores', placar: null, aviso: null, ocupado: false, pendentes: [], aoVivo: null, caixaAberta: false, ...x,
});

let acoes: { [K in keyof Acoes]: ReturnType<typeof vi.fn> };
let root: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  root = document.getElementById('app')!;
  acoes = { abrirCnpj: vi.fn(), comprar: vi.fn(), escolher: vi.fn(), pegar: vi.fn(), trocarAba: vi.fn(), caixa: vi.fn(), tentarDeNovo: vi.fn() };
});
const porTexto = (texto: string) => [...root.querySelectorAll('button')].find((b) => b.textContent === texto)!;

describe('tela da Fellas Inc.', () => {
  it('antes: só o Abrir CNPJ', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ fase: 'antes', estado: estado({ started: false }) }));
    porTexto('Abrir CNPJ').click();
    expect(acoes.abrirCnpj).toHaveBeenCalled();
    expect(root.querySelector('.lista-geradores')!.hasAttribute('hidden')).toBe(true);
  });
  it('lista o gerador 1 e o próximo trancado; botão libera quando o valor chega no preço', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo());
    const linhas = root.querySelectorAll('.gerador');
    expect(linhas).toHaveLength(3); // 1 (tem), 2 (liberado: tem o 1), 3 (trancado)
    expect(linhas[2].textContent).toContain('Compra 1 "Post motivacional no LinkedIn" pra liberar');
    const comprar1 = linhas[0].querySelector<HTMLButtonElement>('button[data-qtd="1"]')!;
    tela.atualizarValor(17);
    expect(comprar1.disabled).toBe(true);
    tela.atualizarValor(17.25);
    expect(comprar1.disabled).toBe(false);
    comprar1.click();
    expect(acoes.comprar).toHaveBeenCalledWith('gerador', 1, 1);
  });
  it('era nova sem estratégia: cartões, os desligados avisam o porquê', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ estado: estado({ era: 2, generators: [1, 1, 1, 1, 1, 1, 1, ...Array(23).fill(0)] }) }));
    const modal = root.querySelector('.modal-estrategia')!;
    expect(modal.hasAttribute('hidden')).toBe(false);
    expect(modal.textContent).toContain('Chega com Contratar');
    [...modal.querySelectorAll('button')].find((b) => b.textContent === 'Escolher' && !b.disabled)!.click();
    expect(acoes.escolher).toHaveBeenCalledWith(2, 0);
  });
  it('aviso aparece; caixinha mostra quantas tem', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ aviso: 'Valuation não cobre essa compra', pendentes: [3, 2] }));
    expect(root.querySelector('.notice')!.textContent).toContain('Valuation não cobre essa compra');
    expect(root.querySelector('.caixinha')!.textContent).toBe('Oportunidades (2)');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run idle/tela.test.ts` → FAIL (módulo não existe).

- [ ] **Step 3: Escrever `games/idle/tela.ts`**

```ts
// Tela da Fellas Inc. em DOM puro (sem framework), no padrão do Blackjack: monta uma vez; `renderizar` a cada
// mudança de estado; `atualizarValor` ~10x por segundo (só o número e quais botões estão liberados).
// Texto de usuário sempre por textContent.
import { button, el } from '../shared/hud/hud';
import type { IdleBoardRow, IdleState } from '../shared/types';
import { ativos } from './ativos';
import { catalogo, type Melhoria } from './catalogo';
import { custoMult, liberada, maxCompra, podeComprarGerador, preco, taxaPorUnidade } from './economia';
import { formatarTaxa, formatarValor } from './formatar';
import { ERAS } from './nomes';
import { TEXTO_TIPO, tipo as tipoOportunidade } from './oportunidades';
import { estrategiaPendente, segundosOportunidade, type Fase } from './store';

export type Aba = 'geradores' | 'melhorias' | 'placar';
export type Modelo = {
  fase: Fase; estado: IdleState | null; aba: Aba; placar: IdleBoardRow[] | null; aviso: string | null;
  ocupado: boolean; pendentes: number[]; aoVivo: number | null; caixaAberta: boolean;
};
export type Acoes = {
  abrirCnpj(): void; comprar(tipo: 'gerador' | 'melhoria', id: number, qtd: 0 | 1 | 10): void; escolher(era: number, opcao: number): void;
  pegar(janela: number): void; trocarAba(aba: Aba): void; caixa(aberta: boolean): void; tentarDeNovo(): void;
};
export type Tela = { canvas: HTMLCanvasElement; renderizar(m: Modelo): void; atualizarValor(valor: number): void; fatal(texto: string): void };

const mostrar = (n: HTMLElement, sim: boolean) => (sim ? n.removeAttribute('hidden') : n.setAttribute('hidden', ''));
const NIVEL = ['bronze', 'prata', 'ouro', 'roxo', 'diamante'];

export function criarTela(root: HTMLElement, a: Acoes): Tela {
  const app = el('div', 'app idle');
  const topo = el('header', 'top');
  const voltar = el('a', undefined, '← Voltar');
  voltar.href = '/games';
  const caixinha = button('Oportunidades (0)', 'caixinha', () => a.caixa(true));
  topo.append(voltar, el('span', undefined, 'Fellas Inc.'), caixinha);

  const palco = el('div', 'palco');
  const canvas = el('canvas', 'cena');
  const vivo = button('', 'vivo', () => undefined);
  palco.append(canvas, vivo);

  const placa = el('div', 'valor');
  const numero = el('div', 'numero', 'R$ 0');
  const taxaTxt = el('div', 'taxa', '');
  const bonus = el('div', 'bonus', '');
  placa.append(numero, taxaTxt, bonus);

  const abrir = el('div', 'abrir');
  abrir.append(el('p', undefined, '3h06. Bora fundar uma empresa?'), button('Abrir CNPJ', 'btn main', a.abrirCnpj));

  const abas = el('nav', 'abas');
  const botoesAba: Record<Aba, HTMLButtonElement> = {
    geradores: button('Geradores', 'aba', () => a.trocarAba('geradores')),
    melhorias: button('Melhorias', 'aba', () => a.trocarAba('melhorias')),
    placar: button('Placar', 'aba', () => a.trocarAba('placar')),
  };
  abas.append(botoesAba.geradores, botoesAba.melhorias, botoesAba.placar);
  const listaG = el('div', 'lista lista-geradores');
  const listaM = el('div', 'lista lista-melhorias');
  const listaP = el('ol', 'lista lista-placar');
  const painel = el('main', 'painel');
  painel.append(abrir, abas, listaG, listaM, listaP);

  const notice = el('div', 'notice');
  notice.setAttribute('role', 'status');
  const noticeTxt = el('span');
  notice.append(noticeTxt, button('Tentar de novo', '', a.tentarDeNovo));
  const overlay = el('div', 'overlay');
  const overlayTxt = el('p');
  const entrar = el('a', 'btn main', 'Entrar');
  entrar.href = '/';
  overlay.append(overlayTxt, entrar);

  const modalE = el('div', 'modal modal-estrategia');
  modalE.setAttribute('role', 'dialog');
  const modalC = el('div', 'modal modal-caixa');
  modalC.setAttribute('role', 'dialog');

  app.append(topo, palco, placa, painel, notice, overlay, modalE, modalC);
  root.append(app);

  // botões que dependem do valor (atualizados em atualizarValor)
  let precos: { botao: HTMLButtonElement; preco: number; maximo?: { custo: number; n: number; cm: number } }[] = [];

  function linhaGerador(s: IdleState, gid: number) {
    const g = catalogo.geradores[gid - 1];
    const n = s.generators[gid - 1];
    const linha = el('div', 'gerador');
    const sprite = el('div', 'sprite');
    sprite.style.backgroundImage = `url(${ativos.gerador(gid)})`;
    const meio = el('div', 'meio');
    meio.append(el('strong', undefined, g.nome), el('span', 'sub', `×${n} · ${formatarTaxa(taxaPorUnidade(catalogo, s, gid))} cada`));
    const cm = custoMult(catalogo, s);
    const botoes = el('div', 'compra');
    const um = button(formatarValor(preco(g.custo, n, 1, cm) * (s.half_price ? 0.5 : 1)), 'btn', () => a.comprar('gerador', gid, 1));
    um.dataset.qtd = '1';
    const dez = button('10', 'btn', () => a.comprar('gerador', gid, 10));
    dez.dataset.qtd = '10';
    const max = button('Máx', 'btn', () => a.comprar('gerador', gid, 0));
    max.dataset.qtd = '0';
    precos.push(
      { botao: um, preco: preco(g.custo, n, 1, cm) * (s.half_price ? 0.5 : 1) },
      { botao: dez, preco: preco(g.custo, n, 10, cm) },
      { botao: max, preco: preco(g.custo, n, 1, cm), maximo: { custo: g.custo, n, cm } },
    );
    botoes.append(um, dez, max);
    linha.append(sprite, meio, botoes);
    return linha;
  }

  function linhaTrancada(gid: number) {
    const linha = el('div', 'gerador trancado');
    linha.append(el('div', 'sprite'), el('div', 'meio', `Compra 1 "${catalogo.geradores[gid - 2].nome}" pra liberar`));
    return linha;
  }

  function iconeMelhoria(m: Melhoria) {
    const box = el('div', 'icone');
    if (m.tipo === 'gerador') {
      box.classList.add(NIVEL[m.nivel - 1]);
      box.style.backgroundImage = `url(${ativos.gerador(m.gerador)})`;
    } else if (m.tipo === 'geral') {
      const url = ativos.geral(m.id);
      if (url) box.style.backgroundImage = `url(${url})`;
      box.classList.add('geral');
    } else {
      box.classList.add('sinergia');
      for (const id of [m.fonte, m.alvo]) {
        const mini = el('span', 'mini');
        mini.style.backgroundImage = `url(${ativos.gerador(id)})`;
        box.append(mini);
      }
    }
    return box;
  }

  function renderizar(m: Modelo) {
    const s = m.estado;
    const jogando = m.fase === 'jogando' || m.fase === 'abrindo';
    precos = [];
    mostrar(abrir, m.fase === 'antes');
    mostrar(abas, jogando);
    mostrar(placa, jogando);
    for (const k of Object.keys(botoesAba) as Aba[]) botoesAba[k].classList.toggle('ativa', m.aba === k);
    mostrar(listaG, jogando && m.aba === 'geradores');
    mostrar(listaM, jogando && m.aba === 'melhorias');
    mostrar(listaP, jogando && m.aba === 'placar');
    caixinha.textContent = `Oportunidades (${m.pendentes.length})`;
    mostrar(caixinha, jogando);

    listaG.replaceChildren();
    listaM.replaceChildren();
    if (s && jogando) {
      taxaTxt.textContent = formatarTaxa(s.rate);
      const agoraBoost = s.boost_until && Date.parse(s.boost_until) > Date.parse(s.server_now);
      bonus.textContent = agoraBoost ? 'Produção ×5 por alguns segundos' : s.half_price ? 'Próxima compra pela metade' : '';
      for (let gid = 1; gid <= 30; gid++) {
        if (podeComprarGerador(s, gid)) listaG.append(linhaGerador(s, gid));
        else {
          listaG.append(linhaTrancada(gid));
          break;
        }
      }
      const cm = custoMult(catalogo, s);
      const disponiveis = catalogo.melhorias
        .filter((x) => !s.upgrades.includes(x.id) && liberada(catalogo, x, s))
        .sort((x, y) => x.preco - y.preco);
      if (!disponiveis.length) listaM.append(el('p', 'vazio', 'Nenhuma melhoria liberada agora. Compra mais geradores.'));
      for (const x of disponiveis) {
        const item = el('div', 'melhoria');
        const meio = el('div', 'meio');
        meio.append(el('strong', undefined, x.nome), el('span', 'sub', x.frase));
        const p = x.preco * cm * (s.half_price ? 0.5 : 1);
        const comprar = button(formatarValor(p), 'btn', () => a.comprar('melhoria', x.id, 1));
        precos.push({ botao: comprar, preco: p });
        item.append(iconeMelhoria(x), meio, comprar);
        listaM.append(item);
      }
    }

    listaP.replaceChildren();
    if (m.placar) {
      if (!m.placar.length) listaP.append(el('li', 'vazio', 'Ninguém abriu a empresa ainda essa semana.'));
      m.placar.forEach((r, i) => {
        const li = el('li', r.userId === s?.user_id ? 'eu' : undefined);
        const est = r.strategies
          .map((o, k) => catalogo.estrategias.find((e) => e.era === k + 2 && e.opcao === o)?.nome)
          .filter(Boolean)
          .join(' · ');
        li.append(el('span', 'pos', `${i + 1}º`), el('span', 'nome', r.name), el('span', 'sub', `${ERAS[r.era - 1]}${est ? ` · ${est}` : ''}`), el('span', 'v', formatarValor(r.valuation)));
        listaP.append(li);
      });
    }

    // oportunidade passando na cena
    mostrar(vivo, !!s && m.aoVivo !== null && s.opp_left > 0);
    if (s && m.aoVivo !== null) {
      const w = m.aoVivo;
      vivo.style.backgroundImage = `url(${ativos.oportunidade(tipoOportunidade(s.user_id, w))})`;
      vivo.style.animationDuration = `${segundosOportunidade(s)}s`;
      vivo.setAttribute('aria-label', `Pegar oportunidade: ${TEXTO_TIPO[tipoOportunidade(s.user_id, w)]}`);
      vivo.onclick = () => a.pegar(w);
    }

    // estratégia
    const era = s ? estrategiaPendente(s) : null;
    modalE.replaceChildren();
    mostrar(modalE, jogando && era !== null);
    if (era !== null) {
      modalE.append(el('h2', undefined, `Era ${era}: ${ERAS[era - 1]}`), el('p', undefined, 'Escolhe a estratégia da empresa até o fim da semana. Não tem volta.'));
      for (const e of catalogo.estrategias.filter((x) => x.era === era)) {
        const card = el('div', e.ativa ? 'cartao' : 'cartao off');
        card.append(el('strong', undefined, e.nome), el('p', undefined, e.frase));
        if (!e.ativa) card.append(el('p', 'sub', e.requer === 'contratos' ? 'Chega com Contratar' : 'Chega com o Mapa do rolê'));
        const b = button('Escolher', 'btn main', () => a.escolher(era, e.opcao));
        b.disabled = !e.ativa || m.ocupado;
        card.append(b);
        modalE.append(card);
      }
    }

    // caixinha
    modalC.replaceChildren();
    mostrar(modalC, m.caixaAberta && jogando);
    if (s && m.caixaAberta) {
      modalC.append(el('h2', undefined, 'Oportunidades guardadas'), el('p', 'sub', `Hoje ainda dá pra pegar ${s.opp_left}.`));
      if (!m.pendentes.length) modalC.append(el('p', 'vazio', 'Nada guardado agora. Volta mais tarde.'));
      for (const w of m.pendentes) {
        const item = el('div', 'cartao');
        item.append(el('strong', undefined, TEXTO_TIPO[tipoOportunidade(s.user_id, w)]));
        const b = button('Pegar', 'btn main', () => a.pegar(w));
        b.disabled = m.ocupado || s.opp_left <= 0;
        item.append(b);
        modalC.append(item);
      }
      modalC.append(button('Fechar', 'btn', () => a.caixa(false)));
    }

    noticeTxt.textContent = m.aviso ?? '';
    mostrar(notice, !!m.aviso);
    overlayTxt.textContent = 'Entra no fellas pra jogar';
    mostrar(entrar, true);
    mostrar(overlay, m.fase === 'sem_sessao');
  }

  function atualizarValor(valor: number) {
    numero.textContent = formatarValor(valor);
    for (const p of precos) {
      p.botao.disabled = p.preco > valor;
      if (p.maximo) {
        const k = maxCompra(p.maximo.custo, p.maximo.n, valor, p.maximo.cm);
        p.botao.textContent = k > 1 ? `Máx (${k})` : 'Máx';
      }
    }
  }

  function fatal(texto: string) {
    overlayTxt.textContent = texto;
    mostrar(entrar, false);
    mostrar(overlay, true);
    mostrar(painel, false);
  }

  return { canvas, renderizar, atualizarValor, fatal };
}
```

- [ ] **Step 4: Rodar** — `npx vitest run idle/tela.test.ts` → PASS.

- [ ] **Step 5: Escrever `games/idle/idle.css`**

```css
/* Fellas Inc.: em cima do hud.css. Pixel art sempre ampliada por inteiro e sem borrar. */
.idle { background: #121212; grid-template-rows: auto auto auto 1fr; }
.idle .palco { position: relative; display: flex; justify-content: center; padding: 8px; }
.idle .cena { width: 320px; height: 192px; image-rendering: pixelated; border-radius: 8px; }
@media (min-width: 900px) { .idle .cena { width: 640px; height: 384px; } }
.idle .vivo {
  position: absolute; top: 40%; left: 0; width: 48px; height: 48px; border: 0; padding: 0; cursor: pointer;
  background: transparent no-repeat 0 0 / 192px 48px; image-rendering: pixelated;
  animation: atravessar linear forwards, quadros4 0.6s steps(4) infinite;
}
@keyframes atravessar { from { transform: translateX(0); } to { transform: translateX(calc(100vw - 48px)); } }
@keyframes quadros4 { from { background-position-x: 0; } to { background-position-x: -192px; } }
.idle .valor { text-align: center; padding: 4px 16px 8px; }
.idle .numero { font: 800 32px var(--font); color: var(--paper); font-variant-numeric: tabular-nums; }
.idle .taxa { color: var(--mint); font-weight: 600; }
.idle .bonus { color: var(--gold); min-height: 1.2em; }
.idle .abrir { display: grid; justify-items: center; gap: 12px; padding: 24px; color: var(--paper); }
.idle .abas { display: flex; gap: 8px; padding: 0 16px; }
.idle .aba { flex: 1; min-height: 44px; border-radius: 8px; border: 1px solid #34323F; background: #1B1A22; color: var(--paper); font: 700 15px var(--font); }
.idle .aba.ativa { background: #5B3FD9; border-color: #B8A2FF; }
.idle .painel { overflow: auto; padding-bottom: 24px; }
.idle .lista { display: grid; gap: 8px; padding: 12px 16px; margin: 0; list-style: none; }
.idle .gerador, .idle .melhoria { display: flex; align-items: center; gap: 12px; padding: 8px; border-radius: 8px; background: #1B1A22; color: var(--paper); }
.idle .gerador.trancado { opacity: 0.5; }
.idle .sprite { flex: none; width: 64px; height: 64px; background: no-repeat 0 0 / 256px 64px; image-rendering: pixelated; animation: quadros64 0.8s steps(4) infinite; }
@keyframes quadros64 { from { background-position-x: 0; } to { background-position-x: -256px; } }
.idle .meio { flex: 1; display: grid; gap: 2px; min-width: 0; }
.idle .sub { color: #A8A398; font-size: 13px; }
.idle .compra { display: flex; gap: 6px; }
.idle .compra .btn, .idle .melhoria .btn { min-height: 44px; min-width: 44px; }
.idle .btn:disabled { opacity: 0.4; }
.idle .icone { flex: none; width: 48px; height: 48px; border-radius: 6px; border: 3px solid #6B6874; background: #121212 no-repeat 0 0 / 192px 48px; image-rendering: pixelated; }
.idle .icone.geral { background-size: 42px 42px; }
.idle .icone.bronze { border-color: #C98A4B; } .idle .icone.prata { border-color: #B4B0BC; } .idle .icone.ouro { border-color: #FFD25E; }
.idle .icone.roxo { border-color: #B8A2FF; } .idle .icone.diamante { border-color: #5EC8FF; }
.idle .icone.sinergia { display: flex; }
.idle .icone .mini { flex: 1; background: no-repeat 0 0 / 84px 21px; image-rendering: pixelated; }
.idle .lista-placar li { display: grid; grid-template-columns: 32px 1fr auto; gap: 2px 8px; padding: 8px; border-radius: 8px; background: #1B1A22; color: var(--paper); }
.idle .lista-placar li.eu { outline: 2px solid #B8A2FF; }
.idle .lista-placar .sub { grid-column: 2; }
.idle .lista-placar .v { grid-row: 1; grid-column: 3; font-weight: 700; }
.idle .vazio { color: #A8A398; text-align: center; }
.idle .modal { position: fixed; inset: 0; display: grid; align-content: center; gap: 12px; padding: 24px; background: rgba(11, 10, 14, 0.92); color: var(--paper); overflow: auto; z-index: 10; }
.idle .cartao { display: grid; gap: 6px; padding: 12px; border-radius: 8px; background: #1B1A22; border: 1px solid #34323F; }
.idle .cartao.off { opacity: 0.55; }
.idle .caixinha { min-height: 44px; }
@media (prefers-reduced-motion: reduce) { .idle .sprite, .idle .vivo { animation: none; } }
```

- [ ] **Step 6: Escrever `games/idle/index.html`**

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#121212" />
    <title>Fellas Inc. · Fellas Games</title>
    <link rel="icon" href="/favicon.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

- [ ] **Step 7: Escrever `games/idle/main.ts`**

```ts
// Fellas Inc.: liga banco, tela e palco. O banco decide tudo; aqui só se pede, se mostra e se anima o número.
import '../shared/hud/hud.css';
import './idle.css';

import * as realApi from '../shared/api';
import { GameError, toGameError } from '../shared/errors';
import type { IdleBoardRow, IdleState } from '../shared/types';
import { ativos } from './ativos';
import { aoVivo, pendentes } from './oportunidades';
import { criarPalco } from './palco';
import { agoraServidor, ancorar, cenaDoEstado, faseDoEstado, segundosOportunidade, valuationAgora, type Ancora, type Fase } from './store';
import { criarTela, type Aba } from './tela';

type Api = Pick<typeof realApi, 'idleOpen' | 'idleStart' | 'idleBuy' | 'idlePickStrategy' | 'idleClaim' | 'idleBoard' | 'hasSession'>;
// só no dev: ?mock joga contra as migrações rodando no navegador (dev/mockIdle.ts)
const api: Api = import.meta.env.DEV && new URLSearchParams(location.search).has('mock') ? await import('../dev/mockIdle') : realApi;

const RECARREGA = ['idle_cant_afford', 'idle_locked', 'idle_owned', 'idle_strategy_set', 'idle_strategy_pending', 'idle_opp_gone', 'idle_opp_cap', 'idle_not_started', 'idle_started'];

let fase: Fase = 'carregando';
let ancora: Ancora | null = null;
let aba: Aba = 'geradores';
let placar: IdleBoardRow[] | null = null;
let aviso: string | null = null;
let ocupado = false;
let caixaAberta = false;
let vivoAtual: number | null = null;

const tela = criarTela(document.getElementById('app')!, {
  abrirCnpj: () => void guard(abrirCnpj),
  comprar: (tipo, id, qtd) => void guard(async () => aplicar(await api.idleBuy(tipo, id, qtd))),
  escolher: (era, opcao) => void guard(async () => aplicar(await api.idlePickStrategy(era, opcao))),
  pegar: (w) => void guard(async () => aplicar(await api.idleClaim(w))),
  trocarAba: (nova) => { aba = nova; if (nova === 'placar') void carregarPlacar(); render(); },
  caixa: (aberta) => { caixaAberta = aberta; render(); },
  tentarDeNovo: () => void guard(recarregar),
});
const palco = criarPalco(tela.canvas, ativos.cenas);

function agoraSrv() {
  return ancora ? agoraServidor(ancora, Date.now()) : Date.now();
}

function render() {
  const s = ancora?.estado ?? null;
  const agora = agoraSrv();
  const lista = s ? pendentes(s.user_id, agora, s.opp_claimed.map(Number)) : [];
  vivoAtual = s && fase === 'jogando' && s.opp_left > 0 ? aoVivo(s.user_id, agora, segundosOportunidade(s)) : null;
  if (vivoAtual !== null && s!.opp_claimed.map(Number).includes(vivoAtual)) vivoAtual = null;
  tela.renderizar({ fase, estado: s, aba, placar, aviso, ocupado, caixaAberta, pendentes: s ? lista.slice(0, Math.max(0, s.opp_left)) : [], aoVivo: vivoAtual });
  if (ancora) tela.atualizarValor(valuationAgora(ancora, Date.now()));
}

function aplicar(estado: IdleState) {
  ancora = ancorar(estado, Date.now());
  fase = faseDoEstado(estado, fase);
  if (fase !== 'abrindo') palco.tocar(cenaDoEstado(estado, fase));
  render();
}

async function recarregar() {
  aplicar(await api.idleOpen());
}

async function abrirCnpj() {
  const estado = await api.idleStart();
  fase = 'abrindo';
  aplicar(estado);
  palco.tocar('cena-0-abrindo', {
    umaVez: true,
    aoTerminar: () => {
      fase = 'jogando';
      palco.tocar(cenaDoEstado(ancora!.estado, fase));
      render();
    },
  });
}

async function carregarPlacar() {
  try {
    placar = await api.idleBoard();
  } catch {
    placar = placar ?? [];
  }
  render();
}

/** Uma ação por vez; erro vira aviso; se o banco disse que o estado mudou, recarrega. */
async function guard(trabalho: () => Promise<void>) {
  if (ocupado) return;
  ocupado = true;
  aviso = null;
  render();
  try {
    await trabalho();
  } catch (e) {
    const err = toGameError(e);
    if (err.code === 'no_session') fase = 'sem_sessao';
    else {
      aviso = err.message;
      if (RECARREGA.includes(err.code)) await recarregar().catch(() => undefined);
    }
  } finally {
    ocupado = false;
    render();
  }
}

// número subindo e a oportunidade ao vivo (só com a aba visível)
setInterval(() => {
  if (document.hidden || !ancora) return;
  tela.atualizarValor(valuationAgora(ancora, Date.now()));
  const s = ancora.estado;
  const agora = agoraSrv();
  const v = fase === 'jogando' && s.opp_left > 0 ? aoVivo(s.user_id, agora, segundosOportunidade(s)) : null;
  if (v !== vivoAtual) render();
}, 100);
setInterval(() => { if (!document.hidden && aba === 'placar') void carregarPlacar(); }, 60_000);

// voltou pra aba: bate o ponto de novo (pode ter virado a semana)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && fase !== 'carregando' && fase !== 'sem_sessao' && fase !== 'abrindo') void guard(recarregar);
});

void (async () => {
  if (import.meta.env.DEV && api.idleOpen === realApi.idleOpen) {
    const { devLogin } = await import('../shared/devLogin');
    await devLogin();
  }
  await document.fonts.ready;
  if (!(await api.hasSession())) {
    fase = 'sem_sessao';
    render();
    return;
  }
  await guard(recarregar);
  if (fase === 'carregando') tela.fatal(new GameError('unknown').message);
})();
```

- [ ] **Step 8: Entrada no Vite** — em `games/vite.config.ts`, no `input`, depois de `poker`:
`idle: resolve(import.meta.dirname, 'idle/index.html'),`.

- [ ] **Step 9: Conferir** — em `games/`: `npx tsc --noEmit && npx vitest run && npm run build` → sem erros;
`ls ../dist/games/idle/index.html` existe.

- [ ] **Step 10: Ver rodando** — `npm run dev --prefix games` e abrir `http://localhost:5173/games/dev/frames.html?game=idle`.
Conferir no celular e no PC: "Abrir CNPJ" toca a transição e cai na cena 1; comprar notebook; `__rico(1e9)` no console
do iframe e comprar até a era 2 → aparece o modal de estratégia; aba Melhorias lista as liberadas; Placar mostra os
bots; a oportunidade passa na cena e a caixinha mostra as guardadas.

- [ ] **Step 11: Commit**

```bash
git add games/idle/index.html games/idle/idle.css games/idle/tela.ts games/idle/tela.test.ts games/idle/main.ts games/vite.config.ts
git commit -m "Fellas Inc.: a página (cena, valuation animado, geradores, melhorias, placar, estratégias e oportunidades)"
```

---

### Task 15: No app: selo de unicórnio e a linha "Fellas Inc." na aba Games

**Files:**
- Create: `lib/pixelArt.ts`, `components/ui/PixelArt.tsx`, `components/ui/UnicornBadge.tsx`
- Modify: `lib/badges.ts`, `components/ui/UserBadge.tsx`, `components/ui/index.ts`, `components/games/GameRows.tsx`,
  `app/(tabs)/games.tsx`, `lib/api/games.ts`, `types/database.ts`
- Test: `__tests__/badges.test.tsx`, `__tests__/gamesApi.test.ts`, `__tests__/gamesScreen.test.tsx`

**Interfaces:**
- Produz: `Badge` ganha `'weekly_unicorn'` (rótulo "Unicórnio da semana"); `PixelArt({ linhas, cores, tamanho, rotulo })`;
  `UnicornBadge({ size })`; `getLastUnicorn(): Promise<Unicorn | null>` com `type Unicorn = { userId; name; username;
  avatarUrl; valuation: number; weekStart: string }`; `GameList` ganha `onIdle: () => void` e `unicorn: string | null`.

- [ ] **Step 1: Testes**

Em `__tests__/badges.test.tsx`, acrescentar:

```tsx
describe('selo de unicórnio da semana', () => {
  it('existe, tem nome e é desenhado', async () => {
    expect(badgeLabel('weekly_unicorn')).toBe('Unicórnio da semana');
    expect(ownBadges(['weekly_unicorn', 'xx'])).toEqual(['weekly_unicorn']);
    await render(<UserBadge badge="weekly_unicorn" />);
    expect(screen.getByLabelText('Unicórnio da semana')).toBeTruthy();
  });
});
```

Em `__tests__/gamesApi.test.ts`, acrescentar `getLastUnicorn` ao `import` e:

```ts
describe('getLastUnicorn', () => {
  it('sem semana fechada: null', async () => {
    mockResult = { data: null, error: null };
    await expect(getLastUnicorn()).resolves.toBeNull();
  });
  it('unicórnio com nome do diretório e o valuation com que fechou', async () => {
    mockResult = { data: { week_start: '2026-10-05', unicorn_id: 'u2', podium: [{ user_id: 'u2', valuation: 7.1e12, era: 5 }] }, error: null };
    await expect(getLastUnicorn()).resolves.toEqual({ userId: 'u2', name: 'Teteu', username: 'teteu', avatarUrl: null, valuation: 7.1e12, weekStart: '2026-10-05' });
    expect(mockCalls.find((c) => c.op === 'select')).toMatchObject({ table: 'idle_weeks', args: ['week_start, unicorn_id, podium'] });
  });
});
```

Em `__tests__/gamesScreen.test.tsx`: acrescentar `getLastUnicorn: jest.fn<Promise<Unicorn | null>, []>()` ao `mockApi`,
`getLastUnicorn: () => mockApi.getLastUnicorn(),` ao `jest.mock`, `Unicorn` ao `import type`, no `beforeEach`
`mockApi.getLastUnicorn.mockResolvedValue({ userId: 'u2', name: 'Rafa', username: 'rafa', avatarUrl: null, valuation: 7.1e12, weekStart: '2026-10-05' });`
e o teste:

```tsx
  it('Fellas Inc.: mostra o unicórnio da semana passada e abre o jogo', async () => {
    await render(<GamesScreen />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByLabelText('Jogar Fellas Inc.')).toBeTruthy());
    expect(screen.getByText('Unicórnio da semana passada: Rafa')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Jogar Fellas Inc.'));
    expect(mockOpen).toHaveBeenCalledWith('idle');
  });
  it('Fellas Inc.: falha ao ler o unicórnio não derruba a aba', async () => {
    mockApi.getLastUnicorn.mockRejectedValue(new Error('x'));
    await render(<GamesScreen />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByLabelText('Jogar Fellas Inc.')).toBeTruthy());
  });
```

- [ ] **Step 2: Rodar e ver falhar** — `npx jest __tests__/badges.test.tsx __tests__/gamesApi.test.ts __tests__/gamesScreen.test.tsx` → FAIL.

- [ ] **Step 3: `lib/pixelArt.ts`** (pixels exatos do `selo-unicornio.png` e do `jogo-icone.png`)

```ts
// Pixel art desenhada como SVG (sai nítida em qualquer tela). Cada letra é uma cor; '.' é transparente.
export type Pixels = { linhas: readonly string[]; cores: Readonly<Record<string, string>> };

export const UNICORNIO: Pixels = {
  cores: { a: '#0B0A0E', b: '#FFE9A8', c: '#C9962F', d: '#F4F1EA', e: '#FFD25E', f: '#B8A2FF', g: '#7E66E8', h: '#C9C4B8' },
  linhas: [
    '............aba.', '.......a...abca.', '...aaaada.aeca..', '..affaddaabca...',
    '.afffafdaeca....', 'afffaffddaa.....', 'affgadddddda....', 'fffaddddaddda...',
    'affaddddddddda..', 'ffgadddddddddda.', 'affahdddddddhda.', 'affahhdddahddda.',
    '.afahhdddaahha..', '.afahhdda..aa...', '..aahhdda.......', '...aaaaa........',
  ],
};

export const FELLAS_INC: Pixels = {
  cores: { a: '#0B0A0E', b: '#DDD2FF', c: '#5B3FD9', d: '#B8A2FF', e: '#3A2A66', f: '#7E66E8', g: '#424066', h: '#323150', i: '#211F29', j: '#1B1A22', k: '#B8913A', l: '#FFD25E', m: '#6B6874', n: '#C9962F' },
  linhas: [
    '..........aba...........', '........a.aca.a.........', '.....a.abaacaaba.a......', '....abaacadcdacaaba.....',
    '....acddcdcccdcddca.....', '....accccccccccccca.....', '....addddddddddddda.....', '....aebebebebebebea.....',
    '....afffffffffffffa.....', '.....aaaaaaaaaaaaaa.....', '.....aghhhhhhhhiija.....', '.....aghbbdddhhikja.....',
    '.....aghdhhhhhhiija.....', '.....aghdhhlhghikja.....', '.....aghddddhhhiija.....', '.....aghdhhhhhhikja.....',
    '.....aghdhhlhlhiija.....', '.....aghdhhhhhhikja.....', '.....aghdhlghlhiija.....', '.....aghmmmmmmhiija.....',
    '.....aghhnllnhhiija.....', '.....aghhnllnhhiija.....', '.....aghhnllnhhiija.....', '......aaaaaaaaaaaa......',
  ],
};
```

- [ ] **Step 4: `components/ui/PixelArt.tsx`**

```tsx
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import type { Pixels } from '../../lib/pixelArt';

/** Pixel art em SVG: um retângulo por trecho da mesma cor (com uma sobra mínima para não abrir fresta entre eles). */
export function PixelArt({ pixels, tamanho, rotulo }: { pixels: Pixels; tamanho: number; rotulo?: string }) {
  const w = pixels.linhas[0].length;
  const h = pixels.linhas.length;
  const rects: { x: number; y: number; n: number; c: string }[] = [];
  pixels.linhas.forEach((linha, y) => {
    let x = 0;
    while (x < w) {
      const ch = linha[x];
      let n = 1;
      while (x + n < w && linha[x + n] === ch) n++;
      if (ch !== '.') rects.push({ x, y, n, c: pixels.cores[ch] });
      x += n;
    }
  });
  const svg = (
    <Svg width={tamanho} height={(tamanho * h) / w} viewBox={`0 0 ${w} ${h}`}>
      {rects.map((r) => (
        <Rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.n + 0.04} height={1.04} fill={r.c} />
      ))}
    </Svg>
  );
  // o rótulo fica na View: no Svg, a web jogaria `accessible` como atributo do DOM
  return rotulo ? (
    <View accessible accessibilityRole="image" accessibilityLabel={rotulo}>
      {svg}
    </View>
  ) : (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{svg}</View>
  );
}
```

- [ ] **Step 5: `components/ui/UnicornBadge.tsx`**

```tsx
import { UNICORNIO } from '../../lib/pixelArt';
import { useTheme, type IconSize } from '../../lib/theme';
import { PixelArt } from './PixelArt';

/** Selo de unicórnio da semana (maior valuation da Fellas Inc.), em pixel art. */
export function UnicornBadge({ size = 'sm' }: { size?: IconSize }) {
  const t = useTheme();
  return <PixelArt pixels={UNICORNIO} tamanho={t.iconSizes[size]} rotulo="Unicórnio da semana" />;
}
```

- [ ] **Step 6: Ligar o selo**

`lib/badges.ts`:

```ts
export type Badge = 'verified' | 'weekly_champion' | 'weekly_unicorn';
const BADGES: readonly Badge[] = ['verified', 'weekly_champion', 'weekly_unicorn'];
export const BADGE_LABELS: Record<Badge, string> = { verified: 'Verificado', weekly_champion: 'Campeão da semana', weekly_unicorn: 'Unicórnio da semana' };
```

`components/ui/UserBadge.tsx`: importar `UnicornBadge` e acrescentar
`case 'weekly_unicorn': return <UnicornBadge size={size} />;`.
`components/ui/index.ts`: `export { PixelArt } from './PixelArt';` e `export { UnicornBadge } from './UnicornBadge';`
(junto dos outros selos).

- [ ] **Step 7: Leitura do unicórnio**

`types/database.ts`, depois de `game_weeks` (mesmo formato):

```ts
      idle_weeks: {
        Row: {
          week_start: string;
          unicorn_id: string | null;
          podium: Json;
          closed_at: string;
        };
        Insert: { [_ in never]: never };
        Update: { [_ in never]: never };
        Relationships: [];
      };
```

`lib/api/games.ts`, depois de `getLastChampion`:

```ts
export type Unicorn = { userId: string; name: string; username: string; avatarUrl: string | null; valuation: number; weekStart: string };
type IdleWeekRow = Database['public']['Tables']['idle_weeks']['Row'];

/** O unicórnio da semana passada na Fellas Inc. (maior valuation), ou null. */
export async function getLastUnicorn(): Promise<Unicorn | null> {
  const { data, error } = await supabase
    .from('idle_weeks')
    .select('week_start, unicorn_id, podium')
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const week = data as Pick<IdleWeekRow, 'week_start' | 'unicorn_id' | 'podium'> | null;
  if (!week?.unicorn_id) return null;
  const podium = week.podium as { valuation: number }[];
  return { userId: week.unicorn_id, weekStart: week.week_start, valuation: podium[0]?.valuation ?? 0, ...who(week.unicorn_id) };
}
```

- [ ] **Step 8: A linha do jogo**

Em `components/games/GameRows.tsx`:
- `GameRow`: trocar `art: Parameters<typeof TableArt>[0]['cards'];` por
  `art?: Parameters<typeof TableArt>[0]['cards']; icon?: ReactNode;` (importar `type ReactNode` de `react`) e trocar
  `<TableArt cards={art} muted={!onPlay} />` por
  `{icon ?? (art ? <TableArt cards={art} muted={!onPlay} /> : null)}`.
- `GameList`: acrescentar as props `onIdle: () => void; unicorn: string | null;` e, depois do Poker:

```tsx
      <Divider />
      <GameRow
        title="Fellas Inc."
        subtitle="Sua startup de mentira · temporada de uma semana"
        meta={unicorn ? `Unicórnio da semana passada: ${unicorn}` : undefined}
        icon={<IdleArt />}
        onPlay={onIdle}
      />
```

e, no mesmo arquivo:

```tsx
/** Capa da Fellas Inc.: a torre com a coroa roxa (pixel art), no tamanho da mesa dos outros jogos. */
function IdleArt() {
  const t = useTheme();
  const { width, height } = t.layout.gameArt;
  return (
    <View style={{ width, height, alignItems: 'center', justifyContent: 'center', borderRadius: t.radii.md, backgroundColor: t.colors.surface }}>
      <PixelArt pixels={FELLAS_INC} tamanho={Math.floor(height / 24) * 24} />
    </View>
  );
}
```

(importar `PixelArt` de `../ui` e `FELLAS_INC` de `../../lib/pixelArt`; `t.colors.surface` existe nos dois temas de
`lib/theme.ts`; com `gameArt.height = 76` o ícone sai em 72 px, 3x.)

Em `app/(tabs)/games.tsx`:
- importar `getLastUnicorn` e `type Unicorn`;
- `const [unicorn, setUnicorn] = useState<Unicorn | null>(null);`
- no `Promise.all` do `load`, acrescentar `getLastUnicorn().catch(() => null), // o card da Fellas Inc. não derruba a aba`
  e depois `setUnicorn(lastUnicorn);` (nomeie o 5º item do array `lastUnicorn`);
- no `GameList`: `onIdle={() => openGame('idle')}` e
  `unicorn={unicorn ? withMember(unicorn, members).name : null}`.

- [ ] **Step 9: Rodar** — `npx jest __tests__/badges.test.tsx __tests__/gamesApi.test.ts __tests__/gamesScreen.test.tsx` → PASS;
`npx tsc --noEmit` → sem erros.

- [ ] **Step 10: Commit**

```bash
git add lib/pixelArt.ts components/ui/PixelArt.tsx components/ui/UnicornBadge.tsx components/ui/UserBadge.tsx components/ui/index.ts lib/badges.ts lib/api/games.ts types/database.ts components/games/GameRows.tsx "app/(tabs)/games.tsx" __tests__/badges.test.tsx __tests__/gamesApi.test.ts __tests__/gamesScreen.test.tsx
git commit -m "Fellas Inc. no app: selo de unicórnio da semana e a linha do jogo na aba Games"
```

---

### Task 16: Travas das migrações, conferência final, banco e publicação

**Files:**
- Create: `__tests__/fellasIncMigration.test.ts`

- [ ] **Step 1: Teste `__tests__/fellasIncMigration.test.ts`**

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// O comportamento roda de verdade em games/test (PGlite); aqui ficam as travas que não podem sumir.
const ler = (n: string) => readFileSync(resolve(__dirname, '../supabase/migrations', n), 'utf8');
const logica = ler('0034_fellas_inc.sql');
const catalogo = ler('0033_fellas_inc_catalogo.sql');

describe('Fellas Inc. (0033/0034)', () => {
  it('reset agendado para segunda 00:00 de Brasília', () => {
    expect(logica).toContain("cron.schedule('fellas-inc-reset', '0 3 * * 1'");
  });
  it('não toca nos créditos do cassino', () => {
    for (const proibido of ['game_wallets', 'game_ledger', 'games_move', 'weekly_champion']) expect(logica).not.toContain(proibido);
  });
  it('funções internas fechadas; as do jogo só para quem está logado', () => {
    for (const f of ['idle_rate(public.idle_state)', 'idle_settle(public.idle_state, timestamptz)', 'idle_lock(uuid)', 'idle_weekly_reset()'])
      expect(logica).toContain(`revoke all on function public.${f} from public, anon, authenticated;`);
    for (const f of ['idle_open()', 'idle_start()', 'idle_buy(text, int, int)', 'idle_pick_strategy(int, int)', 'idle_claim_opportunity(bigint)', 'idle_board()'])
      expect(logica).toContain(`grant execute on function public.${f} to authenticated;`);
  });
  it('o catálogo é gerado (não editado à mão)', () => {
    expect(catalogo).toContain('GERADO por games/idle/catalogo.ts');
  });
});
```

- [ ] **Step 2: Rodar tudo**

```bash
npx tsc --noEmit
npm test
npm test --prefix games
npm run build --prefix games
```

Expected: tudo passa (o `safeUpdateMigrations.test.ts` também confere 0033/0034).

- [ ] **Step 3: Commit**

```bash
git add __tests__/fellasIncMigration.test.ts
git commit -m "Fellas Inc.: travas das migrações (cron, permissões, nada de créditos do cassino)"
```

- [ ] **Step 4: Banco de produção (o Juan roda)** — pedir ao Juan para conferir e rodar no terminal dele:
`! npx supabase db push` (aplica 0033 e 0034). Depois conferir por REST: `idle_cat_gen` com 30 linhas para um membro;
`select * from cron.job where jobname = 'fellas-inc-reset'` no painel.

- [ ] **Step 5: Publicar** — merge local na `main` e push (o deploy roda os testes e builda `dist/games/idle/`):

```bash
git checkout main
git merge --no-ff fellas-inc-nucleo -m "Fellas Inc.: entrega 1 (núcleo)"
git push origin main
```

- [ ] **Step 6: Conferência real** — abrir `https://fellasapp.pages.dev/games` no celular: linha "Fellas Inc." abre o
jogo; Abrir CNPJ; comprar; voltar no dia seguinte e ver o valuation que rendeu (teto de 8h); pegar oportunidade da
caixinha. Na terça, conferir `idle_weeks` e o selo do unicórnio.

---

## Autorrevisão

- **Cobertura da spec (entrega 1):** 1.1 valuation/produção/teto/sem clique → Tasks 1, 4; 1.2 30 geradores/eras/cena 6
  → Tasks 1, 11, 12, 13; 1.3 ritmo → Task 2; 2 melhorias → Tasks 1, 5, 14; 3 oportunidades → Tasks 6, 14; 4 estratégias
  → Tasks 1, 5, 14; 8.1 reset/placa/selo → Task 7; 8.2 telas → Task 14; 8.3 app → Task 15; 9 dados/funções/custo →
  Tasks 3–8; 10 arte → Task 11; 11 testes → todas. Contratos (5), propriedades (6) e personagem (7) são das entregas 2 e 3.
- **Nomes conferidos entre tasks:** `idle_lock`, `idle_save`, `idle_json`, `idle_settle`, `idle_rate`, `idle_cost_mult`,
  `idle_opp_list`, `idle_opp_cap`; `taxa`, `taxaPorUnidade`, `preco`, `maxCompra`, `acumular`; `IdleState`, `IdleBoardRow`;
  `NomeCena`, `CENAS`, `quadroEm`; `Modelo`, `Acoes`, `Tela`.
- **Foco da revisão:** os 5 itens estão em testes nas Tasks 1, 5, 7 e 13.
