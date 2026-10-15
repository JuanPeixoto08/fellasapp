// Só no dev (?mock): a Fellas Inc. contra as migrações rodando no navegador (dev/mockDb.ts). Mesmos nomes e
// formatos de shared/api.ts. Os bots abrem a empresa, têm personagem (dá pra contratar), pontos de prestígio, nós da
// árvore e conquistas (uma escondida, pra aba Legado mostrar o "???"). Nunca entra no build.
import {
  linhaPlacar, type BolsaEstado, type Fella, type HortaEstado, type IdleBoardRow, type IdleState, type IdleVisual, type LadoBolsa, type LinhaPlacar, type LugarEstado, type MapaEstado, type MelhoriaBolsa,
} from '../shared/types';
import { call, dono, FRIENDS, ME } from './mockDb';

// visuais dos bots (ninguém real): Oliveira, Bia, Teteu
const VISUAIS: IdleVisual[] = [
  { pele: 1, cabelo: 3, cor_cabelo: 0, roupa: 1, cor_roupa: 6, acessorio: 1, cor_acessorio: 3 },
  { pele: 4, cabelo: 4, cor_cabelo: 7, roupa: 3, cor_roupa: 8, acessorio: 3, cor_acessorio: 0 },
  { pele: 2, cabelo: 1, cor_cabelo: 1, roupa: 2, cor_roupa: 1, acessorio: 0, cor_acessorio: 0 },
];
const avatar = (v: IdleVisual, as?: string) =>
  call<IdleState>(
    'select public.idle_set_avatar($1, $2, $3, $4, $5, $6, $7) as v',
    [v.pele, v.cabelo, v.cor_cabelo, v.roupa, v.cor_roupa, v.acessorio, v.cor_acessorio],
    as,
  );

// prestígio dos bots: [pontos ganhos na vida, nós da árvore, conquistas]. Oliveira já vendeu e tem a 6-7 (escondida)
const LEGADO: [number, number[], number[]][] = [[12, [1, 11, 21, 41], [1, 31, 39, 47, 51, 101]], [3, [1], [31, 47]], [0, [], []]];

const bots = (async () => {
  for (const [i, [id]] of FRIENDS.entries()) {
    await call('select public.idle_start() as v', [], id).catch(() => undefined);
    await avatar(VISUAIS[i % VISUAIS.length], id).catch(() => undefined);
    const [ganhos, nos, conquistas] = LEGADO[i % LEGADO.length];
    const gastos = nos.reduce((a, n) => a + (n === 1 ? 1 : 2), 0); // a raiz custa 1; o 1º de cada ramo, 2
    await dono('update public.idle_state set prestige_earned = $2, prestige_spent = $3, prestige_count = $4 where user_id = $1',
      [id, ganhos, gastos, ganhos ? 1 : 0]);
    for (const n of nos) await dono('insert into public.idle_arvore (user_id, no_id) values ($1, $2) on conflict do nothing', [id, n]);
    for (const c of conquistas) {
      await dono('insert into public.idle_conquistas (user_id, conquista_id) values ($1, $2) on conflict do nothing', [id, c]);
    }
  }
})();

export const idleOpen = () => call<IdleState>('select public.idle_open() as v');
export const idleStart = () => call<IdleState>('select public.idle_start() as v');
export const idleBuy = (kind: 'gerador' | 'melhoria', id: number, qty: 0 | 1 | 10 = 1) =>
  call<IdleState>('select public.idle_buy($1, $2, $3) as v', [kind, id, qty]);
export const idlePickStrategy = (era: number, opcao: number) => call<IdleState>('select public.idle_pick_strategy($1, $2) as v', [era, opcao]);
export const idleClaim = (window: number) => call<IdleState>('select public.idle_claim_opportunity($1) as v', [window]);
export const idleDouradoPegar = (seg: number, lado: number) => call<IdleState>('select public.idle_dourado_pegar($1, $2) as v', [seg, lado]);
export const idleEventoPegar = (seg: number, gols: number) => call<IdleState>('select public.idle_evento_pegar($1, $2) as v', [seg, gols]);
type ComHorta = IdleState & { horta: HortaEstado; descobriu?: number | null };
export const idleHorta = () => call<HortaEstado>('select public.idle_horta() as v');
export const idleHortaPlantar = (canteiro: number, especie: number) => call<ComHorta>('select public.idle_horta_plantar($1, $2) as v', [canteiro, especie]);
export const idleHortaColher = (canteiro: number) => call<ComHorta>('select public.idle_horta_colher($1) as v', [canteiro]);
export const idleHortaArrancar = (canteiro: number) => call<ComHorta>('select public.idle_horta_arrancar($1) as v', [canteiro]);
export const idleMapa = () => call<MapaEstado>('select public.idle_mapa() as v');
export const idleLugar = (lugar: number) => call<LugarEstado>('select public.idle_lugar($1) as v', [lugar]);
export const idleLugarAbrir = (lugar: number) => call<IdleState & { mapa: MapaEstado }>('select public.idle_place_abrir($1) as v', [lugar]);
export const idleLugarNivel = (lugar: number) =>
  call<IdleState & { lugar: LugarEstado; marcos_novos: number[] }>('select public.idle_place_nivel($1) as v', [lugar]);
