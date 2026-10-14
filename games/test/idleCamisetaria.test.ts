// Camisetaria (0067, lugar 3 do Mapa do rolê): migrações reais no PGlite. As contas do banco batem com camisetaria.ts
// (paridade com semente fixa); o relógio fica parado numa quarta à tarde (o now() do PGlite segue o Date falso).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LugarEstado } from '../shared/types';
import {
  CONFLITOS, CORES, CRESCE, custoLote, distanciaFoco, ESTILOS, FAS_TETO, fasExcesso, fasNota, liberado, notas, PECAS, pctProcura,
  pecasLote, pecaTema, pesoVenda, PRECO_MULT, precoPeca, precoRelatorio, procura, PUBLICO_BASE, publico, rotulo, saldao, TEMAS,
  tendencia, vendidoAte, type Lancamento,
} from '../idle/camisetaria';
import { freshDb, quartaATarde, type TestDb } from './db';

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const H = 3600_000;
const MIN = 60_000;

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;
let agora = 0;
const andar = (ms: number) => { agora += ms; vi.setSystemTime(agora); };

// gerador pseudoaleatório fixo: os mesmos casos toda vez
function rng(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}
const ent = (r: () => number, a: number, b: number) => a + Math.floor(r() * (b - a + 1));
const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(1e-300, Math.abs(b));

type Colecao = {
  id: number; nome: string; tema: number; estilo: number; peca: number; cor: number; arte: number; tecido: number; div: number;
  lote: number; nivel: number; pecas: number; custo: number; tendencia: number; rotulo: number; peca_tema: number; notas: number[];
  media: number; procura: number; pct: number; criada_em: Date; pronta_em: Date; fim_em: Date; encerrada_em: Date | null;
  vendido: number; fiado: boolean; revelada: boolean;
};
type Ativa = Record<string, unknown> & { id: number; notas: number[] | null; media: number | null; pct: number | null; procura: number | null; rotulo: number | null };
type Tee = {
  tendencia: number; lotes: number[]; precos: { relatorio: number }; ativa: Ativa | null; ultimo_fiado: string | null; ultima: Ativa | null;
  historico: { id: number; nome: string; tema: number; estilo: number; peca: number; cor: number; notas: number[]; pct: number }[];
  semana: number;
};
type Resp = { lugar: LugarEstado & { mecanica: Tee }; marcos_novos: number[] };

type Opcoes = { tema: number; estilo: number; peca: number; cor: number; arte: number; tecido: number; div: number; lote: number; nome: string };
const PADRAO: Opcoes = { tema: 1, estilo: 1, peca: 1, cor: 1, arte: 3, tecido: 5, div: 2, lote: 1, nome: 'Drop Meme' };
const lancar = (o: Partial<Opcoes> = {}) => {
  const x = { ...PADRAO, ...o };
  return t.rpc<Resp>('idle_tee_lancar', {
    p_tema: x.tema, p_estilo: x.estilo, p_peca: x.peca, p_cor: x.cor, p_arte: x.arte, p_tecido: x.tecido, p_div: x.div, p_lote: x.lote, p_nome: x.nome,
  });
};
const lugar = () => t.rpc<LugarEstado & { mecanica: Tee }>('idle_lugar', { p_lugar: 3 });
const colecoes = () => q<Colecao>(
  `select id::int as id, nome, tema, estilo, peca, cor, arte, tecido, div, lote, nivel, pecas, custo, tendencia, rotulo, peca_tema, notas,
          media, procura, pct, criada_em, pronta_em, fim_em, encerrada_em, vendido, fiado, revelada
     from public.idle_tee_colecoes where user_id = $1 order by criada_em, id`, [A]);
const cupons = async () => (await q<{ m: number }>('select moeda as m from public.idle_place_state where user_id = $1 and lugar = 3', [A]))[0]?.m;
const setCupons = (m: number) => q('update public.idle_place_state set moeda = $2 where user_id = $1 and lugar = 3', [A, m]);
const semana = async () => (await q<{ s: string }>('select public.games_week_start()::text as s'))[0].s;
/** A com a camisetaria aberta no nível `nivel` e `moeda` cupons. */
async function camisetaria(moeda = 1e6, nivel = 1) {
  await q(`update public.idle_state set valuation = 1e15, generators[1] = 50, generators[7] = 1, strategies = '{0,0,0,0}',
             settled_at = now() + interval '1 day' where user_id = $1`, [A]);
  await t.rpc('idle_place_abrir', { p_lugar: 3 });
  await q('update public.idle_place_state set moeda = $2, nivel = $3 where user_id = $1 and lugar = 3', [A, moeda, nivel]);
}
/** A coleção ativa acaba (fechada na mão, como o encerrar da parte B). */
const fechar = () => q('update public.idle_tee_colecoes set encerrada_em = now() where user_id = $1 and encerrada_em is null', [A]);

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  agora = quartaATarde().getTime();
  vi.setSystemTime(agora);
  t = await freshDb({ conquistas: true });
  await t.member(A);
  await t.member(B);
  await t.as(A);
  await t.rpc('idle_start');
});
afterEach(() => vi.useRealTimers());

describe('catálogo', () => {
  it('o banco tem os mesmos temas, estilos, peças, cores, conflitos e constantes de camisetaria.ts', async () => {
    const temas = await q<Record<string, unknown>>('select * from public.idle_tee_cat_tema order by id');
    expect(temas.map((r) => ({ id: r.id, nome: r.nome, vibes: r.vibes, nivel: r.nivel }))).toEqual(TEMAS.map((x) => ({ ...x, vibes: [...x.vibes] })));
    const estilos = await q<Record<string, unknown>>('select * from public.idle_tee_cat_estilo order by id');
    expect(estilos.map((r) => ({ id: r.id, nome: r.nome, vibes: r.vibes, foco: r.foco, nivel: r.nivel })))
      .toEqual(ESTILOS.map((x) => ({ ...x, vibes: [...x.vibes], foco: [...x.foco] })));
    const pecas = await q<Record<string, unknown>>('select * from public.idle_tee_cat_peca order by id');
    expect(pecas.map((r) => ({ id: r.id, nome: r.nome, custo: r.custo, mult: r.mult, gosta: r.gosta, odeia: r.odeia, nivel: r.nivel })))
      .toEqual(PECAS.map((x) => ({ ...x, gosta: [...x.gosta], odeia: [...x.odeia] })));
    const cores = await q<Record<string, unknown>>('select * from public.idle_tee_cat_cor order by id');
    expect(cores.map((r) => ({ id: r.id, nome: r.nome, hex: r.hex, forte: r.forte, nivel: r.nivel }))).toEqual(CORES.map((x) => ({ ...x })));
    const conflitos = await q<{ a: string; b: string }>('select a, b from public.idle_tee_cat_conflito order by a, b');
    expect(conflitos.map((c) => [c.a, c.b])).toEqual(CONFLITOS.map(([a, b]) => [a, b]).sort((x, y) => (x[0] + ' ' + x[1]).localeCompare(y[0] + ' ' + y[1])));
    expect(await q('select publico_base, cresce, preco_mult, fas_teto from public.idle_tee_const')).toEqual([
      { publico_base: PUBLICO_BASE, cresce: CRESCE, preco_mult: PRECO_MULT, fas_teto: FAS_TETO },
    ]);
  });
  it('os 12 desafios da camisetaria (302 e 312 com 300% e 600%)', async () => {
    const d = await q<{ id: number; tipo: string; valor: number; premio: string; premio_valor: number; texto: string }>(
      'select id, tipo, valor, premio, premio_valor, texto from public.idle_cat_place_desafio where lugar = 3 order by id');
    expect(d.map((x) => [x.id, x.tipo, x.valor, x.premio, x.premio_valor])).toEqual([
      [301, 'tee_nota', 8, 'horas', 2], [302, 'tee_pct', 300, 'horas', 3], [303, 'tee_esgotou_grande', 1, 'legado', 2],
      [304, 'tee_tendencia', 7, 'horas', 2], [305, 'tee_quatro', 8, 'legado', 3], [306, 'tee_luis', 9, 'investidor', 1],
      [307, 'tee_resenha', 10, 'horas', 2], [308, 'tee_mauro', 10, 'horas', 2], [309, 'tee_otima', 1, 'legado', 2],
      [310, 'tee_moletom', 7, 'legado', 3], [311, 'tee_colecoes', 3, 'horas', 3], [312, 'tee_pct', 600, 'investidor', 1],
    ]);
    expect(d.find((x) => x.id === 302)!.texto).toBe('Coleção com 300% de procura');
    expect(d.find((x) => x.id === 312)!.texto).toBe('Coleção com 600% de procura');
    expect(d.find((x) => x.id === 303)!.texto).toBe('Lote grande com procura pra esgotar'); // julgado na revelação, pela procura
  });
  it('catálogo, coleções e ajudantes ficam escondidos de quem joga', async () => {
    for (const tab of ['idle_tee_cat_tema', 'idle_tee_cat_estilo', 'idle_tee_cat_peca', 'idle_tee_cat_cor', 'idle_tee_cat_conflito', 'idle_tee_const', 'idle_tee_colecoes']) {
      await expect(t.asRole('authenticated', `select * from public.${tab}`)).rejects.toThrow();
    }
    for (const sql of [
      'select public.idle_tee_rotulo(1, 1)', 'select public.idle_tee_peca_tema(1, 1)', 'select public.idle_tee_distancia(1, 3, 5, 2)',
      `select public.idle_tee_notas(1, 1, 1, 1, 1, 3, 5, 2, 1, '{}', '{}')`, 'select public.idle_tee_pecas_lote(1, 1)',
      'select public.idle_tee_custo_lote(1, 1, 1)', 'select public.idle_tee_publico(1)', `select public.idle_tee_procura(1, 1, 0, '{5,5,5,5}')`,
      `select public.idle_tee_pct_procura(1, 1, 0, '{5,5,5,5}')`, 'select public.idle_tee_preco_relatorio(1)',
      'select public.idle_tee_peso(now(), now())', 'select public.idle_tee_vendido_ate(1, now(), now())',
      'select public.idle_tee_vendido_ate(1, now(), now(), now())',
      'select public.idle_tee_tendencia(current_date)', `select public.idle_tee_liberado('tema', 1, 1)`,
      'select public.idle_tee_saldao(10, 5, 1, false)',
      `select public.idle_tee_json(s) from public.idle_state s`,
    ]) {
      await expect(t.asRole('authenticated', sql), sql).rejects.toThrow(/permission denied/);
    }
  });
});

