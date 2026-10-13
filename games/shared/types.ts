// Formatos que as funções do banco devolvem (0027 e 0028). Carta = número 0–51, igual ao banco.
export type Card = number;
export type HandResult = 'blackjack' | 'win' | 'push' | 'lose' | 'bust';
export type Hand = {
  cards: Card[];
  bet: number;
  doubled: boolean;
  from_split_aces: boolean;
  done: boolean;
  result: HandResult | null;
};
export type RoundState = {
  id: string;
  status: 'playing' | 'done';
  bet: number;
  hands: Hand[];
  active: number;
  /** Só as cartas visíveis: a de cima durante o jogo; todas no fim. */
  dealer: Card[];
  dealer_total: number;
  payout: number;
  /** Saldo da carteira depois da jogada. */
  balance: number;
  /** Dá pra pegar fiado agora (quebrou na mesa: a tela não precisa perguntar de novo). */
  can_fiado: boolean;
};
export type Wallet = {
  balance: number;
  fiado_count: number;
  can_fiado: boolean;
  open_round_id: string | null;
  week_start: string;
  /** Fichas na mesa de poker (0030); null = não está sentado. */
  seated_stack?: number | null;
};
export type Action = 'hit' | 'stand' | 'double' | 'split';
export type BoardRow = { userId: string; name: string; balance: number };

// Poker (0030): o retrato público da mesa (poker_tables.state) e o que só eu vejo.
export type PokerLast = 'sb' | 'bb' | 'fold' | 'check' | 'call' | 'raise' | 'allin';
export type PokerPlayer = {
  user_id: string;
  /** Aposta nesta rodada. */
  bet: number;
  /** Tudo que pôs na mão. */
  total: number;
  folded: boolean;
  all_in: boolean;
  acted: boolean;
  /** Depois de um all-in curto: só paga ou corre. */
  capped: boolean;
  last: PokerLast | null;
  timed_out: boolean;
};
export type PokerSeat = {
  seat: number;
  user_id: string;
  stack: number;
  status: 'playing' | 'away';
  wait_bb: boolean;
  leaving: boolean;
  busted: boolean;
};
export type PokerPot = { amount: number; winners: number[]; name: string | null };
export type PokerResults = {
  showdown: boolean;
  pots: PokerPot[];
  payouts: Record<string, number>;
  hands: Record<string, string>;
};
export type PokerHand = {
  id: string;
  no: number;
  status: 'betting' | 'done' | 'void';
  street: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
  board: Card[];
  /** Por lugar ("0".."5"). */
  players: Record<string, PokerPlayer>;
  pot: number;
  current_bet: number;
  min_raise_to: number;
  to_act: number | null;
  action_no: number;
  deadline: string | null;
  button: number;
  sb: number;
  bb: number;
  runout: boolean;
  results: PokerResults | null;
  shown: Record<string, Card[]>;
};
export type PokerState = {
  seq: number;
  server_now: string;
  closed: boolean;
  next_hand_at: string | null;
  blinds: [number, number];
  buyin: [number, number];
  seats: PokerSeat[];
  hand: PokerHand | null;
  /** Só na resposta das funções (não no tempo real). */
  me?: { rathole_min: number | null };
};
export type PokerCards = { hand_id: string; cards: Card[] } | null;
export type PokerAction = 'fold' | 'check' | 'call' | 'raise' | 'allin';
export type PokerHistoryRow = {
  id: string;
  no: number;
  board: Card[];
  results: PokerResults;
  shown: Record<string, Card[]>;
  players: Record<string, string>;
  ended_at: string;
};
export type Fella = { id: string; name: string; avatarUrl: string | null };