export const idleLugarAcao = (fn: string, args: Record<string, unknown>) => {
  if (!/^idle_(tee|cup|din)_[a-z_]+$/.test(fn)) throw new Error(`ação de lugar desconhecida: ${fn}`);
  // por nome, como o PostgREST (fn(p_x => $1, ...)): a ordem das chaves de args não importa
  const nomes = Object.keys(args);
  if (nomes.some((n) => !/^p_[a-z_]+$/.test(n))) throw new Error(`argumento de lugar desconhecido em ${fn}`);
  return call<IdleState & { lugar: LugarEstado; marcos_novos?: number[] }>(
    `select public.${fn}(${nomes.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as v`, nomes.map((n) => args[n]));
};
export const fellas = (ids: string[]) =>
  call<Fella[]>(`select coalesce(json_agg(json_build_object('id', id, 'name', coalesce(display_name, username), 'avatarUrl', null)), '[]'::json) as v from public.profiles where id = any($1::uuid[])`, [ids]);
export const idleHire = (userId: string) => call<IdleState>('select public.idle_hire($1) as v', [userId]);
export const idleSetAvatar = (v: IdleVisual) => avatar(v);
export const idlePrestige = () => call<IdleState>('select public.idle_prestige() as v');
export const idleBuyNode = (no: number) => call<IdleState>('select public.idle_buy_node($1) as v', [no]);
export const idleBolsa = () => call<BolsaEstado>('select public.idle_bolsa() as v');
export const idleBolsaNegociar = (empresa: number, lado: LadoBolsa, qtd: 0 | 1 | 10, tick: number, lote = 1) =>
  call<IdleState & { bolsa: BolsaEstado }>('select public.idle_bolsa_negociar($1, $2, $3, $4, $5) as v', [empresa, lado, qtd, tick, lote]);
export const idleConvSentar = (cadeira: number, convidado: number) =>
  call<IdleState & { mesma_pessoa?: boolean }>('select public.idle_conv_sentar($1, $2) as v', [cadeira, convidado]);
export const idleConvTirar = (cadeira: number) => call<IdleState>('select public.idle_conv_tirar($1) as v', [cadeira]);
export const idleBolsaMelhorar = (tipo: MelhoriaBolsa, nivel: number) =>
  call<IdleState & { bolsa: BolsaEstado }>('select public.idle_bolsa_melhorar($1, $2) as v', [tipo, nivel]);
export const hasSession = async () => true;
export const myId = async () => ME;

export async function idleBoard(): Promise<IdleBoardRow[]> {
  await bots;
  const rows = await call<LinhaPlacar[]>('select public.idle_board() as v');
  const names = await call<{ id: string; name: string }[]>(
    `select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', display_name)), '[]') as v from public.profiles`,
  );
  return rows.map((r) => linhaPlacar(r, names.find((n) => n.id === r.user_id)?.name ?? 'Alguém'));
}