describe('paridade TS × SQL', () => {
  it('200 lançamentos com semente fixa: rótulo, peça × tema, distância e notas exatos; procura e % com erro < 1e-9', async () => {
    const r = rng(2026);
    const OTIMAS = TEMAS.flatMap((tm) => ESTILOS.filter((es) => rotulo(tm.id, es.id) === 4).map((es) => [tm.id, es.id] as const));
    const visto = { rep20: 0, rep10: 0, luis: 0, tendencia: 0, teto: 0, nota1: 0, nota10: 0 };
    for (let i = 0; i < 200; i++) {
      // um quarto dos casos numa combinação ótima (o ramo do @luisviton precisa dela e do foco certeiro)
      const [tema, estilo] = r() < 0.25 ? OTIMAS[ent(r, 0, OTIMAS.length - 1)] : [ent(r, 1, 30), ent(r, 1, 15)];
      let foco: [number, number, number];
      if (r() < 0.3) foco = [...ESTILOS[estilo - 1].foco];
      else { const a = ent(r, 0, 10); const tc = ent(r, 0, 10 - a); foco = [a, tc, 10 - a - tc]; }
      const n = ent(r, 0, 4);
      const ultimas = Array.from({ length: n }, () => (r() < 0.3 ? { tema, estilo: r() < 0.5 ? estilo : ent(r, 1, 15) } : { tema: ent(r, 1, 30), estilo: r() < 0.3 ? estilo : ent(r, 1, 15) }));
      const l: Lancamento = {
        id: ent(r, 1, 50_000_000), tema, estilo, peca: ent(r, 1, 6), cor: ent(r, 1, 12), foco, lote: ent(r, 0, 2) as 0 | 1 | 2,
        nivel: ent(r, 1, 25), fas: r() < 0.3 ? 0 : Math.floor(r() ** 2 * 50_000), tendencia: r() < 0.3 ? tema : ent(r, 1, 30), ultimas,
      };
      const ns = notas(l);
      const u3 = ultimas.slice(0, 3);
      if (u3.some((u) => u.tema === tema && u.estilo === estilo)) visto.rep20++;
      else if (ultimas[0] && (ultimas[0].tema === tema || ultimas[0].estilo === estilo)) visto.rep10++;
      if (rotulo(tema, estilo) === 4 && distanciaFoco(estilo, foco) <= 1) visto.luis++;
      if (tema === l.tendencia) visto.tendencia++;
      if (Math.sqrt(l.fas) / 30 > FAS_TETO) visto.teto++;
      if (ns.includes(1)) visto.nota1++;
      if (ns.includes(10)) visto.nota10++;
      const [x] = await q<{ rot: number; pt: number; dist: number; notas: number[]; procura: number; pct: number }>(
        `select public.idle_tee_rotulo($2, $3) as rot, public.idle_tee_peca_tema($4, $2) as pt, public.idle_tee_distancia($3, $6, $7, $8) as dist,
                public.idle_tee_notas($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::int[], $11::int[]) as notas,
                public.idle_tee_procura($12, $4, $13, $14::int[]) as procura, public.idle_tee_pct_procura($12, $4, $13, $14::int[]) as pct`,
        [l.id, tema, estilo, l.peca, l.cor, foco[0], foco[1], foco[2], l.tendencia, ultimas.map((u) => u.tema), ultimas.map((u) => u.estilo), l.nivel, l.fas, ns]);
      const caso = JSON.stringify(l);
      expect(x.rot, caso).toBe(rotulo(tema, estilo));
      expect(x.pt, caso).toBe(pecaTema(l.peca, tema));
      expect(x.dist, caso).toBe(distanciaFoco(estilo, foco));
      expect(x.notas, caso).toEqual(ns);
      expect(rel(x.procura, procura(l, ns)), caso).toBeLessThan(1e-9);
      expect(rel(x.pct, pctProcura(l, ns)), caso).toBeLessThan(1e-9);
    }
    // os casos passam por todos os ramos (repetição, @luisviton, tema da semana, teto dos fãs, notas presas em 1 e 10)
    for (const [ramo, n] of Object.entries(visto)) expect(n, ramo).toBeGreaterThan(3);
  });
  it('todos os pares tema × estilo dão o mesmo rótulo', async () => {
    const rows = await q<{ t: number; e: number; r: number }>(
      'select t.id as t, e.id as e, public.idle_tee_rotulo(t.id, e.id) as r from public.idle_tee_cat_tema t cross join public.idle_tee_cat_estilo e');
    expect(rows).toHaveLength(450);
    for (const x of rows) expect(x.r, `${x.t}×${x.e}`).toBe(rotulo(x.t, x.e));
  });
  it('lote, custo, público e relatório em todos os níveis; o que libera em cada nível', async () => {
    const rows = await q<{ n: number; l: number; pecas: number; custo: number; pub: number; rel: number }>(
      `select n, l, public.idle_tee_pecas_lote(n, l) as pecas, public.idle_tee_custo_lote(6, n, l) as custo,
              public.idle_tee_publico(n) as pub, public.idle_tee_preco_relatorio(n) as rel
         from generate_series(1, 25) n cross join generate_series(0, 2) l order by n, l`);
    for (const x of rows) {
      const lote = x.l as 0 | 1 | 2;
      expect(x.pecas).toBe(pecasLote(x.n, lote));
      expect(x.custo).toBe(custoLote(6, x.n, lote));
      expect(rel(x.pub, publico(x.n))).toBeLessThan(1e-12);
      expect(rel(x.rel, precoRelatorio(x.n))).toBeLessThan(1e-12);
    }
    const lib = await q<{ tipo: 'tema' | 'estilo' | 'peca' | 'cor'; id: number; n: number; ok: boolean }>(
      `select x.tipo, x.id, n, public.idle_tee_liberado(x.tipo, x.id, n) as ok
         from (select 'tema' as tipo, id from public.idle_tee_cat_tema union all select 'estilo', id from public.idle_tee_cat_estilo
               union all select 'peca', id from public.idle_tee_cat_peca union all select 'cor', id from public.idle_tee_cat_cor) x
        cross join generate_series(1, 25) n`);
    expect(lib).toHaveLength((30 + 15 + 6 + 12) * 25);
    for (const x of lib) expect(x.ok, `${x.tipo}:${x.id}@${x.n}`).toBe(liberado(x.tipo, x.id, x.n));
  });
  it('peso da venda e vendido em 200 intervalos (atravessando os shows de sexta e sábado)', async () => {
    const r = rng(77);
    const segunda = Date.UTC(2026, 9, 12, 3); // segunda 12/10 00h de Brasília
    let noShow = 0;
    for (let i = 0; i < 200; i++) {
      const a = segunda - 7 * 24 * H + Math.floor(r() * 21 * 24 * H);
      const b = a + Math.floor(r() * 30 * H);
      const pronta = a;
      const tt = pronta - 2 * H + Math.floor(r() * 16 * H);
      const total = Math.floor(r() * 5000) + r();
      const [x] = await q<{ p: number; v: number }>(
        'select public.idle_tee_peso($1::timestamptz, $2::timestamptz) as p, public.idle_tee_vendido_ate($3, $1::timestamptz, $4::timestamptz) as v',
        [new Date(a).toISOString(), new Date(b).toISOString(), total, new Date(tt).toISOString()]);
      expect(x.p, `${a} ${b}`).toBe(pesoVenda(a, b));
      if (pesoVenda(a, b) > b - a) noShow++;
      expect(rel(x.v, vendidoAte(total, pronta, tt)), `${pronta} ${tt}`).toBeLessThan(1e-12);
    }
    expect(noShow).toBeGreaterThan(20); // boa parte atravessa um show
    // com o fim da coleção (as de antes da 0069 vendem até o fim_em delas)
    for (let i = 0; i < 100; i++) {
      const pronta = segunda - 7 * 24 * H + Math.floor(r() * 21 * 24 * H);
      const fim = pronta + (r() < 0.5 ? 12 * H : 30 * MIN + Math.floor(r() * 12 * H));
      const tt = pronta - H + Math.floor(r() * 15 * H);
      const total = Math.floor(r() * 5000) + r();
      const [x] = await q<{ v: number }>('select public.idle_tee_vendido_ate($1, $2::timestamptz, $3::timestamptz, $4::timestamptz) as v',
        [total, new Date(pronta).toISOString(), new Date(fim).toISOString(), new Date(tt).toISOString()]);
      expect(rel(x.v, vendidoAte(total, pronta, tt, fim)), `${pronta} ${fim} ${tt}`).toBeLessThan(1e-12);
    }
    // sexta 18h às sábado 2h de Brasília: 8 h que pesam 16
    const sexta = segunda + 4 * 24 * H + 18 * H;
    const [x] = await q<{ p: number }>('select public.idle_tee_peso($1::timestamptz, $2::timestamptz) as p',
      [new Date(sexta).toISOString(), new Date(sexta + 8 * H).toISOString()]);
    expect(x.p).toBe(16 * H);
    expect(pesoVenda(sexta, sexta + 8 * H)).toBe(16 * H);
    // no fim da venda, o vendido é exatamente o total
    const [y] = await q<{ v: number }>(`select public.idle_tee_vendido_ate(1234.5, $1::timestamptz, $1::timestamptz + interval '13 hours') as v`,
      [new Date(sexta - 3 * H).toISOString()]);
    expect(y.v).toBe(1234.5);
  });
  it('tema da semana igual ao de camisetaria.ts por 60 semanas', async () => {
    const rows = await q<{ s: string; t: number }>(
      `select (date '2026-01-05' + 7 * k)::text as s, public.idle_tee_tendencia(date '2026-01-05' + 7 * k) as t from generate_series(0, 59) k`);
    for (const x of rows) expect(x.t, x.s).toBe(tendencia(x.s));
  });
});