// Fellas Inc. (0034): o estado que toda função do idle devolve
export type IdleState = {
  user_id: string; week_start: string; started: boolean; valuation: number; rate: number;
  generators: number[]; upgrades: number[]; strategies: number[]; era: number;
  boost_until: string | null; half_price: boolean; opp_claimed: number[]; opp_left: number; server_now: string;
  /** Eventos na tela (0045): fim da Promoção relâmpago (null = não está valendo) e os fins dos Viralizou ativos. */
  promo_ate: string | null; viral: string[];
  /** Bônus da horta agora (0048); a página aplica nos preços. */
  horta_bonus?: BonusHorta;
  /** Mapa do rolê (0057): o multiplicador dos lugares (marcos e estratégias) que já está na taxa; a página multiplica o "cada". */
  mapa_mult?: number;
  /** Mapa do rolê (0057): quantos lugares a pessoa tem abertos (continuam abertos depois de vender a startup). */
  mapa_abertos?: number;
  /** Convidados (0051): as 3 cadeiras (id ou null), desde quando, as trocas guardadas e a âncora da recarga, os PPP
   *  Podcasts e o fim da derrubada do MC V.V valendo agora. */
  convidados?: IdleConvidados;
  /** Entrega 2 (0038): seu visual (null = nunca salvou), quem você contratou (contratos ativos, do mais recente ao
   *  mais antigo), quem te contratou, o que entra na conta dos contratos, o preço do próximo contrato e o próximo
   *  vencimento que muda a sua taxa (null = nenhum). */
  avatar: IdleVisual | null; equipe: IdleContratado[]; chefes: IdleChefe[];
  social: { contratei: number; empregos: number[] }; hire_price: number; muda_em: string | null;
  /** Entrega 3 (0041): os nós da árvore que você comprou e quantas conquistas você tem (o que entra na conta), pontos de
   *  prestígio livres e ganhos na vida, quantas vezes vendeu, o recorde de F$/s, quantos pontos vender agora daria, suas
   *  conquistas, as ganhas nesta chamada (a tela avisa) e as escondidas que alguém do grupo já tem. */
  bonus: { arvore: number[]; conquistas: number }; pontos: number; pontos_vida: number; vendas: number; recorde: number;
  pontos_venda: number;
  conquistas: IdleConquista[]; novas: number[]; descobertas: number[];
};
export type IdleConvidados = {
  cadeira: (number | null)[]; desde: (string | null)[]; trocas: number; trocas_t: string | null; ppp: number; derrubada_ate: string | null;
};
export type IdleConquista = { id: number; em: string };
export type IdleContratado = { user_id: string; cargo: string; avatar: IdleVisual | null; ate: string };
/** mult vem de exp(sum(ln)) no banco e pode trazer ruído (3.0000000000000004): arredonde para mostrar, não compare por igualdade. */
export type IdleChefe = { user_id: string; cargo: string; mult: number; ate: string };
export type IdleBoardRow = {
  userId: string; name: string; valuation: number; rate: number; era: number; strategies: number[];
  avatar: IdleVisual | null; hiredCount: number; byMe: boolean; mostHired: boolean;
  /** Pontos de prestígio ganhos na vida e quantas conquistas (0041). */
  pontos: number; conquistas: number;
};
/** Linha de idle_board como o banco devolve. */
export type LinhaPlacar = {
  user_id: string; valuation: number; rate: number; era: number; strategies: number[];
  avatar: IdleVisual | null; hired_count: number; by_me: boolean; most_hired: boolean; pontos: number; conquistas: number;
};
export const linhaPlacar = (r: LinhaPlacar, name: string): IdleBoardRow => ({
  userId: r.user_id, name, valuation: r.valuation, rate: r.rate, era: r.era, strategies: r.strategies,
  avatar: r.avatar, hiredCount: r.hired_count, byMe: r.by_me, mostHired: r.most_hired, pontos: r.pontos, conquistas: r.conquistas,
});

// Fellas Inc., entrega 2 (0038): o visual do personagem como o banco guarda (índices das opções do editor)
export type IdleVisual = {
  pele: number; cabelo: number; cor_cabelo: number; roupa: number; cor_roupa: number; acessorio: number; cor_acessorio: number;
};