// console do dev: __rico(1e12) põe valuation na sua empresa; __meContrata() faz o primeiro bot te contratar;
// __vendavel() deixa sua empresa valendo uns 7 pontos de prestígio (150 foguetes, estratégias escolhidas); __pontos(10) põe 10 pontos de prestígio livres; __trader(3) abre a Bolsa (3 traders e F$ de sobra)
const w = window as unknown as {
  __rico: (v: number) => Promise<void>; __dourado: (tipo?: number) => Promise<void>; __meContrata: () => Promise<void>; __vendavel: (foguetes?: number) => Promise<void>; __pontos: (n: number) => Promise<void>; __trader: (n?: number) => Promise<void>;
};
w.__rico = async (v) => {
  const { ready } = await import('./mockDb');
  const db = await ready;
  await db.query('update public.idle_state set valuation = $2 where user_id = $1', [ME, v]);
};
w.__meContrata = async () => {
  const { ready } = await import('./mockDb');
  const db = await ready;
  await bots;
  const [bot] = FRIENDS[0];
  await db.query('update public.idle_state set valuation = 1e15 where user_id = $1', [bot]);
  await call('select public.idle_hire($1) as v', [ME], bot);
};
w.__vendavel = async (foguetes = 150) => {
  await dono(`update public.idle_state set generators[30] = $2, strategies = '{0,0,0,0}' where user_id = $1`, [ME, foguetes]);
  document.dispatchEvent(new Event('visibilitychange')); // a página bate o ponto e mostra
};
w.__pontos = async (n) => {
  await dono('update public.idle_state set prestige_earned = prestige_spent + $2 where user_id = $1', [ME, n]);
  document.dispatchEvent(new Event('visibilitychange')); // a página bate o ponto e mostra
};
// __dourado(2) põe um evento na tela agora (0 Investidor, 1 Promoção, 2 Viralizou, 3 dupla); o banco do mock aceita
w.__dourado = async (tipo = 2) => {
  const { ready } = await import('./mockDb');
  const db = await ready;
  const seg = Math.floor(Date.now() / 1000);
  const ja = await db.query<{ n: number }>("select count(*)::int as n from pg_proc where proname = 'idle_dourado_sorte'");
  if (!ja.rows[0].n) {
    await db.exec(`alter function public.idle_dourado(uuid, bigint, double precision) rename to idle_dourado_sorte;
      create table public.mock_dourado (s bigint primary key, tipo int);
      create function public.idle_dourado(u uuid, s bigint, gema double precision default 0) returns int language sql stable as
        'select coalesce((select tipo from public.mock_dourado m where m.s = idle_dourado.s), public.idle_dourado_sorte(u, s, gema))';`);
  }
  await db.query('insert into public.mock_dourado values ($1, $2) on conflict (s) do update set tipo = excluded.tipo', [seg, tipo]);
  (window as unknown as { __mostrarDourado?: (seg: number, tipo: number) => void }).__mostrarDourado?.(seg, tipo);
};
/** Quantos Food trucks o mock tem agora. */
async function dono2(): Promise<{ ft: number }> {
  const { ready } = await import('./mockDb');
  const db = await ready;
  const r = await db.query<{ ft: number }>('select generators[11] as ft from public.idle_state where user_id = $1', [ME]);
  return { ft: r.rows[0]?.ft ?? 0 };
}

// horta no mock: __foodTrucks(n) põe n Food trucks; __hortaAvancar(h) faz a horta "viver" h horas (plantas e passos
// pra trás); __hortaSorte(true) faz todo cruzamento possível acontecer (false volta ao normal)
const wh = window as unknown as {
  __foodTrucks: (n: number) => Promise<void>; __hortaAvancar: (horas: number) => Promise<void>; __hortaSorte: (forcar: boolean) => Promise<void>;
};
wh.__foodTrucks = async (n) => {
  await dono(`update public.idle_state set generators[11] = $2, strategies = '{0,0,0,0}' where user_id = $1`, [ME, n]);
  document.dispatchEvent(new Event('visibilitychange'));
};
wh.__hortaAvancar = async (horas) => {
  await dono(`update public.idle_horta_plantas set inicio = inicio - make_interval(secs => $2::float8 * 3600), fim = fim - make_interval(secs => $2::float8 * 3600) where user_id = $1`, [ME, horas]);
  await dono(`update public.idle_state set horta_passo = horta_passo - round($2::float8 * 12)::bigint, horta_visto = horta_visto - make_interval(secs => $2::float8 * 3600) where user_id = $1`, [ME, horas]);
  document.dispatchEvent(new Event('visibilitychange'));
};
wh.__hortaSorte = async (forcar) => {
  const { ready } = await import('./mockDb');
  const db = await ready;
  const ja = await db.query<{ n: number }>("select count(*)::int as n from pg_proc where proname = 'idle_horta_sorte_real'");
  if (!ja.rows[0].n) {
    await db.exec(`alter function public.idle_horta_sorte(uuid, int, bigint, int) rename to idle_horta_sorte_real;
      create table public.mock_horta (forcar boolean not null);
      insert into public.mock_horta values (false);
      create function public.idle_horta_sorte(u uuid, c int, t bigint, k int) returns double precision language sql stable as
        'select case when (select forcar from public.mock_horta) then 0 else public.idle_horta_sorte_real(u, c, t, k) end';`);
  }
  await db.query('update public.mock_horta set forcar = $1 where true', [forcar]);
};