describe('lançar', () => {
  it('grava tudo calculado (igual a camisetaria.ts), desconta o cupom e devolve o lugar', async () => {
    await camisetaria(1000);
    const resp = await lancar();
    const [c] = await colecoes();
    const sem = await semana();
    const l: Lancamento = { id: c.id, tema: 1, estilo: 1, peca: 1, cor: 1, foco: [3, 5, 2], lote: 1, nivel: 1, fas: 0, tendencia: tendencia(sem), ultimas: [] };
    const ns = notas(l);
    expect(c).toMatchObject({
      nome: 'Drop Meme', tema: 1, estilo: 1, peca: 1, cor: 1, arte: 3, tecido: 5, div: 2, lote: 1, nivel: 1, pecas: pecasLote(1, 1),
      custo: custoLote(1, 1, 1), tendencia: tendencia(sem), rotulo: rotulo(1, 1), peca_tema: pecaTema(1, 1), notas: ns,
      media: ns.reduce((a, b) => a + b, 0) / 4, encerrada_em: null, vendido: 0, fiado: false, revelada: false,
    });
    expect(rel(c.procura, procura(l, ns))).toBeLessThan(1e-9);
    expect(rel(c.pct, pctProcura(l, ns))).toBeLessThan(1e-9);
    expect(c.criada_em.getTime()).toBe(agora);
    expect(c.pronta_em.getTime()).toBe(agora + 5 * MIN); // 0069: médio em 5 min, venda de 30 min
    expect(c.fim_em.getTime()).toBe(agora + 35 * MIN);
    expect(await cupons()).toBe(1000 - 108);
    expect(resp.lugar.moeda).toBe(1000 - 108);
    expect(resp.lugar.mecanica.ativa).toMatchObject({ id: c.id, nome: 'Drop Meme', notas: null });
    expect(resp.marcos_novos).toEqual([]);
  });
  it('lote pequeno 2 min, grande 10 min; nome sem espaço nas pontas; fãs e nível entram na conta', async () => {
    await camisetaria(1e6, 4);
    await q('update public.idle_place_state set fas = 2500 where user_id = $1 and lugar = 3', [A]);
    await lancar({ lote: 2, peca: 3, tema: 9, nome: '  Crise  ' });
    let [c] = await colecoes();
    expect(c.nome).toBe('Crise');
    expect(c.pronta_em.getTime() - c.criada_em.getTime()).toBe(10 * MIN);
    expect(c.fim_em.getTime() - c.pronta_em.getTime()).toBe(30 * MIN);
    expect(c.pecas).toBe(pecasLote(4, 2));
    const l: Lancamento = { id: c.id, tema: 9, estilo: 1, peca: 3, cor: 1, foco: [3, 5, 2], lote: 2, nivel: 4, fas: 2500, tendencia: c.tendencia, ultimas: [] };
    expect(rel(c.procura, procura(l, notas(l)))).toBeLessThan(1e-9);
    expect(await cupons()).toBe(1e6 - custoLote(3, 4, 2));
    await fechar();
    await lancar({ lote: 0 });
    c = (await colecoes())[1];
    expect(c.pronta_em.getTime() - c.criada_em.getTime()).toBe(2 * MIN);
  });
  it('as últimas 3 coleções (a mais recente primeiro) entram na repetição, igual ao TS', async () => {
    await camisetaria();
    const feitas: { tema: number; estilo: number }[] = [];
    for (const [tema, estilo] of [[1, 1], [2, 2], [3, 3], [5, 3], [2, 2], [2, 1], [1, 1], [4, 2]]) {
      andar(60_000);
      await lancar({ tema, estilo });
      const cs = await colecoes();
      const c = cs[cs.length - 1];
      const l: Lancamento = { id: c.id, tema, estilo, peca: 1, cor: 1, foco: [3, 5, 2], lote: 1, nivel: 1, fas: 0, tendencia: c.tendencia, ultimas: [...feitas].reverse() };
      expect(c.notas, `${tema}/${estilo}`).toEqual(notas(l));
      feitas.push({ tema, estilo });
      await fechar();
    }
  });
  it('recusas: cada uma com o erro certo e nada gravado', async () => {
    await camisetaria(1000);
    const nada = async () => {
      expect(await colecoes()).toHaveLength(0);
      expect(await cupons()).toBe(1000);
    };
    for (const [o, erro] of [
      [{ tema: 7 }, /idle_tee_trancado/], [{ estilo: 4 }, /idle_tee_trancado/], [{ peca: 3 }, /idle_tee_trancado/], [{ cor: 5 }, /idle_tee_trancado/],
      [{ tema: 31 }, /idle_bad_choice/], [{ estilo: 0 }, /idle_bad_choice/], [{ peca: 7 }, /idle_bad_choice/], [{ cor: 13 }, /idle_bad_choice/],
      [{ arte: 3, tecido: 5, div: 1 }, /idle_tee_foco/], [{ arte: -1, tecido: 6, div: 5 }, /idle_tee_foco/], [{ arte: 11, tecido: -1, div: 0 }, /idle_tee_foco/],
      [{ lote: 3 }, /idle_bad_choice/], [{ lote: -1 }, /idle_bad_choice/],
      [{ nome: '   ' }, /idle_lugar_nome/], [{ nome: 'x'.repeat(31) }, /idle_lugar_nome/],
    ] as [Partial<Opcoes>, RegExp][]) {
      await expect(lancar(o), JSON.stringify(o)).rejects.toThrow(erro);
      await nada();
    }
    await setCupons(107);
    await expect(lancar({ lote: 1 })).rejects.toThrow(/idle_lugar_moeda/);
    expect(await colecoes()).toHaveLength(0);
    expect(await cupons()).toBe(107);
  });
  it('com coleção rodando: idle_tee_ocupada; depois do fim da venda (ou encerrada) libera', async () => {
    await camisetaria();
    await lancar();
    await expect(lancar({ tema: 2 })).rejects.toThrow(/idle_tee_ocupada/);
    andar(5 * MIN + 1); // pronta, à venda
    await expect(lancar({ tema: 2 })).rejects.toThrow(/idle_tee_ocupada/);
    expect(await colecoes()).toHaveLength(1);
    andar(30 * MIN); // a venda acabou
    await lancar({ tema: 2 });
    await fechar();
    await lancar({ tema: 3 });
    expect(await colecoes()).toHaveLength(3);
  });
  it('lugar fechado: idle_lugar_fechado', async () => {
    await expect(lancar()).rejects.toThrow(/idle_lugar_fechado/);
    await t.as(B);
    await expect(lancar()).rejects.toThrow(/idle_lugar_fechado/);
  });
  it('trancado pelo nível libera quando o lugar sobe', async () => {
    await camisetaria(1e6, 2);
    await lancar({ tema: 7, estilo: 4 });
    expect((await colecoes())[0]).toMatchObject({ tema: 7, estilo: 4, nivel: 2 });
  });
});