/** Bolsa da Fellas Inc. (0043 idle_bolsa_estado). Preços em segundos de produção; em F$ = valor × r. */
export type BolsaEmpresa = { id: number; valor: number; limite: number; risco: boolean; rj_ate: number | null; historico: number[]; /** só com o VSauce sentado (0051) */ humor?: number | null };
export type BolsaPosicao = { empresa: number; qtd: number; custo: number; /** lote do Vorcaro (1 = normal; 0051) */ alavanca?: number };
/** Horta do Food truck (0048): os bônus das maduras agora, as plantas vivas, as descobertas. */
export type BonusHorta = { producao: number; geradores: number; melhorias: number; oportunidades: number };
export type PlantaHorta = { canteiro: number; especie: number; inicio: string; origem: 'plantada' | 'cruzou' | 'morango'; /** os tempos dela (o Terry muda; 0051) */ amadurece_s?: number | null; vida_s?: number | null };
export type HortaEstado = {
  lado: number; food_trucks: number; plantas: PlantaHorta[]; descobertas: number[]; bonus: BonusHorta; server_now: string;
};

export type BolsaEstado = {
  tick: number; vira_em_ms: number; r: number; aberta: boolean; corretor: number; escritorio: number; corretagem: number;
  empresas: BolsaEmpresa[]; carteira: BolsaPosicao[]; viraram_po: { empresa: number; qtd: number }[];
};
export type LadoBolsa = 'comprar' | 'vender';
export type MelhoriaBolsa = 'corretor' | 'escritorio';

// Mapa do rolê (idle_mapa, idle_lugar): os lugares que a pessoa abre e sobe de nível.
export type PinoMapa = {
  id: number; faixa: 'barato' | 'medio' | 'caro'; lote: number; lancado: boolean; horas: number; era: number;
  moeda: string | null; numero: 'pct' | 'nota' | 'estrelas' | null; preco: number;
  nome: string | null; frase: string | null; icone: string | null; x: number | null; y: number | null;
  aberto: boolean; nivel: number | null; moeda_qtd: number | null; fas: number | null;
  dono: { user_id: string; avatar: IdleVisual | null } | null;
};
/** marcos_novos: os marcos que a mecânica alcançou desde a última vez (a tela avisa "Marco: +N%"). estado_mudou: o depois
 *  dos lugares mexeu na empresa (desafio, conquista); a resposta não traz o estado dela, então a tela busca de novo. */
export type MapaEstado = { mapa: string | null; lugares: PinoMapa[]; mult: number; marcos_novos?: number[]; estado_mudou?: boolean };
export type ProducaoLugar = { id: number; user_id: string; nome: string; partes: number[]; numero: number; criado_em: string; avatar: IdleVisual | null };
export type NotaCaderninho = { tipo: string; a: number; b: number; rotulo: number };
export type LugarEstado = {
  id: number; moeda_nome: string | null; numero: 'pct' | 'nota' | 'estrelas' | null; lancado: boolean;
  nome: string | null; frase: string | null; icone: string | null;
  aberto: boolean; nivel: number | null; moeda: number | null; fas: number | null; volume: number | null; lendario: boolean | null;
  marcos: number[]; preco_nivel: number | null;
  desafio: { id: number; texto: string; premio: 'horas' | 'legado' | 'investidor'; premio_valor: number; feito: boolean } | null;
  podio: ProducaoLugar[]; semana: { user_id: string; numero: number; avatar: IdleVisual | null }[];
  dono: { user_id: string; numero: number; avatar: IdleVisual | null } | null;
  caderninho: NotaCaderninho[]; mecanica: unknown; server_now: string;
  /** Só na resposta do idle_lugar: os marcos alcançados desde a última vez (de qualquer lugar aberto). */
  marcos_novos?: number[];
  /** Só na resposta do idle_lugar: o depois mexeu na empresa (desafio, conquista) e a tela busca o estado dela de novo. */
  estado_mudou?: boolean;
};
