# Fellas Inc.: eventos na tela (tipo cookie dourado) e oportunidades só na Caixinha

Data: 2026-10-11. Pedido do Juan: tirar a oportunidade que passa na cena (fica só na Caixinha) e criar eventos que
aparecem na tela pra quem está com o jogo aberto, somem se ninguém clicar, e têm um som característico.

## Decisões do Juan

- Três eventos ("trio clássico"):

  | Evento | Chance | Efeito |
  |---|---|---|
  | Investidor apressado | 45% | 20 minutos de produção na hora |
  | Promoção relâmpago | 35% | por 30 s, geradores e melhorias pela metade |
  | Viralizou | 20% (inclui a dupla) | produção ×10 por 1 minuto |

- Por sorte, não por horário: a cada segundo há chance 1/600 (média de um a cada ~10 min). Fica **12 s** e some.
- **Em qualquer lugar da tela**, por cima de tudo.
- **Dois Viralizou se multiplicam** (×10 × ×10 = ×100). A **dupla** (dois ícones de Viralizou juntos) sai em 2% dos
  eventos; também dá ×100 se cair outro Viralizou dentro do minuto de um ativo (raríssimo). O teto é ×100.
- Caminho A: sorte com semente (id do jogador + segundo), a mesma conta na página e no banco; o banco confere.
- Oportunidades: param de passar na cena; ficam só na Caixinha (com o "plim" e o selo contando).
- Avisos desligado não esconde o evento (é jogo); só o texto que sobe.

## Banco (migração 0045)

- `idle_dourado(u uuid, s bigint) returns int` (imutável): null = nada; 0 Investidor, 1 Promoção, 2 Viralizou,
  3 dupla. Conta com `numeric`, igual a `dourados.ts` (BigInt):
  - `semente` = `idle_opp_seed(u)`; P = 2147483647;
  - `h1 = (s²·48271 + s·16807 + semente·69621 + 12345) mod P`; `h2 = (h1² + 1013904223) mod P`;
  - aparece se `h2 mod 600 = 0`; `h3 = (h2² + 1013904223) mod P`; `r = h3 mod 100`:
    r < 2 dupla, < 20 Viralizou, < 55 Promoção, senão Investidor.
- `idle_state`: `promo_ate timestamptz`, `viral_ate timestamptz[] not null default '{}'` (fim de cada Viralizou; a
  janela é [fim − 60 s, fim)).
- `idle_dourados_pegos (user_id, seg bigint, lado smallint, pegou_em)`, chave (user_id, seg, lado); RLS, sem acesso do
  app; poda das de mais de 1 h.
- `idle_dourado_pegar(p_seg bigint, p_lado int)` (RPC, `authenticated`): o evento existe no segundo; `lado` 0 (ou 1 na
  dupla); agora entre o segundo − 2 s e o segundo + 15 s (12 s + folga); não pego antes. Erros: `idle_dourado_gone`
  ("Esse já foi embora"), `idle_dourado_pego` (a página recarrega). Fecha a conta e aplica:
  - Investidor: `valuation += idle_rate(s) * 1200` (a produção sem os bônus de tempo);
  - Promoção: `promo_ate = greatest(promo_ate, now() + 30 s)`;
  - Viralizou: guarda `now() + 60 s` em `viral_ate` (só os ativos ficam).
- Conta da produção (`idle_settle`, igual a `economia.ts acumularTrechos`): em cada trecho, divide nos pontos em que o
  ×5 da oportunidade ou algum Viralizou começa/acaba; multiplicador = (×5 se oportunidade) × 10^min(k, 2) (k =
  Viralizou ativos).
- Compras com a Promoção ativa: o multiplicador de custo cai pela metade (preço, 10 e Máx); a "próxima compra pela
  metade" não é usada nem gasta enquanto a Promoção vale (desconto máximo 50%).
- O recorde de F$/s, o placar, as conquistas de produção e os pontos da venda usam a produção sem bônus de tempo (como
  hoje). Vender a startup zera `promo_ate` e `viral_ate`.
- `idle_json` devolve `promo_ate` e `viral` (os fins ativos).

## Página

- `dourados.ts`: a mesma sorte (BigInt), posição na tela (só da página), textos.
- `douradoTela.ts`: os ícones (Investidor = maleta, Promoção = etiqueta −50%, Viralizou = celular com corações),
  64 px, brilho dourado, balança (parado com movimento reduzido), anel que esvazia em 12 s e pisca nos 3 últimos.
  Clique: chama o banco; texto que sobe ("+F$ X", "Promoção! Tudo pela metade por 30 s", "Viralizou! ×10 por 1 min",
  "×100!"); som `dourado` ao aparecer e `douradoPego` ao pegar.
- Selo ao lado do F$ enquanto Viralizou/Promoção valem: "×10 · 0:42", "×100 · 0:15" (dourado), "Metade · 0:21".
- A página olha a cada segundo (só com a aba visível e jogando).
- A oportunidade não passa mais na cena (o boneco `vivo` sai); a Caixinha segue igual.
- `?mock`: `__dourado(tipo)` força um evento na tela (o banco do mock aceita).
- Patch notes: entrada "Sorte na tela".

## Testes

- Paridade da sorte SQL × TS em milhares de segundos; frequência ~1/600 e proporções dos tipos numa amostra grande.
- Pegar: fora do tempo, segundo sem evento, lado errado, repetido; cada efeito; dupla (dois lados); ×100 na conta;
  Promoção barateia e não gasta a meia-preço; venda zera; recorde sem o ×10.
- `acumularTrechos` com Viralizou e ×5 (paridade com o banco).
- Tela: o evento aparece, some em 12 s, clique chama a ação; o selo; a cena sem o boneco da oportunidade.