describe('o fornecedor fia', () => {
  it('sem cupom pro lote pequeno: o pequeno sai de graça, uma vez a cada 24 h', async () => {
    await camisetaria(0);
    await expect(lancar({ lote: 1 })).rejects.toThrow(/idle_lugar_moeda/);
    await lancar({ lote: 0 });
    expect((await colecoes())[0]).toMatchObject({ lote: 0, fiado: true, custo: 0, pecas: 12 });
    expect(await cupons()).toBe(0);
    expect((await lugar()).mecanica.ultimo_fiado).not.toBeNull();
    await fechar();
    andar(23 * H);
    await expect(lancar({ lote: 0 })).rejects.toThrow(/idle_lugar_moeda/);
    andar(H);
    await lancar({ lote: 0 });
    expect((await colecoes()).map((c) => c.fiado)).toEqual([true, true]);
  });
  it('com cupom pro pequeno da peça escolhida, paga (não fia)', async () => {
    await camisetaria(36);
    await lancar({ lote: 0 });
    expect((await colecoes())[0]).toMatchObject({ fiado: false, custo: 36 });
    expect(await cupons()).toBe(0);
  });
  it('a peça escolhida decide: 30 cupons pagam o pequeno de ecobag (24) e não o de camiseta (36)', async () => {
    await camisetaria(30);
    await lancar({ lote: 0, peca: 2 });
    expect((await colecoes())[0]).toMatchObject({ fiado: false, custo: 24 });
    await fechar();
    await lancar({ lote: 0, peca: 1 }); // 6 cupons: fia a camiseta
    expect((await colecoes())[1]).toMatchObject({ fiado: true, custo: 0 });
    expect(await cupons()).toBe(6);
  });
});