// convidados no mock: __ppp(n) põe n PPP Podcasts (e 1 de cada gerador antes, pra liberar); trocas cheias; o tempo
// sentado anda h horas (Kojima sobe, faixas do MC V.V passam); a próxima faixa do MC V.V cai agora
const wc = window as unknown as { __ppp: (n: number) => Promise<void>; __convHoras: (h: number) => Promise<void>; __convTrocas: () => Promise<void>; __faixaAgora: () => Promise<void> };
const avisar = () => document.dispatchEvent(new Event('visibilitychange'));
wc.__ppp = async (n) => {
  await dono(`update public.idle_state set generators[13] = $2, strategies = '{0,0,0,0}',
    generators[1:12] = array(select greatest(g, 1) from unnest(generators[1:12]) g) where user_id = $1`, [ME, n]);
  avisar();
};
wc.__convTrocas = async () => { await dono('update public.idle_state set conv_trocas = 3, conv_trocas_t = null where user_id = $1', [ME]); avisar(); };
wc.__convHoras = async (h) => {
  await dono(`update public.idle_state set conv_desde = array(select d - make_interval(secs => $2::float8 * 3600) from unnest(conv_desde) d),
    conv_trocas_t = conv_trocas_t - make_interval(secs => $2::float8 * 3600) where user_id = $1`, [ME, h]);
  avisar();
};
wc.__faixaAgora = async () => {
  // a vaga do MC V.V (9) passa a ter sentado há 2 h / peso, menos 1 s: a faixa 1 cai no próximo segundo
  await dono(`update public.idle_state set conv_desde[i] = date_trunc('second', now()) + interval '1 second' - make_interval(secs => 7200 / (array[1, 0.5, 0.25])[i])
    from (select generate_subscripts(conv_cadeira, 1) i from public.idle_state where user_id = $1) x
    where user_id = $1 and conv_cadeira[x.i] = 9`, [ME]);
  avisar();
};