describe('o JSON da camisetaria', () => {
  it('lugar fechado: sem mecânica', async () => {
    expect((await lugar()).mecanica).toBeNull();
  });
  it('tema da semana, lotes, relatório e nenhuma coleção', async () => {
    await camisetaria(1000, 3);
    const m = (await lugar()).mecanica;
    expect(m).toMatchObject({ tendencia: tendencia(await semana()), lotes: [pecasLote(3, 0), pecasLote(3, 1), pecasLote(3, 2)], ativa: null, historico: [], semana: 0, ultimo_fiado: null });
    expect(rel(m.precos.relatorio, precoRelatorio(3))).toBeLessThan(1e-12);
  });
  it('esconde notas, média, procura, % e rótulo até ficar pronta', async () => {
    await camisetaria();
    await lancar();
    let a = (await lugar()).mecanica.ativa!;
    expect(a).toMatchObject({ notas: null, media: null, pct: null, procura: null, rotulo: null, peca_tema: null, nome: 'Drop Meme', lote: 1, pecas: 36 });
    expect(a.pronta).toBe(false);
    andar(5 * MIN - 1);
    expect((await lugar()).mecanica.ativa!.notas).toBeNull();
    andar(1);
    a = (await lugar()).mecanica.ativa!;
    const [c] = await colecoes();
    expect(a).toMatchObject({ pronta: true, notas: c.notas, media: c.media, pct: c.pct, procura: c.procura, rotulo: c.rotulo, peca_tema: c.peca_tema });
    expect((await lugar()).mecanica.semana).toBe(1);
  });
  it('histórico: as reveladas, a mais recente primeiro (até 10)', async () => {
    await camisetaria();
    for (let i = 1; i <= 12; i++) {
      andar(60_000);
      await lancar({ tema: (i % 6) + 1, nome: `Coleção ${i}` });
      await fechar();
    }
    await q('update public.idle_tee_colecoes set revelada = true where user_id = $1 and nome <> $2', [A, 'Coleção 12']);
    const m = (await lugar()).mecanica;
    expect(m.ativa).toBeNull();
    expect(m.historico.map((h) => h.nome)).toEqual(Array.from({ length: 10 }, (_, k) => `Coleção ${11 - k}`));
    const cs = await colecoes();
    const c11 = cs.find((c) => c.nome === 'Coleção 11')!;
    expect(m.historico[0]).toEqual({ id: c11.id, nome: 'Coleção 11', tema: c11.tema, estilo: 1, peca: 1, cor: 1, notas: c11.notas, pct: c11.pct });
    expect(m.semana).toBe(12);
  });
  it('ultima: a última revelada com tudo, pra a tela mostrar a revelação que aconteceu longe (volta 2 dias depois)', async () => {
    await camisetaria(1000);
    expect((await lugar()).mecanica.ultima).toBeNull();
    await lancar({ nome: 'Sumida' }); // médio: 36 peças, 108 cupons, pronta em 5 min
    await ajustar({ procura: 20 });
    expect((await lugar()).mecanica.ultima).toBeNull(); // em produção: nada revelado
    andar(2 * H + 2 * 24 * H);
    const m = (await lugar()).mecanica;
    expect(m.ativa).toBeNull(); // a venda acabou com a pessoa longe
    const [c] = await colecoes();
    const u = m.ultima!;
    expect(u).toMatchObject({
      id: c.id, nome: 'Sumida', tema: 1, estilo: 1, peca: 1, cor: 1, arte: 3, tecido: 5, div: 2, lote: 1, nivel: 1, pecas: 36, custo: 108,
      fiado: false, tendencia: c.tendencia, rotulo: c.rotulo, peca_tema: c.peca_tema, notas: c.notas, media: c.media, procura: 20,
      pct: c.pct, vendido: 20, encerrada_em: null, pronta: true,
    });
    expect(Date.parse(u.pronta_em as string)).toBe(c.pronta_em.getTime());
    expect(Date.parse(u.fim_em as string)).toBe(c.fim_em.getTime());
    expect(rel(u.receita as number, 20 * precoPeca(1))).toBeLessThan(1e-12);
    expect(rel(u.saldao as number, saldao(108, 36, 20, false))).toBeLessThan(1e-12);
    // é o que entrou: a venda + o saldão
    expect(rel(await cupons(), 1000 - 108 + (u.receita as number) + (u.saldao as number))).toBeLessThan(1e-12);
    // à venda: a última revelada é a ativa, e o saldão ainda é 0
    await lancar({ tema: 2, nome: 'Nova' });
    andar(10 * MIN);
    const m2 = (await lugar()).mecanica;
    expect(m2.ultima).toMatchObject({ id: m2.ativa!.id, nome: 'Nova', saldao: 0 });
  });
  it('ultima encerrada: o saldão do encerrar', async () => {
    await camisetaria(1000);
    await lancar();
    await ajustar({ procura: 10 });
    andar(10 * MIN);
    const r = await t.rpc<Resp>('idle_tee_encerrar');
    const [c] = await colecoes();
    const u = r.lugar.mecanica.ultima!;
    expect(u).toMatchObject({ id: c.id, vendido: c.vendido });
    expect(u.encerrada_em).not.toBeNull();
    expect(rel(u.saldao as number, saldao(108, 36, c.vendido, false))).toBeLessThan(1e-12);
  });
});

// ===== parte B: venda, revelação, caderninho, desafios, encerrar e relatório =====

type Estado = { moeda: number; fas: number; volume: number; lendario: boolean; marcos: number[] };
const estado = async () => (await q<Estado>(
  'select moeda, fas, volume, lendario, marcos from public.idle_place_state where user_id = $1 and lugar = 3', [A]))[0];
const abrirJogo = () => t.rpc('idle_open'); // trava + fecha a conta + salva: só o avancar roda (sem o depois)
const encerrar = () => t.rpc<Resp>('idle_tee_encerrar');
const relatorio = (estilo: number) => t.rpc<Resp>('idle_tee_relatorio', { p_estilo: estilo });
const lugarB = () => t.rpc<LugarEstado & { mecanica: Tee; marcos_novos: number[] }>('idle_lugar', { p_lugar: 3 });
const prods = () => q<{ nome: string; partes: number[]; numero: number; criado_em: Date }>(
  'select nome, partes, numero, criado_em from public.idle_place_prod where user_id = $1 and lugar = 3 order by id', [A]);
const notasCad = () => q<{ tipo: string; a: number; b: number; rotulo: number }>(
  'select tipo, a, b, rotulo from public.idle_place_notes where user_id = $1 and lugar = 3 order by tipo, a, b', [A]);
const conquistas = async () => (await q<{ c: number }>(
  'select conquista_id as c from public.idle_conquistas where user_id = $1 order by 1', [A])).map((x) => x.c);
const daCamisetaria = async () => (await conquistas()).filter((c) => [87, 88, 114].includes(c));
const valuation = async () => (await q<{ v: number }>('select valuation as v from public.idle_state where user_id = $1', [A]))[0].v;
/** Mexe no resultado guardado da última coleção (antes de ficar pronta): notas (e a média junto), %, procura, tema da semana, peça. */
async function ajustar(o: { notas?: number[]; pct?: number; procura?: number; tendencia?: number; peca?: number }) {
  const cs = await colecoes();
  const c = cs[cs.length - 1];
  const ns = o.notas ?? c.notas;
  await q(`update public.idle_tee_colecoes set notas = $2::int[], media = $3, pct = $4, procura = $5, tendencia = $6, peca = $7 where id = $1`,
    [c.id, ns, ns.reduce((a, b) => a + b, 0) / 4, o.pct ?? c.pct, o.procura ?? c.procura, o.tendencia ?? c.tendencia, o.peca ?? c.peca]);
}
const OTIMAS_N1 = TEMAS.filter((tm) => tm.nivel === 1)
  .flatMap((tm) => ESTILOS.filter((es) => es.nivel === 1 && rotulo(tm.id, es.id) === 4).map((es) => [tm.id, es.id] as const));
const NAO_OTIMA_N1 = TEMAS.filter((tm) => tm.nivel === 1)
  .flatMap((tm) => ESTILOS.filter((es) => es.nivel === 1 && rotulo(tm.id, es.id) < 4).map((es) => [tm.id, es.id] as const))[0];

describe('paridade TS × SQL (parte B)', () => {
  it('fãs da nota, fãs do excesso e preço da peça iguais a camisetaria.ts', async () => {
    const rows = await q<{ m: number; n: number; f: number }>(
      `select k / 4.0::double precision as m, n, public.idle_tee_fas_nota(k / 4.0::double precision, n) as f
         from generate_series(4, 40) k cross join generate_series(1, 25) n`);
    expect(rows).toHaveLength(37 * 25);
    for (const x of rows) expect(x.f, `${x.m}@${x.n}`).toBe(fasNota(x.m, x.n));
    const r = rng(5);
    let teto = 0;
    let sobra0 = 0;
    for (let i = 0; i < 200; i++) {
      const nivel = ent(r, 1, 25);
      const estoque = pecasLote(nivel, ent(r, 0, 2) as 0 | 1 | 2);
      const p = r() * estoque * 2.5;
      const [x] = await q<{ f: number }>('select public.idle_tee_fas_excesso($1, $2, $3) as f', [p, estoque, nivel]);
      const esperado = fasExcesso(p, estoque, nivel);
      if (esperado === 0) { sobra0++; expect(x.f).toBe(0); } else expect(rel(x.f, esperado)).toBeLessThan(1e-12);
      if (esperado === publico(nivel) * 0.2) teto++;
    }
    expect(teto).toBeGreaterThan(5);
    expect(sobra0).toBeGreaterThan(5);
    const precos = await q<{ id: number; p: number }>('select id, public.idle_tee_preco_peca(id) as p from public.idle_tee_cat_peca order by id');
    expect(precos.map((x) => x.p)).toEqual(PECAS.map((pc) => precoPeca(pc.id)));
  });
});

describe('a venda (avancar)', () => {
  it('Review Focus 1: lança e some 3 dias: venda termina sozinha, cupom e fãs do excesso entram uma vez, revelação na próxima visita', async () => {
    await camisetaria(1000);
    await lancar({ lote: 0, nome: 'Sumiu' }); // 12 peças, 1 h
    await ajustar({ procura: 30 }); // sobra procura: 18 a mais que o estoque
    const [c] = await colecoes();
    const m0 = await cupons();
    andar(3 * 24 * H);
    await abrirJogo(); // só anda a venda
    let x = (await colecoes())[0];
    expect(x).toMatchObject({ vendido: 12, revelada: false });
    expect(await cupons()).toBeCloseTo(m0 + 12 * precoPeca(1), 9);
    expect((await estado()).fas).toBe(fasExcesso(30, 12, 1));
    expect(await prods()).toEqual([]);
    expect(await notasCad()).toEqual([]);
    expect((await estado()).volume).toBe(0);
    await lugarB(); // a próxima visita revela
    x = (await colecoes())[0];
    expect(x.revelada).toBe(true);
    const ps = await prods();
    expect(ps).toHaveLength(1);
    expect(ps[0]).toMatchObject({ nome: 'Sumiu', partes: [1, 1, 1, 1], numero: c.pct });
    expect(ps[0].criado_em.getTime()).toBe(c.pronta_em.getTime());
    expect(await notasCad()).toEqual([
      { tipo: 'combo', a: 1, b: 1, rotulo: c.rotulo },
      { tipo: 'peca', a: 1, b: 1, rotulo: c.peca_tema + 1 },
    ]);
    const e1 = await estado();
    expect(e1.volume).toBe(1);
    expect(e1.fas).toBe(fasExcesso(30, 12, 1) + fasNota(c.media, 1));
    const m1 = await cupons();
    // mais visitas não pagam nada de novo
    await lugarB();
    andar(H);
    await abrirJogo();
    await lugarB();
    expect(await cupons()).toBe(m1);
    expect(await estado()).toEqual(e1);
    expect(await prods()).toHaveLength(1);
  });
  it('Review Focus 2: venda atravessando sexta 18h (e sábado 2h) segue o peso 2× e termina exatamente em min(procura, estoque)', async () => {
    await camisetaria(1000);
    andar(47 * H + 3 * H + 40 * MIN); // quarta 15h + 50h40 = sexta 17h40 de Brasília
    for (const [rotulo, antes, depois] of [['sexta 18h', 1, 2], ['sábado 2h', 2, 1]] as const) {
      await lancar({ tema: rotulo === 'sexta 18h' ? 1 : 2 }); // médio: pronta 17h45 (01h45), fim 18h15 (02h15)
      const c = (await colecoes()).at(-1)!;
      const total = Math.min(c.procura, c.pecas);
      const pronta = c.pronta_em.getTime();
      expect(new Date(pronta).toISOString(), rotulo).toMatch(rotulo === 'sexta 18h' ? /T20:45:00/ : /T04:45:00/);
      const m0 = await cupons();
      const v: Record<number, number> = {};
      for (const m of [5, 10, 15, 20, 25, 30, 31, 60]) {
        agora = pronta + m * MIN;
        vi.setSystemTime(agora);
        await abrirJogo();
        const x = (await colecoes()).at(-1)!;
        v[m] = x.vendido;
        expect(rel(x.vendido, vendidoAte(total, pronta, agora)), `${rotulo} ${m} min`).toBeLessThan(1e-12);
        // no fim da venda entra também o saldão do estoque que sobrou
        const fimSaldao = m >= 30 ? saldao(c.custo, c.pecas, total, false) : 0;
        expect(rel((await cupons()) - m0, x.vendido * precoPeca(1) + fimSaldao), `${rotulo} ${m} min`).toBeLessThan(1e-9);
      }
      // 15 min com um peso e 15 com o outro: 45 "minutos" de peso no total
      expect(rel(v[5], (total * 5 * antes) / 45)).toBeLessThan(1e-12);
      expect(rel(v[20] - v[15], (total * 5 * depois) / 45)).toBeLessThan(1e-9);
      // no fim, o total (total × peso / peso: igual até o último bit, ou quase)
      for (const m of [30, 31, 60]) expect(rel(v[m], total), `${rotulo} ${m} min`).toBeLessThan(1e-15);
      expect(rel((await cupons()) - m0, total * precoPeca(1) + saldao(c.custo, c.pecas, total, false))).toBeLessThan(1e-12);
      agora = pronta + 8 * H - 5 * MIN; // a próxima: sábado 01h40
      vi.setSystemTime(agora);
    }
  });
  it('coleção que já rodava antes da 0069 (12 h de venda) vende até o fim_em dela', async () => {
    await camisetaria(1000);
    await lancar(); // médio, 36 peças
    await ajustar({ procura: 1000 });
    const [c] = await colecoes();
    // como a 0067 gravava: pronta em 2 h, venda de 12 h
    await q(`update public.idle_tee_colecoes set pronta_em = criada_em + interval '2 hours', fim_em = criada_em + interval '14 hours' where id = $1`, [c.id]);
    const pronta = c.criada_em.getTime() + 2 * H;
    const m0 = await cupons();
    andar(2 * H + 30 * MIN); // meia hora de venda: ainda não acabou
    await abrirJogo();
    let [x] = await colecoes();
    expect(rel(x.vendido, vendidoAte(36, pronta, agora, pronta + 12 * H))).toBeLessThan(1e-12);
    expect(x.vendido).toBeLessThan(36);
    expect((await lugar()).mecanica.ativa).toMatchObject({ id: c.id, pronta: true });
    await expect(lancar({ tema: 2 })).rejects.toThrow(/idle_tee_ocupada/);
    andar(11 * H + 30 * MIN); // o fim da venda dela
    await abrirJogo();
    [x] = await colecoes();
    expect(x.vendido).toBe(36);
    expect(rel((await cupons()) - m0, 36 * precoPeca(1))).toBeLessThan(1e-12);
  });
  it('sem sobra de procura: vende só a procura e não ganha fã de excesso', async () => {
    await camisetaria(1000);
    await lancar({ lote: 2 }); // 84 peças
    await ajustar({ procura: 50, notas: [5, 5, 5, 5] });
    andar(20 * H);
    await abrirJogo();
    expect((await colecoes())[0].vendido).toBe(50);
    expect((await estado()).fas).toBe(0);
  });
  it('fim natural da venda: o estoque que sobrou volta a 50% do custo (o saldão), uma vez só', async () => {
    await camisetaria(1000);
    await lancar({ lote: 2 }); // 84 peças, 252 cupons
    await ajustar({ procura: 50, notas: [5, 5, 5, 5] });
    const m0 = await cupons();
    andar(10 * MIN + 30 * MIN - 1); // um ms antes do fim: ainda sem saldão
    await abrirJogo();
    expect((await cupons()) - m0).toBeLessThan(50 * precoPeca(1) + 1e-9);
    andar(1);
    await abrirJogo();
    expect(saldao(252, 84, 50, false)).toBe(0.5 * 3 * 34);
    const esperado = m0 + 50 * precoPeca(1) + saldao(252, 84, 50, false);
    expect(rel(await cupons(), esperado)).toBeLessThan(1e-12);
    // as próximas visitas (e o depois) não pagam de novo
    await lugarB();
    andar(H);
    await abrirJogo();
    await lugarB();
    expect(rel(await cupons(), esperado)).toBeLessThan(1e-12);
  });
  it('fim natural de lote fiado: sem saldão (custou 0)', async () => {
    await camisetaria(0);
    await lancar({ lote: 0 }); // fiado, 12 peças
    await ajustar({ procura: 5 });
    andar(14 * H);
    await abrirJogo();
    expect(saldao(0, 12, 5, true)).toBe(0);
    expect(rel(await cupons(), 5 * precoPeca(1))).toBeLessThan(1e-12);
  });
  it('marcos de volume, fãs e lendário só saem no depois (idle_lugar), nunca no avancar', async () => {
    await camisetaria(1000);
    await q('update public.idle_place_state set volume = 49, fas = 114990 where user_id = $1 and lugar = 3', [A]);
    await lancar({ lote: 0 });
    await ajustar({ notas: [10, 10, 10, 10], procura: 1000, pct: 50 });
    andar(14 * H);
    await abrirJogo();
    let e = await estado();
    expect(e.fas).toBe(114990 + fasExcesso(1000, 12, 1)); // passou de 115 mil no avancar
    expect(e).toMatchObject({ marcos: [], volume: 49, lendario: false });
    expect(await daCamisetaria()).toEqual([]);
    const r = await lugarB();
    e = await estado();
    expect(e).toMatchObject({ volume: 50, lendario: true });
    expect(e.fas).toBe(114990 + fasExcesso(1000, 12, 1) + fasNota(10, 1));
    expect(r.marcos_novos).toEqual([36, 37, 38]);
    expect(e.marcos).toEqual([36, 37, 38]);
    expect(await daCamisetaria()).toEqual([88]);
  });
});