// painel do ?mock pra testar os eventos sem abrir o console (só no dev)
{
  const painel = document.createElement('div');
  painel.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:99;justify-content:flex-end;max-width:70vw;display:flex;gap:6px;flex-wrap:wrap;padding:6px;background:#000c;font:12px sans-serif';
  const nomes = ['Investidor', 'Promoção', 'Viralizou', 'Dupla ×100'];
  nomes.forEach((nome, tipo) => {
    const b = document.createElement('button');
    b.textContent = nome;
    b.style.cssText = 'padding:6px 8px;background:#5B3FD9;color:#fff;border:0;cursor:pointer';
    b.addEventListener('click', () => void w.__dourado(tipo));
    painel.append(b);
  });
  const horta: [string, () => Promise<void>][] = [
    ['+25 Food trucks', async () => wh.__foodTrucks(((await dono2()).ft ?? 0) + 25)],
    ['Horta +1 h', () => wh.__hortaAvancar(1)],
    ['Horta +8 h', () => wh.__hortaAvancar(8)],
    ['Cruzar (sorte)', async () => { await wh.__hortaSorte(true); await wh.__hortaAvancar(0.5); await wh.__hortaSorte(false); }],
  ];
  for (const [nome, f] of horta) {
    const b = document.createElement('button');
    b.textContent = nome;
    b.style.cssText = 'padding:6px 8px;background:#2E7D3A;color:#fff;border:0;cursor:pointer';
    b.addEventListener('click', () => void f());
    painel.append(b);
  }
  const conv: [string, () => Promise<void>][] = [
    ['+25 PPP Podcasts', async () => {
      const { ready } = await import('./mockDb');
      const r = await (await ready).query<{ n: number }>('select generators[13] as n from public.idle_state where user_id = $1', [ME]);
      await wc.__ppp((r.rows[0]?.n ?? 0) + 25);
    }],
    ['Trocas cheias', () => wc.__convTrocas()],
    ['Convidados +1 h', () => wc.__convHoras(1)],
    ['Convidados +24 h', () => wc.__convHoras(24)],
    ['Faixa do MC V.V agora', () => wc.__faixaAgora()],
  ];
  for (const [nome, f] of conv) {
    const b = document.createElement('button');
    b.textContent = nome;
    b.style.cssText = 'padding:6px 8px;background:#8E0B20;color:#fff;border:0;cursor:pointer';
    b.addEventListener('click', () => void f());
    painel.append(b);
  }
  // Mapa do rolê: era 4 (1 de cada gerador até a era 4) e F$ de sobra pra abrir os lugares; moeda pra subir de nível
  const mapa: [string, () => Promise<void>][] = [
    ['Mapa: era 4 + F$', async () => {
      await dono(`update public.idle_state s set valuation = 1e15, generators = (
          select array_agg(case when exists (select 1 from public.idle_cat_gen c where c.id = x.i and c.era <= 4) then greatest(x.g, 1) else x.g end order by x.i)
            from unnest(s.generators) with ordinality x(g, i)) where user_id = $1`, [ME]);
      document.dispatchEvent(new Event('visibilitychange'));
    }],
    ['Lugares +1.000 moeda', async () => {
      await dono('update public.idle_place_state set moeda = moeda + 1000 where user_id = $1', [ME]);
      document.dispatchEvent(new Event('visibilitychange'));
    }],
    // camisetaria: a coleção rodando "vive" 5 min (ou 30): a produção e a venda andam (o banco recalcula a venda do pronta_em)
    ...([5, 30] as const).map((m): [string, () => Promise<void>] => [`Camisetaria +${m} min`, async () => {
      await dono(`update public.idle_tee_colecoes set criada_em = criada_em - make_interval(mins => $2), pronta_em = pronta_em - make_interval(mins => $2),
        fim_em = fim_em - make_interval(mins => $2) where user_id = $1 and encerrada_em is null and not fas_excesso_pago`, [ME, m]);
      document.dispatchEvent(new Event('visibilitychange'));
    }]),
    // copão: tudo do bar volta 1 dia (a noite de hoje vira a de ontem e fecha; os copões postos estreiam)
    ['Copão −1 dia', async () => {
      await dono(`alter table public.idle_cup_noite_copoes drop constraint if exists idle_cup_noite_copoes_user_id_inicio_fkey,
        add constraint idle_cup_noite_copoes_user_id_inicio_fkey foreign key (user_id, inicio)
        references public.idle_cup_noites (user_id, inicio) on delete cascade on update cascade`, []);
      await dono(`update public.idle_cup_copoes set entrou_em = entrou_em - interval '1 day', primeira_noite = primeira_noite - interval '1 day',
        saiu_em = saiu_em - interval '1 day' where user_id = $1`, [ME]);
      await dono(`update public.idle_cup_noites set inicio = inicio - interval '1 day' where user_id = $1`, [ME]);
      await dono(`update public.idle_place_state set aberto_em = aberto_em - interval '1 day' where user_id = $1 and lugar = 4`, [ME]);
      document.dispatchEvent(new Event('visibilitychange'));
    }],
    // copão: as provas andam 5 min (a que estava provando fica pronta) ou 1 dia (o limite de 6 libera)
    ...([['Provas +5 min', '5 minutes'], ['Provas +1 dia', '1 day']] as const).map(([nome, quanto]): [string, () => Promise<void>] => [nome, async () => {
      await dono(`update public.idle_cup_provas set criado_em = criado_em - $2::interval, pronta_em = pronta_em - $2::interval where user_id = $1`, [ME, quanto]);
      document.dispatchEvent(new Event('visibilitychange'));
    }]),
  ];
  for (const [nome, f] of mapa) {
    const b = document.createElement('button');
    b.textContent = nome;
    b.style.cssText = 'padding:6px 8px;background:#8A6A12;color:#fff;border:0;cursor:pointer';
    b.addEventListener('click', () => void f());
    painel.append(b);
  }
  // fechado por padrão (um botãozinho no canto), pra não cobrir a Caixinha; abre e fecha no clique
  const t = document.createElement('button');
  t.style.cssText = 'padding:6px 8px;background:#333;color:#ddd;border:0;cursor:pointer';
  const botoes = [...painel.children] as HTMLElement[];
  const abrir = (aberto: boolean) => {
    t.textContent = aberto ? 'mock ◂' : 'mock ▸';
    for (const b of botoes) b.style.display = aberto ? '' : 'none';
  };
  let aberto = false;
  t.addEventListener('click', () => abrir((aberto = !aberto)));
  abrir(false);
  painel.prepend(t);
  document.body.append(painel);
}
w.__trader = async (n = 3) => {
  // os traders e um pouco de cada gerador ligado às empresas (o limite de cada uma cresce com ele)
  await dono(`update public.idle_state set generators[19] = $2, generators[18] = greatest(generators[18], 1),
    generators[11] = greatest(generators[11], 20), generators[16] = greatest(generators[16], 5), valuation = 1e15 where user_id = $1`, [ME, n]);
  document.dispatchEvent(new Event('visibilitychange'));
};