describe('a revelação (depois)', () => {
  it('conquistas 87 (200% de procura), 88 (quatro dez) e 114 (encalhe, menos de 20%)', async () => {
    await camisetaria(1e6);
    const passo = async (o: Partial<Opcoes>, aj: Parameters<typeof ajustar>[0]) => {
      andar(60_000);
      await lancar({ lote: 0, ...o });
      await ajustar(aj);
      andar(H);
      await lugarB();
      await fechar();
    };
    await passo({}, { pct: 199, notas: [10, 10, 10, 9] });
    expect(await daCamisetaria()).toEqual([]);
    await passo({ tema: 2 }, { pct: 200, notas: [5, 5, 5, 5] });
    expect(await daCamisetaria()).toEqual([87]);
    await passo({ tema: 3 }, { pct: 19.9, notas: [5, 5, 5, 5] });
    expect(await daCamisetaria()).toEqual([87, 114]);
    expect((await estado()).lendario).toBe(false);
    await passo({ tema: 4 }, { pct: 20, notas: [10, 10, 10, 10] });
    expect(await daCamisetaria()).toEqual([87, 88, 114]);
    expect((await estado()).lendario).toBe(true);
  });
  it('revela em ordem várias coleções prontas de uma vez (cada uma com a hora em que ficou pronta)', async () => {
    await camisetaria(1e6);
    await lancar({ lote: 0, nome: 'Primeira' });
    andar(H);
    await abrirJogo(); // só a venda anda
    await fechar();
    andar(H);
    await lancar({ lote: 0, nome: 'Segunda', tema: 2 });
    andar(13 * H);
    await lugarB();
    const cs = await colecoes();
    expect(cs.map((c) => c.revelada)).toEqual([true, true]);
    const ps = await prods();
    expect(ps.map((p) => p.nome)).toEqual(['Primeira', 'Segunda']);
    expect(ps.map((p) => p.criado_em.getTime())).toEqual(cs.map((c) => c.pronta_em.getTime()));
    expect((await estado()).volume).toBe(2);
  });
  it('Review Focus 5: mesmo par numa das 3 últimas derruba 2; só o tema ou só o estilo da última, 1', async () => {
    await camisetaria(1e6);
    const quedas: number[][] = [];
    for (const [tema, estilo] of [[2, 1], [4, 3], [2, 1], [2, 3], [5, 3], [4, 2]]) {
      andar(60_000);
      await lancar({ tema, estilo, lote: 0 });
      const cs = await colecoes();
      const c = cs[cs.length - 1];
      const semRep = notas({ id: c.id, tema, estilo, peca: 1, cor: 1, foco: [3, 5, 2], lote: 0, nivel: 1, fas: 0, tendencia: c.tendencia, ultimas: [] });
      // sem bater no teto nem no chão, a queda é exata
      expect(Math.max(...semRep), `${tema}/${estilo}`).toBeLessThan(10);
      expect(Math.min(...semRep), `${tema}/${estilo}`).toBeGreaterThan(2);
      quedas.push(semRep.map((n, k) => n - c.notas[k]));
      await fechar();
    }
    expect(quedas).toEqual([[0, 0, 0, 0], [0, 0, 0, 0], [2, 2, 2, 2], [1, 1, 1, 1], [1, 1, 1, 1], [0, 0, 0, 0]]);
  });
});

describe('desafios da camisetaria', () => {
  type D = { id: number; lugar: number; tipo: string; valor: number; texto: string; premio: string; premio_valor: number };
  let todos: D[] = [];
  async function soDesafio(id: number) {
    if (todos.length === 0) todos = await q<D>('select * from public.idle_cat_place_desafio where lugar = 3 order by id');
    const d = todos.find((x) => x.id === id)!;
    await q('delete from public.idle_cat_place_desafio where lugar = 3');
    await q(`insert into public.idle_cat_place_desafio (id, lugar, tipo, valor, texto, premio, premio_valor) values ($1, $2, $3, $4, $5, $6, $7)`,
      [d.id, d.lugar, d.tipo, d.valor, d.texto, d.premio, d.premio_valor]);
  }
  const feitos = async () => (await q<{ d: number }>(
    'select desafio as d from public.idle_place_challenges where user_id = $1 and lugar = 3', [A])).map((x) => x.d);
  const limpar = async () => {
    await q('delete from public.idle_place_challenges where user_id = $1', [A]);
    await q('delete from public.idle_tee_colecoes where user_id = $1', [A]);
    await q('delete from public.idle_place_notes where user_id = $1', [A]);
  };
  type Caso = { o?: Partial<Opcoes>; aj?: Parameters<typeof ajustar>[0] };
  async function revelar({ o = {}, aj = {} }: Caso) {
    andar(60_000);
    await lancar({ lote: 0, ...o });
    await ajustar(aj);
    andar(4 * H);
    await lugarB();
    await fechar();
  }
  const [ot, oe] = OTIMAS_N1[0];
  const [nt, ne] = NAO_OTIMA_N1;
  const CASOS: [number, Caso[], Caso][] = [
    [301, [{ aj: { notas: [8, 8, 8, 7] } }], { aj: { notas: [8, 8, 8, 8] } }],
    [302, [{ aj: { pct: 299.9 } }], { aj: { pct: 300 } }],
    [303, [{ o: { lote: 2 }, aj: { procura: 83.9 } }, { o: { lote: 1 }, aj: { procura: 1000 } }], { o: { lote: 2 }, aj: { procura: 84 } }],
    [304, [{ aj: { tendencia: 2, notas: [9, 9, 9, 9] } }, { aj: { tendencia: 1, notas: [7, 7, 7, 6] } }], { aj: { tendencia: 1, notas: [7, 7, 7, 7] } }],
    [305, [{ aj: { notas: [10, 10, 10, 7] } }], { aj: { notas: [8, 8, 8, 8] } }],
    [306, [{ aj: { notas: [9, 9, 9, 8] } }], { aj: { notas: [1, 1, 1, 9] } }],
    [307, [{ aj: { notas: [10, 10, 9, 10] } }], { aj: { notas: [1, 1, 10, 1] } }],
    [308, [{ aj: { notas: [10, 9, 10, 10] } }], { aj: { notas: [1, 10, 1, 1] } }],
    [309, [{ o: { tema: nt, estilo: ne } }], { o: { tema: ot, estilo: oe } }],
    [310, [{ aj: { peca: 1, notas: [10, 10, 10, 10] } }, { aj: { peca: 6, notas: [7, 7, 7, 6] } }], { aj: { peca: 6, notas: [7, 7, 7, 7] } }],
    [311, [{}, {}], {}],
    [312, [{ aj: { pct: 599 } }], { aj: { pct: 600 } }],
  ];
  it('cada tipo com o valor da coleção: o que não alcança não paga, o que alcança paga', async () => {
    expect(OTIMAS_N1.length).toBeGreaterThan(0);
    await camisetaria(1e8);
    for (const [id, nao, sim] of CASOS) {
      await soDesafio(id);
      await limpar();
      for (const caso of nao) {
        await revelar(caso);
        expect(await feitos(), `${id} ${JSON.stringify(caso)}`).toEqual([]);
      }
      await revelar(sim);
      expect(await feitos(), `${id}`).toEqual([id]);
    }
  });
  it('3 coleções na semana: paga no 3º lançamento, sem esperar revelar', async () => {
    await camisetaria(1e8);
    await soDesafio(311);
    for (const k of [1, 2]) {
      andar(60_000);
      await lancar({ lote: 0, tema: k });
      await fechar();
      expect(await feitos(), `${k}`).toEqual([]);
    }
    andar(60_000);
    const v0 = await valuation();
    await lancar({ lote: 0, tema: 3 });
    expect(await feitos()).toEqual([311]);
    expect(await valuation()).toBeGreaterThan(v0);
    andar(H); // revela: confere de novo e não paga outra vez
    await abrirJogo();
    const v1 = await valuation();
    await lugarB();
    expect(await valuation()).toBe(v1);
    expect(await feitos()).toEqual([311]);
  });
  it('combinação ótima só conta quando é nova no caderninho', async () => {
    await camisetaria(1e8);
    await soDesafio(309);
    await revelar({ o: { tema: ot, estilo: oe } });
    expect(await feitos()).toEqual([309]);
    await q('delete from public.idle_place_challenges where user_id = $1', [A]);
    await revelar({ o: { tema: ot, estilo: oe } }); // a mesma de novo: já estava no caderninho
    expect(await feitos()).toEqual([]);
  });
  it('pago uma vez só na semana', async () => {
    await camisetaria(1e8);
    await soDesafio(301);
    const taxa = async () => (await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [A]))[0].r;
    for (const k of [0, 1]) {
      andar(60_000);
      await lancar({ lote: 0, tema: k + 1 });
      await ajustar({ notas: [9, 9, 9, 9] });
      andar(H);
      await abrirJogo(); // fecha a conta até agora (sem o depois)
      const v0 = await valuation();
      await lugarB(); // revela: paga (ou não) o desafio sem passar tempo
      const dv = (await valuation()) - v0;
      if (k === 0) expect(rel(dv, 2 * 3600 * (await taxa()))).toBeLessThan(1e-6); // dv sai de dois números grandes (valuation 1e15)
      else expect(dv).toBe(0);
      await fechar();
    }
    expect(await feitos()).toEqual([301]);
  });
});

describe('encerrar', () => {
  it('Review Focus 3: para a venda na hora, devolve 50% do custo do que sobrou, e não entra mais nada', async () => {
    await camisetaria(1000);
    await lancar(); // 36 peças, 108 cupons
    await expect(encerrar()).rejects.toThrow(/idle_tee_sem_venda/); // ainda em produção
    andar(5 * MIN + 10 * MIN);
    const [c] = await colecoes();
    const vendido = vendidoAte(Math.min(c.procura, c.pecas), c.pronta_em.getTime(), agora);
    const resp = await encerrar();
    const [x] = await colecoes();
    expect(x.encerrada_em!.getTime()).toBe(agora);
    expect(rel(x.vendido, vendido)).toBeLessThan(1e-12);
    const esperado = 1000 - 108 + vendido * precoPeca(1) + 0.5 * (108 / 36) * (36 - vendido);
    expect(rel(await cupons(), esperado)).toBeLessThan(1e-12);
    expect(resp.lugar.mecanica.ativa).toBeNull();
    expect(x.revelada).toBe(true); // o responder revela
    const e = await estado();
    andar(20 * H);
    await lugarB();
    expect((await colecoes())[0].vendido).toBe(x.vendido);
    expect(await estado()).toEqual(e);
    await expect(encerrar()).rejects.toThrow(/idle_tee_sem_venda/);
    await lancar({ tema: 2 }); // livre de novo
  });
  it('encerrou e depois passou do fim: o saldão é pago uma vez só (o do encerrar)', async () => {
    await camisetaria(1000);
    await lancar(); // 36 peças, 108 cupons
    await ajustar({ procura: 10 });
    andar(5 * MIN + 5 * MIN);
    await encerrar();
    const [c] = await colecoes();
    const m1 = await cupons();
    expect(rel(m1, 1000 - 108 + c.vendido * precoPeca(1) + saldao(108, 36, c.vendido, false))).toBeLessThan(1e-12);
    andar(20 * H);
    await abrirJogo();
    await lugarB();
    expect(await cupons()).toBe(m1);
  });
  it('lote fiado não devolve cupom', async () => {
    await camisetaria(0);
    await lancar({ lote: 0 });
    andar(2 * MIN + 5 * MIN);
    const [c] = await colecoes();
    expect(c.fiado).toBe(true);
    const vendido = vendidoAte(Math.min(c.procura, c.pecas), c.pronta_em.getTime(), agora);
    await encerrar();
    expect(rel(await cupons(), vendido * precoPeca(1))).toBeLessThan(1e-12);
  });
  it('depois do fim da venda não tem o que encerrar; lugar fechado: idle_lugar_fechado', async () => {
    await expect(encerrar()).rejects.toThrow(/idle_lugar_fechado/);
    await camisetaria(1000);
    await expect(encerrar()).rejects.toThrow(/idle_tee_sem_venda/);
    await lancar();
    andar(14 * H);
    await expect(encerrar()).rejects.toThrow(/idle_tee_sem_venda/);
  });
});

describe('relatório dos influencers', () => {
  it('só de estilo já lançado, cobra o preço do nível e grava o foco no caderninho', async () => {
    await expect(relatorio(1)).rejects.toThrow(/idle_lugar_fechado/);
    await camisetaria(1000, 2);
    await expect(relatorio(1)).rejects.toThrow(/idle_tee_sem_lancar/);
    await lancar({ estilo: 4 });
    await expect(relatorio(1)).rejects.toThrow(/idle_tee_sem_lancar/);
    await expect(relatorio(99)).rejects.toThrow(/idle_tee_sem_lancar/);
    const m0 = await cupons();
    await setCupons(precoRelatorio(2) - 0.01);
    await expect(relatorio(4)).rejects.toThrow(/idle_lugar_moeda/);
    expect((await notasCad()).filter((n) => n.tipo === 'foco')).toEqual([]);
    await setCupons(m0);
    const resp = await relatorio(4);
    const [a, tc, d] = ESTILOS[3].foco;
    expect((await notasCad()).filter((n) => n.tipo === 'foco')).toEqual([{ tipo: 'foco', a: 4, b: 0, rotulo: a * 100 + tc * 10 + d }]);
    expect(rel(await cupons(), m0 - precoRelatorio(2))).toBeLessThan(1e-12);
    expect(resp.lugar.caderninho).toContainEqual({ tipo: 'foco', a: 4, b: 0, rotulo: 523 });
    // de novo: já tem, não cobra outra vez
    const m1 = await cupons();
    await relatorio(4);
    expect(await cupons()).toBe(m1);
  });
});

describe('acesso (parte B)', () => {
  it('encerrar e relatório só para authenticated; os ajudantes novos ficam escondidos', async () => {
    for (const sql of ['select public.idle_tee_fas_nota(7, 1)', 'select public.idle_tee_fas_excesso(10, 5, 1)', 'select public.idle_tee_preco_peca(1)',
      'select public.idle_tee_avancar(s) from public.idle_state s', 'select public.idle_tee_depois(s) from public.idle_state s']) {
      await expect(t.asRole('authenticated', sql), sql).rejects.toThrow(/permission denied/);
    }
    const priv = await q<{ anon: boolean; auth: boolean }>(
      `select has_function_privilege('anon', f, 'execute') as anon, has_function_privilege('authenticated', f, 'execute') as auth
         from unnest(array['public.idle_tee_lancar(int, int, int, int, int, int, int, int, text)', 'public.idle_tee_encerrar()',
                           'public.idle_tee_relatorio(int)']) f`);
    expect(priv.map((p) => [p.anon, p.auth])).toEqual([[false, true], [false, true], [false, true]]);
  });
});
