// Copão (0068, lugar 4 do Mapa do rolê), parte A: migrações reais no PGlite. As contas do banco batem com copao.ts (a nota
// e as partes dela bit a bit; o que é decimal com erro relativo < 1e-12) e as RPCs de pôr, tirar e escolher o DJ. O relógio
// fica parado numa quarta às 15h de Brasília (o now() do PGlite segue o Date falso).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LugarEstado } from '../shared/types';
import {
  abreNoite, aguenta, ALFA, avaliar, BASES, chancePT, CONFLITOS, CRESCE, custoBeneficio, deuPT, DJS, ehSexta, ELASTICIDADE, EXTRAS,
  fimNoite, GALERA_TETO, galeraNoite, inicioNoite, liberado, lucroVenda, MARKUP, MISTURAS, moda, modaDaSemana, movimento, noiteIdx,
  noitesEntre, novidade, PONTOS, precoFaixa, precoRef, precoValido, publico, PUBLICO_BASE, rotuloPar, rotulos, sabor, sementePT,
  TAMANHOS, TAXA, vagas, vendasNoite, vendidoNaNoite, type Copao, type NoCardapio, type Noite, type Sabor, type TipoPar,
} from '../idle/copao';
import { freshDb, quartaATarde, type TestDb } from './db';

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const H = 3600_000;
const DIA = 24 * H;

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;
let agora = 0;
const andar = (ms: number) => { agora += ms; vi.setSystemTime(agora); };
const iso = (ms: number) => new Date(ms).toISOString();

// gerador pseudoaleatório fixo: os mesmos casos toda vez
function rng(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}
const ent = (r: () => number, a: number, b: number) => a + Math.floor(r() * (b - a + 1));
const rel = (a: number, b: number) => (a === b ? 0 : Math.abs(a - b) / Math.max(1e-300, Math.abs(b)));

type CopaoLinha = {
  id: number; nome: string; base: number; mistura: number; extra: number; tamanho: number; forca: number; preco: number; nivel: number;
  nota: number; sabor: number; cb: number; moda: number; aguenta: number; rot_bm: number; rot_be: number; rot_me: number; chance_pt: number;
  entrou_em: Date; primeira_noite: Date; saiu_em: Date | null; revelado: boolean; noites: number; vendido: number; fichas: number;
};
type NoCardapioJson = Record<string, unknown> & {
  id: number; nome: string; revelado: boolean; nota: number | null; vendido_hoje: number | null; fichas_hoje: number | null;
};
type Cup = {
  moda: { base: number; mistura: number }; dj: number | null; vagas: number; cardapio: NoCardapioJson[];
  hoje: { aberta: boolean; inicio: string; fim: string; sexta: boolean; dj: number | null; vendido_ate_agora: number; fichas_ate_agora: number };
  ultima_noite: (Record<string, unknown> & { copoes: Record<string, unknown>[] }) | null;
  noite_fechada: { inicio: string; fim: string } | null;
  historico: (Record<string, unknown> & { id: number; nome: string })[];
};
type Resp = { lugar: LugarEstado & { mecanica: Cup }; marcos_novos: number[] };

type Opcoes = { base: number; mistura: number; extra: number; tamanho: number; forca: number | null; preco: number | null; nome: string };
// Vodka + Energético tradicional + Limão no Copão, força 5, 22 fichas (referência 31,5)
const PADRAO: Opcoes = { base: 1, mistura: 1, extra: 1, tamanho: 2, forca: 5, preco: 22, nome: 'Copão da Casa' };
const por = (o: Partial<Opcoes> = {}) => {
  const x = { ...PADRAO, ...o };
  return t.rpc<Resp>('idle_cup_por', {
    p_base: x.base, p_mistura: x.mistura, p_extra: x.extra, p_tamanho: x.tamanho, p_forca: x.forca, p_preco: x.preco, p_nome: x.nome,
  });
};
const tirar = (id: number) => t.rpc<Resp>('idle_cup_tirar', { p_copao: id });
const escolherDj = (dj: number | null) => t.rpc<Resp>('idle_cup_dj', { p_dj: dj });
const lugar = () => t.rpc<LugarEstado & { mecanica: Cup }>('idle_lugar', { p_lugar: 4 });
const copoes = (user = A) => q<CopaoLinha>(
  `select id::int as id, nome, base, mistura, extra, tamanho, forca, preco, nivel, nota, sabor, cb, moda, aguenta, rot_bm, rot_be, rot_me,
          chance_pt, entrou_em, primeira_noite, saiu_em, revelado, noites, vendido, fichas
     from public.idle_cup_copoes where user_id = $1 order by entrou_em, id`, [user]);
const fichas = async () => (await q<{ m: number }>('select moeda as m from public.idle_place_state where user_id = $1 and lugar = 4', [A]))[0]?.m;
const djGravado = async () => (await q<{ dj: number | null }>('select dj from public.idle_cup_estado where user_id = $1', [A]))[0]?.dj ?? null;
const semana = async () => (await q<{ s: string }>('select public.games_week_start()::text as s'))[0].s;
/** A com o bar aberto (era 3) no nível `nivel`. */
async function bar(nivel = 1) {
  await q(`update public.idle_state set valuation = 1e15, generators[1] = 50, generators[13] = 1, strategies = '{0,0,0,0}',
             settled_at = now() + interval '1 day' where user_id = $1`, [A]);
  await t.rpc('idle_place_abrir', { p_lugar: 4 });
  await q('update public.idle_place_state set nivel = $2 where user_id = $1 and lugar = 4', [A, nivel]);
}

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
  it('o banco tem as mesmas bases, misturas, extras, tamanhos, DJs, vagas, conflitos e constantes de copao.ts', async () => {
    const bases = await q<Record<string, unknown>>('select id, nome, sabores, ponto, custo, nivel from public.idle_cup_cat_base order by id');
    expect(bases).toEqual(BASES.map((x) => ({ ...x, sabores: [...x.sabores] })));
    const misturas = await q<Record<string, unknown>>('select id, nome, sabores, nivel from public.idle_cup_cat_mistura order by id');
    expect(misturas).toEqual(MISTURAS.map((x) => ({ ...x, sabores: [...x.sabores] })));
    const extras = await q<Record<string, unknown>>('select id, nome, sabores, nivel from public.idle_cup_cat_extra order by id');
    expect(extras).toEqual(EXTRAS.map((x) => ({ ...x, sabores: [...x.sabores] })));
    const tamanhos = await q<Record<string, unknown>>('select id, nome, doses, nivel from public.idle_cup_cat_tamanho order by id');
    expect(tamanhos).toEqual(TAMANHOS.map((x) => ({ ...x })));
    const djs = await q<Record<string, unknown>>('select id, nome, estilo, bases, nivel from public.idle_cup_cat_dj order by id');
    expect(djs).toEqual(DJS.map((x) => ({ ...x, bases: [...x.bases] })));
    const conflitos = await q<{ a: string; b: string }>('select a, b from public.idle_cup_cat_conflito order by a, b');
    expect(conflitos.map((c) => [c.a, c.b])).toEqual(
      CONFLITOS.map(([a, b]) => [a, b]).sort((x, y) => (x[0] + ' ' + x[1]).localeCompare(y[0] + ' ' + y[1])));
    expect(await q('select publico_base, cresce, elasticidade, galera_teto, pontos, markup, taxa, alfa from public.idle_cup_const')).toEqual([
      { publico_base: PUBLICO_BASE, cresce: CRESCE, elasticidade: ELASTICIDADE, galera_teto: GALERA_TETO, pontos: [...PONTOS], markup: MARKUP,
        taxa: TAXA, alfa: ALFA },
    ]);
  });
  it('vagas e o que libera em cada nível iguais a copao.ts', async () => {
    const vs = await q<{ n: number; v: number }>('select n, public.idle_cup_vagas(n) as v from generate_series(1, 25) n order by n');
    expect(vs.map((x) => x.v)).toEqual(vs.map((x) => vagas(x.n)));
    expect(vs.map((x) => x.v)).toContain(5);
    type Tipo = 'base' | 'mistura' | 'extra' | 'tamanho' | 'dj';
    const lib = await q<{ tipo: Tipo; id: number; n: number; ok: boolean }>(
      `select x.tipo, x.id, n, public.idle_cup_liberado(x.tipo, x.id, n) as ok
         from (select 'base' as tipo, id from public.idle_cup_cat_base union all select 'mistura', id from public.idle_cup_cat_mistura
               union all select 'extra', id from public.idle_cup_cat_extra union all select 'tamanho', id from public.idle_cup_cat_tamanho
               union all select 'dj', id from public.idle_cup_cat_dj) x
        cross join generate_series(1, 25) n`);
    expect(lib).toHaveLength((12 + 15 + 12 + 3 + 10) * 25);
    for (const x of lib) expect(x.ok, `${x.tipo}:${x.id}@${x.n}`).toBe(liberado(x.tipo, x.id, x.n));
    expect((await q<{ ok: boolean }>(`select public.idle_cup_liberado('base', 13, 25) as ok`))[0].ok).toBe(false);
  });
  it('os 12 desafios do copão', async () => {
    const d = await q<{ id: number; tipo: string; valor: number; premio: string; premio_valor: number; texto: string }>(
      'select id, tipo, valor, premio, premio_valor, texto from public.idle_cat_place_desafio where lugar = 4 order by id');
    expect(d.map((x) => [x.id, x.tipo, x.valor, x.texto, x.premio, x.premio_valor])).toEqual([
      [401, 'cup_nota', 700, 'Copão com nota 700 ou mais', 'horas', 2],
      [402, 'cup_sem_pt', 700, 'Copão nota 700+ e nenhuma noite de PT na semana', 'legado', 2],
      [403, 'cup_galera', 1, 'Ganha galera numa noite', 'horas', 2],
      [404, 'cup_sexta', 1, 'Abre o bar na sexta com o DJ que combina com 2 copões', 'investidor', 1],
      [405, 'cup_cardapio', 600, 'Cardápio cheio com todas as notas 600 ou mais', 'legado', 3],
      [406, 'cup_balde', 1, 'Bota um balde no cardápio', 'horas', 2],
      [407, 'cup_sabor', 300, 'Copão com 300 ou mais de sabor', 'horas', 3],
      [408, 'cup_moda', 150, 'Acerta o copão da moda em cheio', 'legado', 2],
      [409, 'cup_noites', 5, 'Abre o bar 5 noites na semana', 'horas', 3],
      [410, 'cup_aguenta', 199, 'Acerta a força no limite', 'investidor', 1],
      [411, 'cup_fichas', 1, 'Fecha uma noite no lucro com o cardápio cheio', 'horas', 2],
      [412, 'cup_nota', 850, 'Copão com nota 850 ou mais', 'legado', 3],
    ]);
  });
  it('catálogo, copões, noites e ajudantes ficam escondidos de quem joga; só as 3 RPCs para authenticated', async () => {
    for (const tab of ['idle_cup_cat_base', 'idle_cup_cat_mistura', 'idle_cup_cat_extra', 'idle_cup_cat_tamanho', 'idle_cup_cat_dj',
      'idle_cup_cat_vaga', 'idle_cup_cat_conflito', 'idle_cup_const', 'idle_cup_copoes', 'idle_cup_noites', 'idle_cup_noite_copoes',
      'idle_cup_estado']) {
      await expect(t.asRole('authenticated', `select * from public.${tab}`), tab).rejects.toThrow(/permission denied/);
      await expect(t.asRole('anon', `select * from public.${tab}`), tab).rejects.toThrow(/permission denied/);
    }
    const ajudantes = [
      `public.idle_cup_liberado('base', 1, 1)`, 'public.idle_cup_vagas(1)', `public.idle_cup_rotulo_par('{doce}', '{doce}', 1, 1, 0)`,
      'public.idle_cup_rotulos(1, 1, 1)', 'public.idle_cup_sabor(1, 1, 1)', 'public.idle_cup_preco_ref(1, 1, 5)',
      'public.idle_cup_preco_valido(1, 1, 5, 8)', 'public.idle_cup_custo_beneficio(1, 1, 5, 8)', 'public.idle_cup_moda_base(current_date)',
      'public.idle_cup_moda_mistura(current_date)', 'public.idle_cup_moda(1, 1, current_date)', 'public.idle_cup_aguenta(5, 5)',
      'public.idle_cup_chance_pt(5, 5)', 'public.idle_cup_semente_pt(1, 1, 1, 1)', 'public.idle_cup_deu_pt(1, 1, 50)',
      'public.idle_cup_avaliar(1, 1, 1, 1, 5, 8, current_date)', 'public.idle_cup_inicio_noite(current_date)', 'public.idle_cup_noite_idx(now())',
      'public.idle_cup_noites_entre(now(), now())', 'public.idle_cup_proxima_noite(now())', 'public.idle_cup_noite_de(now())',
      'public.idle_cup_abre_noite(now(), now())', 'public.idle_cup_eh_sexta(now())', 'public.idle_cup_vendido_noite(1, now(), now())',
      'public.idle_cup_publico(1)', 'public.idle_cup_movimento(1, 0)', 'public.idle_cup_novidade(0)', 'public.idle_cup_lucro_venda(1, 1, 5, 8)',
      `public.idle_cup_vendas_noite('{1}', '{1}', '{1}', '{5}', '{8}', '{500}', '{0}', 1, 0, false, null)`,
      `public.idle_cup_galera_noite(10, 1, '{700}', false)`,
    ];
    for (const f of ajudantes) {
      await expect(t.asRole('authenticated', `select ${f}`), f).rejects.toThrow(/permission denied/);
    }
    for (const sql of ['select public.idle_cup_json(s) from public.idle_state s',
      'select public.idle_cup_copao_json(c, true) from public.idle_cup_copoes c']) {
      await expect(t.asRole('authenticated', sql), sql).rejects.toThrow(/permission denied/);
    }
    // ninguém além do dono executa um ajudante: public, anon e authenticated sem execute
    const ajud = await q<{ f: string; anon: boolean; auth: boolean }>(
      `select p.oid::regprocedure::text as f, has_function_privilege('anon', p.oid, 'execute') as anon,
              has_function_privilege('authenticated', p.oid, 'execute') as auth
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname like 'idle\\_cup\\_%' order by 1`);
    const rpcs = ['idle_cup_dj(integer)', 'idle_cup_por(integer,integer,integer,integer,integer,integer,text)', 'idle_cup_tirar(bigint)'];
    expect(ajud.length).toBeGreaterThan(30);
    for (const x of ajud) {
      const rpc = rpcs.includes(x.f);
      expect([x.f, x.anon, x.auth]).toEqual([x.f, false, rpc]);
    }
    expect(ajud.filter((x) => x.auth).map((x) => x.f)).toEqual(rpcs);
  });
  it('idle_cup_json é estável (só lê)', async () => {
    const [x] = await q<{ v: string }>(`select provolatile as v from pg_proc where proname = 'idle_cup_json'`);
    expect(x.v).toBe('s');
  });
});

describe('paridade TS × SQL', () => {
  it('rótulos e sabor de todas as 2160 combinações base × mistura × extra', async () => {
    const rows = await q<{ b: number; m: number; e: number; r: number[]; s: number }>(
      `select b.id as b, m.id as m, e.id as e, public.idle_cup_rotulos(b.id, m.id, e.id) as r, public.idle_cup_sabor(b.id, m.id, e.id) as s
         from public.idle_cup_cat_base b cross join public.idle_cup_cat_mistura m cross join public.idle_cup_cat_extra e`);
    expect(rows).toHaveLength(12 * 15 * 12);
    const vistos = new Set<number>();
    for (const x of rows) {
      expect(x.r, `${x.b}/${x.m}/${x.e}`).toEqual(rotulos(x.b, x.m, x.e));
      expect(x.s, `${x.b}/${x.m}/${x.e}`).toBe(sabor(x.b, x.m, x.e));
      x.r.forEach((r) => vistos.add(r));
    }
    expect([...vistos].sort()).toEqual([0, 1, 2, 3, 4]); // passa por todos os rótulos
  });
  it('rotuloPar com sabores quaisquer (conflitos, comuns e o empurrãozinho) em 200 casos', async () => {
    const r = rng(404);
    const SAB: Sabor[] = ['neutro', 'forte', 'raiz', 'doce', 'herbal', 'citrico', 'tropical', 'frutado', 'cremoso', 'amargo', 'energia', 'leve', 'salgado'];
    const pega = (n: number) => { const s = [...SAB]; const out: Sabor[] = []; for (let k = 0; k < n; k++) out.push(s.splice(ent(r, 0, s.length - 1), 1)[0]); return out; };
    for (let i = 0; i < 200; i++) {
      const a = pega(ent(r, 1, 3));
      const b = r() < 0.3 ? [...a.slice(0, ent(r, 1, a.length)), ...pega(1)] : pega(ent(r, 1, 3));
      const ia = ent(r, 1, 15);
      const ib = ent(r, 1, 15);
      const tipo = ent(r, 0, 2) as TipoPar;
      const [x] = await q<{ v: number }>('select public.idle_cup_rotulo_par($1::text[], $2::text[], $3, $4, $5) as v', [a, b, ia, ib, tipo]);
      expect(x.v, JSON.stringify([a, b, ia, ib, tipo])).toBe(rotuloPar(a, b, ia, ib, tipo));
    }
  });
  it('preço de referência, preço válido e custo-benefício de toda base, tamanho, força e preço (e 2 a mais de cada lado)', async () => {
    const rows = await q<{ b: number; t: number; f: number; p: number; ref: number; ok: boolean; cb: number }>(
      `select b, t, f, p, public.idle_cup_preco_ref(b, t, f) as ref, public.idle_cup_preco_valido(b, t, f, p) as ok,
              public.idle_cup_custo_beneficio(b, t, f, p) as cb
         from generate_series(1, 12) b cross join generate_series(1, 3) t cross join generate_series(1, 10) f
        cross join lateral generate_series(floor(0.5 * public.idle_cup_preco_ref(b, t, f))::int - 2,
                                           floor(2 * public.idle_cup_preco_ref(b, t, f))::int + 2) p`);
    let validos = 0;
    let esperados = 0;
    for (const b of BASES) for (const tm of TAMANHOS) for (let f = 1; f <= 10; f++) {
      const [lo, hi] = precoFaixa(b.id, tm.id, f);
      esperados += hi - lo + 1;
    }
    for (const x of rows) {
      const caso = `${x.b}/${x.t}/${x.f}/${x.p}`;
      expect(x.ref, caso).toBe(precoRef(x.b, x.t, x.f));
      expect(x.ok, caso).toBe(precoValido(x.b, x.t, x.f, x.p));
      expect(x.cb, caso).toBe(custoBeneficio(x.b, x.t, x.f, x.p));
      if (x.ok) validos++;
    }
    expect(validos).toBe(esperados);
    expect(rows.length).toBeGreaterThan(validos);
  });
  it('aguenta e chance de PT de toda força contra todo ponto', async () => {
    const rows = await q<{ f: number; p: number; a: number; c: number }>(
      `select f, p, public.idle_cup_aguenta(f, p) as a, public.idle_cup_chance_pt(f, p) as c
         from generate_series(1, 10) f cross join generate_series(1, 10) p`);
    for (const x of rows) {
      expect(x.a, `${x.f}/${x.p}`).toBe(aguenta(x.f, x.p));
      expect(x.c, `${x.f}/${x.p}`).toBe(chancePT(x.f, x.p));
    }
  });
  it('copão da moda igual a copao.ts por 60 semanas', async () => {
    const rows = await q<{ s: string; b: number; m: number; v: number[] }>(
      `select (date '2026-01-05' + 7 * k)::text as s, public.idle_cup_moda_base(date '2026-01-05' + 7 * k) as b,
              public.idle_cup_moda_mistura(date '2026-01-05' + 7 * k) as m,
              array[public.idle_cup_moda(1, 1, date '2026-01-05' + 7 * k),
                    public.idle_cup_moda(public.idle_cup_moda_base(date '2026-01-05' + 7 * k), 1, date '2026-01-05' + 7 * k),
                    public.idle_cup_moda(public.idle_cup_moda_base(date '2026-01-05' + 7 * k),
                                         public.idle_cup_moda_mistura(date '2026-01-05' + 7 * k), date '2026-01-05' + 7 * k)] as v
         from generate_series(0, 59) k`);
    for (const x of rows) {
      const m = modaDaSemana(x.s);
      expect([x.b, x.m], x.s).toEqual([m.base, m.mistura]);
      expect(x.v, x.s).toEqual([moda(1, 1, x.s), moda(m.base, 1, x.s), moda(m.base, m.mistura, x.s)]);
    }
    expect(rows.map((x) => x.v[2])).toEqual(rows.map(() => 150));
  });
  it('200 copões com semente fixa: rótulos, sabor, custo-benefício, moda, aguenta, nota e chance de PT exatos', async () => {
    const r = rng(2026);
    const visto = { moda150: 0, moda75: 0, ag199: 0, ag0: 0, cb250: 0, cb0: 0, pt: 0 };
    for (let i = 0; i < 200; i++) {
      const sem = new Date(Date.UTC(2026, 0, 5) + 7 * DIA * ent(r, 0, 59)).toISOString().slice(0, 10);
      const md = modaDaSemana(sem);
      const base = r() < 0.3 ? md.base : ent(r, 1, 12);
      const mistura = r() < 0.3 ? md.mistura : ent(r, 1, 15);
      const tamanho = ent(r, 1, 3);
      const ponto = BASES[base - 1].ponto;
      const forca = r() < 0.3 ? Math.min(10, Math.max(1, ponto + ent(r, -1, 1))) : ent(r, 1, 10);
      const ref = precoRef(base, tamanho, forca);
      const lo = Math.ceil(0.5 * ref);
      const hi = Math.floor(2 * ref);
      const preco = r() < 0.15 ? lo : r() < 0.15 ? hi : ent(r, lo, hi);
      const c: Copao = { base, mistura, extra: ent(r, 1, 12), tamanho, forca, preco };
      const a = avaliar(c, sem);
      if (a.moda === 150) visto.moda150++;
      if (a.moda === 75) visto.moda75++;
      if (a.aguenta === 199) visto.ag199++;
      if (a.aguenta === 0) visto.ag0++;
      if (a.custoBeneficio === 250) visto.cb250++;
      if (a.custoBeneficio === 0) visto.cb0++;
      if (a.chancePT > 0) visto.pt++;
      const [x] = await q<{ v: number[] }>('select public.idle_cup_avaliar($1, $2, $3, $4, $5, $6, $7::date) as v',
        [c.base, c.mistura, c.extra, c.tamanho, c.forca, c.preco, sem]);
      expect(x.v, JSON.stringify({ ...c, sem })).toEqual([...a.rotulos, a.sabor, a.custoBeneficio, a.moda, a.aguenta, a.nota, a.chancePT]);
    }
    for (const [ramo, n] of Object.entries(visto)) expect(n, ramo).toBeGreaterThan(3);
  });
  it('a semente do PT de toda receita igual a copao.ts', async () => {
    const rows = await q<{ b: number; m: number; e: number; t: number; s: string }>(
      `select b.id as b, m.id as m, e.id as e, t.id as t, public.idle_cup_semente_pt(b.id, m.id, e.id, t.id)::text as s
         from public.idle_cup_cat_base b cross join public.idle_cup_cat_mistura m cross join public.idle_cup_cat_extra e
        cross join public.idle_cup_cat_tamanho t`);
    expect(rows).toHaveLength(12 * 15 * 12 * 3);
    for (const x of rows) expect(Number(x.s), `${x.b}/${x.m}/${x.e}/${x.t}`).toBe(sementePT(x.b, x.m, x.e, x.t));
  });
  it('deuPT em 200 casos (e reabrir dá o mesmo)', async () => {
    const r = rng(7919);
    let deu = 0;
    for (let i = 0; i < 200; i++) {
      const id = ent(r, 1, 60_000);
      const noite = ent(r, 0, 2000);
      const chance = ent(r, 0, 10) * 10;
      const [x] = await q<{ v: boolean; w: boolean }>('select public.idle_cup_deu_pt($1, $2, $3) as v, public.idle_cup_deu_pt($1, $2, $3) as w', [id, noite, chance]);
      expect(x.v, `${id}/${noite}/${chance}`).toBe(deuPT(id, noite, chance));
      expect(x.w).toBe(x.v);
      if (x.v) deu++;
    }
    expect(deu).toBeGreaterThan(20);
    expect(deu).toBeLessThan(180);
  });
  it('noites: início, fim, número, sexta, as noites de um intervalo [a, b), abre ou não e o vendido até agora', async () => {
    // 90 dias: início às 18h de Brasília, número e sexta
    const dias = await q<{ d: string; i: Date; f: Date; n: number; s: boolean }>(
      `select (date '2026-01-05' + k)::text as d, public.idle_cup_inicio_noite(date '2026-01-05' + k) as i,
              public.idle_cup_inicio_noite(date '2026-01-05' + k) + interval '8 hours' as f,
              public.idle_cup_noite_idx(public.idle_cup_inicio_noite(date '2026-01-05' + k)) as n,
              public.idle_cup_eh_sexta(public.idle_cup_inicio_noite(date '2026-01-05' + k)) as s
         from generate_series(0, 89) k`);
    for (const x of dias) {
      const ini = inicioNoite(x.d);
      expect(x.i.getTime(), x.d).toBe(ini);
      expect(x.f.getTime(), x.d).toBe(fimNoite(ini));
      expect(x.n, x.d).toBe(noiteIdx(ini));
      expect(x.s, x.d).toBe(ehSexta(ini));
    }
    expect(dias.filter((x) => x.s)).toHaveLength(13);
    const r = rng(18);
    const base = Date.UTC(2026, 9, 12, 3); // segunda 12/10 00h de Brasília
    let vazios = 0;
    let bordas = 0;
    for (let i = 0; i < 200; i++) {
      let a = base + ent(r, -10, 30) * DIA + Math.floor(r() * DIA);
      if (r() < 0.15) { a = inicioNoite('2026-10-14') + ent(r, -3, 3) * DIA; bordas++; } // a cai bem no início de uma noite
      let b = a + Math.floor(r() * 4 * DIA);
      if (r() < 0.1) b = noitesEntre(a, a + 3 * DIA)[ent(r, 0, 2)]; // b cai bem no início de uma noite (fica de fora)
      const ns = noitesEntre(a, b);
      if (ns.length === 0) vazios++;
      const rows = await q<{ t: Date }>('select x as t from public.idle_cup_noites_entre($1::timestamptz, $2::timestamptz) x', [iso(a), iso(b)]);
      expect(rows.map((x) => x.t.getTime()), `${iso(a)} ${iso(b)}`).toEqual(ns);
      const [p] = await q<{ prox: Date; de: Date }>('select public.idle_cup_proxima_noite($1::timestamptz) as prox, public.idle_cup_noite_de($1::timestamptz) as de', [iso(a)]);
      expect(p.prox.getTime(), iso(a)).toBe(noitesEntre(a, a + 2 * DIA)[0]);
      const anterior = noitesEntre(a - DIA, a + 2 * DIA)[0];
      expect(p.de.getTime(), iso(a)).toBe(a < fimNoite(anterior) ? anterior : noitesEntre(a, a + 2 * DIA)[0]);
    }
    expect(vazios).toBeGreaterThan(5);
    expect(bordas).toBeGreaterThan(5);
    for (let i = 0; i < 200; i++) {
      const ini = inicioNoite('2026-10-14') + ent(r, -5, 5) * DIA;
      const visto = r() < 0.15 ? null : r() < 0.15 ? ini - DIA + ent(r, -1, 1) : ini - 2 * DIA + Math.floor(r() * 3 * DIA);
      const [x] = await q<{ v: boolean }>('select public.idle_cup_abre_noite($1::timestamptz, $2::timestamptz) as v', [iso(ini), visto === null ? null : iso(visto)]);
      expect(x.v, `${iso(ini)} ${visto}`).toBe(abreNoite(ini, visto));
      const tt = ini - 2 * H + Math.floor(r() * 12 * H);
      const total = r() < 0.1 ? 0 : r() * 5000;
      const [y] = await q<{ v: number }>('select public.idle_cup_vendido_noite($1, $2::timestamptz, $3::timestamptz) as v', [total, iso(ini), iso(tt)]);
      expect(rel(y.v, vendidoNaNoite(total, ini, tt)), `${total} ${iso(tt)}`).toBeLessThan(1e-12);
    }
    // nos extremos: nada antes do início, tudo depois do fim
    const ini = inicioNoite('2026-10-16');
    const [z] = await q<{ a: number; b: number }>(
      `select public.idle_cup_vendido_noite(1234.5, $1::timestamptz, $1::timestamptz - interval '1 minute') as a,
              public.idle_cup_vendido_noite(1234.5, $1::timestamptz, $1::timestamptz + interval '9 hours') as b`, [iso(ini)]);
    expect([z.a, z.b]).toEqual([0, 1234.5]);
  });
  it('público, movimento, novidade e lucro por venda', async () => {
    const pubs = await q<{ n: number; p: number }>('select n, public.idle_cup_publico(n) as p from generate_series(1, 25) n');
    for (const x of pubs) expect(rel(x.p, publico(x.n)), `${x.n}`).toBeLessThan(1e-12);
    const novs = await q<{ k: number; v: number }>('select k, public.idle_cup_novidade(k) as v from generate_series(0, 12) k');
    for (const x of novs) expect(x.v, `${x.k}`).toBe(novidade(x.k));
    const r = rng(31);
    let teto = 0;
    for (let i = 0; i < 200; i++) {
      const nivel = ent(r, 1, 25);
      const galera = r() < 0.1 ? 0 : r() < 0.1 ? 9000 + r() * 5000 : r() ** 2 * 5000;
      if (Math.sqrt(galera) / 30 > GALERA_TETO) teto++;
      const [x] = await q<{ m: number }>('select public.idle_cup_movimento($1, $2) as m', [nivel, galera]);
      expect(rel(x.m, movimento(nivel, galera)), `${nivel}/${galera}`).toBeLessThan(1e-12);
    }
    expect(teto).toBeGreaterThan(3);
    const lucros = await q<{ b: number; t: number; f: number; p: number; l: number }>(
      `select b, t, f, p, public.idle_cup_lucro_venda(b, t, f, p) as l
         from generate_series(1, 12) b cross join generate_series(1, 3) t cross join generate_series(1, 10) f cross join (values (4), (22), (61)) v(p)`);
    for (const x of lucros) expect(x.l, `${x.b}/${x.t}/${x.f}/${x.p}`).toBe(lucroVenda({ base: x.b, tamanho: x.t, forca: x.f, preco: x.p }));
  });
  it('vendas da noite em 200 cardápios (canibal, sexta, DJ, elasticidade, tamanho, nota 0)', async () => {
    const r = rng(1999);
    const visto = { canibal: 0, sextaDj: 0, curte: 0, vazio: 0, zero: 0, cheia: 0, balde: 0 };
    for (let i = 0; i < 200; i++) {
      const n = ent(r, 0, 5);
      const cardapio: NoCardapio[] = [];
      for (let k = 0; k < n; k++) {
        const repete = k > 0 && r() < 0.2 ? cardapio[ent(r, 0, k - 1)] : null;
        const base = repete ? repete.base : ent(r, 1, 12);
        const tamanho = ent(r, 1, 3);
        const forca = ent(r, 1, 10);
        const ref = precoRef(base, tamanho, forca);
        cardapio.push({
          base, mistura: repete ? repete.mistura : ent(r, 1, 15), tamanho, forca,
          preco: ent(r, Math.ceil(0.5 * ref), Math.floor(2 * ref)), nota: r() < 0.05 ? 0 : ent(r, 0, 999), noites: ent(r, 0, 9),
        });
      }
      const noite = { nivel: ent(r, 1, 25), galera: r() < 0.2 ? 0 : r() * 3000, sexta: r() < 0.4, dj: r() < 0.25 ? null : ent(r, 1, 10) };
      const esperado = vendasNoite(cardapio, noite);
      const somaAtr = cardapio.reduce((s, c) => s + (c.nota / 999) ** 2 * novidade(c.noites), 0);
      if (n === 0) visto.vazio++;
      if (n > 0 && esperado.every((v) => v === 0)) visto.zero++;
      if (somaAtr > 1) visto.cheia++;
      if (cardapio.some((c) => c.tamanho === 3)) visto.balde++;
      if (cardapio.some((c, k) => cardapio.some((o, j) => j !== k && o.base === c.base && o.mistura === c.mistura))) visto.canibal++;
      if (noite.sexta && noite.dj !== null) {
        visto.sextaDj++;
        if (cardapio.some((c) => DJS[noite.dj! - 1].bases.includes(c.base))) visto.curte++;
      }
      const [x] = await q<{ v: number[] }>(
        'select public.idle_cup_vendas_noite($1::int[], $2::int[], $3::int[], $4::int[], $5::int[], $6::int[], $7::int[], $8, $9, $10, $11) as v',
        [cardapio.map((c) => c.base), cardapio.map((c) => c.mistura), cardapio.map((c) => c.tamanho), cardapio.map((c) => c.forca),
          cardapio.map((c) => c.preco), cardapio.map((c) => c.nota), cardapio.map((c) => c.noites), noite.nivel, noite.galera, noite.sexta, noite.dj]);
      const caso = JSON.stringify({ cardapio, noite });
      expect(x.v, caso).toHaveLength(n);
      x.v.forEach((v, k) => expect(rel(v, esperado[k]), caso).toBeLessThan(1e-12));
    }
    for (const [ramo, k] of Object.entries(visto)) expect(k, ramo).toBeGreaterThan(2);
  });
  it('galera no fim da noite em 200 casos (sobe com média ≥ 600, cai abaixo de 300, PT tira 15%, piso 0)', async () => {
    const r = rng(600);
    const visto = { sobe: 0, cai: 0, pt: 0, vazio: 0, meio: 0, limite600: 0, limite300: 0 };
    for (let i = 0; i < 200; i++) {
      const n = ent(r, 0, 5);
      const faixa = r();
      let notas = Array.from({ length: n }, () => (faixa < 0.4 ? ent(r, 550, 999) : faixa < 0.7 ? ent(r, 0, 350) : ent(r, 0, 999)));
      if (r() < 0.1) { notas = [600, 600]; visto.limite600++; }
      else if (r() < 0.1) { notas = [299, 301]; visto.limite300++; }
      const galera = r() < 0.15 ? 0 : r() * 4000;
      const nivel = ent(r, 1, 25);
      const pt = r() < 0.3;
      const esperado = galeraNoite(galera, nivel, notas, pt);
      const media = notas.length ? notas.reduce((s, x) => s + x, 0) / notas.length : null;
      if (media === null) visto.vazio++;
      else if (media >= 600) visto.sobe++;
      else if (media < 300) visto.cai++;
      else visto.meio++;
      if (pt) visto.pt++;
      const [x] = await q<{ v: number }>('select public.idle_cup_galera_noite($1, $2, $3::int[], $4) as v', [galera, nivel, notas, pt]);
      expect(rel(x.v, esperado), JSON.stringify({ galera, nivel, notas, pt })).toBeLessThan(1e-12);
    }
    for (const [ramo, k] of Object.entries(visto)) expect(k, ramo).toBeGreaterThan(2);
  });
});

describe('pôr um copão no cardápio', () => {
  it('grava tudo calculado (igual a copao.ts, com a moda da semana), não cobra nada e devolve o lugar', async () => {
    await bar();
    expect(await fichas()).toBe(0); // o bar abre com 0 fichas
    const resp = await por();
    const [c] = await copoes();
    const sem = await semana();
    const a = avaliar({ base: 1, mistura: 1, extra: 1, tamanho: 2, forca: 5, preco: 22 }, sem);
    expect(c).toMatchObject({
      nome: 'Copão da Casa', base: 1, mistura: 1, extra: 1, tamanho: 2, forca: 5, preco: 22, nivel: 1,
      rot_bm: a.rotulos[0], rot_be: a.rotulos[1], rot_me: a.rotulos[2], sabor: a.sabor, cb: a.custoBeneficio, moda: a.moda,
      aguenta: a.aguenta, nota: a.nota, chance_pt: a.chancePT, saiu_em: null, revelado: false, noites: 0, vendido: 0, fichas: 0,
    });
    expect(c.entrou_em.getTime()).toBe(agora);
    // quarta 15h de Brasília: a primeira noite é a de hoje, às 18h
    expect(c.primeira_noite.getTime()).toBe(agora + 3 * H);
    expect(c.primeira_noite.getTime()).toBe(inicioNoite(iso(agora).slice(0, 10)));
    expect(await fichas()).toBe(0);
    expect(resp.lugar.moeda).toBe(0);
    expect(resp.lugar.mecanica.cardapio).toHaveLength(1);
    expect(resp.lugar.mecanica.cardapio[0]).toMatchObject({ id: c.id, nome: 'Copão da Casa', revelado: false, nota: null });
    expect(resp.marcos_novos).toEqual([]);
  });
  it('a moda conta: base e mistura da moda da semana dão 150', async () => {
    await bar(25);
    const md = modaDaSemana(await semana());
    await por({ base: md.base, mistura: md.mistura, extra: 1, tamanho: 1, forca: 5, preco: 9 });
    const [c] = await copoes();
    expect(c.moda).toBe(150);
    expect(c.nota).toBe(avaliar({ base: md.base, mistura: md.mistura, extra: 1, tamanho: 1, forca: 5, preco: 9 }, await semana()).nota);
  });
  it('no meio da noite, a primeira noite é a de amanhã; às 18h em ponto, a de hoje; nome sem espaço nas pontas', async () => {
    await bar();
    const ini = inicioNoite(iso(agora).slice(0, 10)); // quarta 18h de Brasília
    andar(5 * H); // quarta 20h de Brasília: a noite de hoje já começou
    await por({ nome: '  Bomba  ' });
    let [c] = await copoes();
    expect(c.nome).toBe('Bomba');
    expect(c.primeira_noite.getTime()).toBe(ini + DIA);
    // posto no meio da noite: não entra na noite de hoje (nem vende, nem aparece nela)
    andar(H);
    const m = (await lugar()).mecanica;
    expect((await noitesDb()).map((n) => n.inicio.getTime())).toEqual([ini]);
    expect(await noiteCopoes(ini)).toEqual([]);
    expect(m.hoje.vendido_ate_agora).toBe(0);
    expect(m.cardapio[0]).toMatchObject({ id: c.id, vendido_hoje: null, fichas_hoje: null });
    agora = ini + DIA; // quinta 18h em ponto
    vi.setSystemTime(agora);
    await por({ extra: 2 });
    c = (await copoes())[1];
    expect(c.primeira_noite.getTime()).toBe(agora);
  });
  it('Review Focus 5: recusas com o erro certo e nada gravado', async () => {
    await bar();
    const nada = async () => {
      expect(await copoes()).toHaveLength(0);
      expect(await fichas()).toBe(0);
    };
    // Copão de vodka força 5: referência 3 · 2 · 1 · 1,5 + 3 · 7,5 = 31,5, preço de 16 a 63
    for (const [o, erro] of [
      [{ base: 4 }, /idle_cup_trancado/], [{ mistura: 5 }, /idle_cup_trancado/], [{ extra: 4 }, /idle_cup_trancado/],
      [{ tamanho: 3, preco: 75 }, /idle_cup_trancado/],
      [{ base: 13 }, /idle_bad_choice/], [{ mistura: 0 }, /idle_bad_choice/], [{ extra: 13 }, /idle_bad_choice/], [{ tamanho: 4 }, /idle_bad_choice/],
      [{ forca: 0 }, /idle_cup_forca/], [{ forca: 11 }, /idle_cup_forca/], [{ forca: null }, /idle_cup_forca/],
      [{ preco: 15 }, /idle_cup_preco/], [{ preco: 64 }, /idle_cup_preco/], [{ preco: null }, /idle_cup_preco/], [{ preco: 0 }, /idle_cup_preco/],
      // a base pesa: a cachaça (custo 1) no copão força 5 vai de 3 · 1 · 1 · 1,5 + 22,5 = 27 → 14 a 54
      [{ base: 2, preco: 55 }, /idle_cup_preco/],
      [{ nome: '   ' }, /idle_lugar_nome/], [{ nome: 'x'.repeat(31) }, /idle_lugar_nome/], [{ nome: 'a\nb' }, /idle_lugar_nome/],
    ] as [Partial<Opcoes>, RegExp][]) {
      await expect(por(o), JSON.stringify(o)).rejects.toThrow(erro);
      await nada();
    }
    // os limites da faixa passam
    expect(precoFaixa(1, 2, 5)).toEqual([16, 63]);
    expect(precoFaixa(2, 2, 5)).toEqual([14, 54]);
    await por({ preco: 16 });
    await por({ preco: 63, extra: 2 });
    await por({ base: 2, preco: 14, extra: 3 });
    expect((await copoes()).map((c) => c.preco)).toEqual([16, 63, 14]);
  });
  it('Review Focus 5: vaga cheia e copão repetido (mesma base, mistura, extra e tamanho)', async () => {
    await bar();
    await por();
    await expect(por({ forca: 6, preco: 30 }), 'repetido').rejects.toThrow(/idle_cup_repetido/);
    await por({ tamanho: 1, preco: 8 }); // outro tamanho: pode
    await por({ extra: 2 });
    expect(await copoes()).toHaveLength(3);
    await expect(por({ extra: 3 })).rejects.toThrow(/idle_cup_vaga/);
    expect(await copoes()).toHaveLength(3);
    // tirou: libera a vaga e o repetido
    await tirar((await copoes())[0].id);
    await por({ forca: 6, preco: 30 });
    expect((await copoes()).filter((c) => c.saiu_em === null)).toHaveLength(3);
  });
  it('a 4ª vaga chega no nível 12 e a 5ª no 20; o trancado libera quando o lugar sobe', async () => {
    await bar(12);
    for (const extra of [1, 2, 3, 4]) await por({ extra });
    await expect(por({ extra: 5 })).rejects.toThrow(/idle_cup_vaga/);
    await q('update public.idle_place_state set nivel = 20 where user_id = $1 and lugar = 4', [A]);
    await por({ extra: 5, base: 9, mistura: 10, tamanho: 3, preco: 75 });
    await expect(por({ extra: 6 })).rejects.toThrow(/idle_cup_vaga/);
    expect(await copoes()).toHaveLength(5);
    expect((await lugar()).mecanica.vagas).toBe(5);
  });
  it('lugar fechado: idle_lugar_fechado', async () => {
    await expect(por()).rejects.toThrow(/idle_lugar_fechado/);
    await t.as(B);
    await expect(por()).rejects.toThrow(/idle_lugar_fechado/);
  });
});

describe('tirar um copão', () => {
  it('marca a saída, não cobra nada, e o copão sai do cardápio', async () => {
    await bar();
    await por();
    await por({ extra: 2, nome: 'Fica' });
    const [c] = await copoes();
    andar(H);
    const resp = await tirar(c.id);
    const [x] = await copoes();
    expect(x.saiu_em!.getTime()).toBe(agora);
    expect(resp.lugar.mecanica.cardapio.map((k) => k.nome)).toEqual(['Fica']);
    expect(await fichas()).toBe(0);
  });
  it('recusas: copão que não existe, que já saiu ou que é de outra pessoa', async () => {
    await expect(tirar(1)).rejects.toThrow(/idle_lugar_fechado/);
    await bar();
    await por();
    const [c] = await copoes();
    await expect(tirar(c.id + 1000)).rejects.toThrow(/idle_cup_sem_copao/);
    await tirar(c.id);
    const saiu = (await copoes())[0].saiu_em!.getTime();
    andar(H);
    await expect(tirar(c.id)).rejects.toThrow(/idle_cup_sem_copao/);
    expect((await copoes())[0].saiu_em!.getTime()).toBe(saiu);
    // o B com bar aberto não tira copão do A
    await por({ extra: 2 });
    const outro = (await copoes())[1];
    await t.as(B);
    await t.rpc('idle_start');
    await q(`update public.idle_state set valuation = 1e15, generators[1] = 50, generators[13] = 1, strategies = '{0,0,0,0}',
               settled_at = now() + interval '1 day' where user_id = $1`, [B]);
    await t.rpc('idle_place_abrir', { p_lugar: 4 });
    await expect(tirar(outro.id)).rejects.toThrow(/idle_cup_sem_copao/);
    expect((await copoes())[1].saiu_em).toBeNull();
  });
});

describe('o DJ da sexta', () => {
  it('escolhe, troca e tira o DJ; trancado e inexistente recusam sem gravar', async () => {
    await expect(escolherDj(1)).rejects.toThrow(/idle_lugar_fechado/);
    await bar();
    expect(await djGravado()).toBeNull();
    let resp = await escolherDj(2);
    expect(await djGravado()).toBe(2);
    expect(resp.lugar.mecanica.dj).toBe(2);
    await expect(escolherDj(3)).rejects.toThrow(/idle_cup_trancado/);
    await expect(escolherDj(11)).rejects.toThrow(/idle_bad_choice/);
    await expect(escolherDj(0)).rejects.toThrow(/idle_bad_choice/);
    expect(await djGravado()).toBe(2);
    await q('update public.idle_place_state set nivel = 3 where user_id = $1 and lugar = 4', [A]);
    await escolherDj(3);
    expect(await djGravado()).toBe(3);
    resp = await escolherDj(null);
    expect(await djGravado()).toBeNull();
    expect(resp.lugar.mecanica.dj).toBeNull();
    expect(await fichas()).toBe(0);
  });
});

describe('o JSON do copão', () => {
  it('lugar fechado: sem mecânica', async () => {
    expect((await lugar()).mecanica).toBeNull();
  });
  it('bar vazio: moda da semana, sem DJ, 3 vagas, a noite de hoje e nada fechado ainda', async () => {
    await bar();
    const m = (await lugar()).mecanica;
    const ini = inicioNoite(iso(agora).slice(0, 10));
    expect(m).toMatchObject({
      moda: modaDaSemana(await semana()), dj: null, vagas: 3, cardapio: [], ultima_noite: null, noite_fechada: null, historico: [],
    });
    expect(m.hoje).toMatchObject({ aberta: true, sexta: false, dj: null, vendido_ate_agora: 0, fichas_ate_agora: 0 });
    expect(Date.parse(m.hoje.inicio)).toBe(ini);
    expect(Date.parse(m.hoje.fim)).toBe(ini + 8 * H);
  });
  it('hoje: a noite em andamento (com o que já vendeu) ou a próxima; sexta marcada', async () => {
    await bar();
    const ini = inicioNoite(iso(agora).slice(0, 10));
    andar(4 * H); // quarta 19h: a noite de hoje em andamento
    await q(`insert into public.idle_cup_noites (user_id, inicio, aberta, sexta, dj, vendas, fichas) values ($1, $2, true, false, null, 12.5, 80)`, [A, iso(ini)]);
    let h = (await lugar()).mecanica.hoje;
    expect(Date.parse(h.inicio)).toBe(ini);
    expect(h).toMatchObject({ aberta: true, vendido_ate_agora: 12.5, fichas_ate_agora: 80 });
    andar(7 * H); // quinta 2h de Brasília: acabou; a próxima é quinta 18h
    h = (await lugar()).mecanica.hoje;
    expect(Date.parse(h.inicio)).toBe(ini + DIA);
    expect(h).toMatchObject({ aberta: true, sexta: false, vendido_ate_agora: 0 });
    andar(DIA); // sexta 2h: a próxima é a de sexta
    h = (await lugar()).mecanica.hoje;
    expect(Date.parse(h.inicio)).toBe(ini + 2 * DIA);
    expect(h.sexta).toBe(true);
    // ninguém abriu o bar (a linha da noite diz)
    andar(17 * H);
    await q(`insert into public.idle_cup_noites (user_id, inicio, aberta, sexta, dj) values ($1, $2, false, true, null)`, [A, iso(ini + 2 * DIA)]);
    h = (await lugar()).mecanica.hoje;
    expect(h).toMatchObject({ aberta: false, sexta: true });
  });
  it('esconde nota, partes, rótulos e chance de PT até ele vender a primeira noite aberta inteira', async () => {
    await bar();
    await por();
    const [c] = await copoes();
    let k = (await lugar()).mecanica.cardapio[0];
    expect(k).toMatchObject({ id: c.id, nome: 'Copão da Casa', base: 1, mistura: 1, extra: 1, tamanho: 2, forca: 5, preco: 22, revelado: false,
      nota: null, sabor: null, cb: null, moda: null, aguenta: null, rotulos: null, chance_pt: null, noites: 0, vendido: 0, fichas: 0,
      vendido_hoje: null, fichas_hoje: null });
    expect(Date.parse(k.primeira_noite as string)).toBe(c.primeira_noite.getTime());
    andar(3 * H + 60_000); // 18h01: a primeira noite começou, ele vende, mas a nota ainda não saiu
    k = (await lugar()).mecanica.cardapio[0];
    expect(k).toMatchObject({ revelado: false, nota: null, rotulos: null });
    expect(k.vendido_hoje).toBeGreaterThan(0);
    andar(8 * H - 2 * 60_000); // 1h59
    expect((await lugar()).mecanica.cardapio[0].nota).toBeNull();
    andar(2 * 60_000); // 2h01: a noite fechou com ele no cardápio
    k = (await lugar()).mecanica.cardapio[0];
    expect(k).toMatchObject({ revelado: true, nota: c.nota, sabor: c.sabor, cb: c.cb, moda: c.moda, aguenta: c.aguenta,
      rotulos: [c.rot_bm, c.rot_be, c.rot_me], chance_pt: c.chance_pt, vendido_hoje: null });
  });
  it('vendido_hoje e fichas_hoje: o que cada copão do cardápio já vendeu na noite de hoje (o que saiu fica só no total)', async () => {
    await bar();
    await por({ nome: 'Fica' });
    await por({ extra: 2, nome: 'Sai' });
    const [c1, c2] = await copoes();
    const ini = inicioNoite(iso(agora).slice(0, 10));
    ir(ini + 2 * H);
    await tirar(c2.id);
    ir(ini + 4 * H);
    const m = (await lugar()).mecanica;
    const ks = await noiteCopoes(ini);
    expect(m.cardapio.map((c) => c.id)).toEqual([c1.id]);
    expect(m.cardapio[0].vendido_hoje).toBe(ks[0].vendidos);
    expect(m.cardapio[0].fichas_hoje).toBe(ks[0].fichas);
    expect(rel(m.hoje.vendido_ate_agora, ks[0].vendidos + ks[1].vendidos)).toBeLessThan(1e-12);
    expect(rel(m.hoje.fichas_ate_agora, ks[0].fichas + ks[1].fichas)).toBeLessThan(1e-12);
  });
  it('noite_fechada: a última noite que fechou sem ninguém abrir o bar, se é mais nova que a ultima_noite', async () => {
    await bar();
    await por();
    const ini = inicioNoite(iso(agora).slice(0, 10)); // quarta 18h
    ir(ini + 3 * DIA + 9 * H); // domingo 3h: quarta abriu; quinta e sexta sem linha; sábado ninguém abriu e já fechou
    let m = (await lugar()).mecanica;
    expect(Date.parse(m.ultima_noite!.inicio as string)).toBe(ini);
    expect(Date.parse(m.noite_fechada!.inicio)).toBe(ini + 3 * DIA);
    expect(Date.parse(m.noite_fechada!.fim)).toBe(ini + 3 * DIA + 8 * H);
    // a de domingo abre (passou agora) e fecha: a última noite é ela, nenhuma fechada mais nova
    ir(ini + 4 * DIA + 9 * H);
    m = (await lugar()).mecanica;
    expect(Date.parse(m.ultima_noite!.inicio as string)).toBe(ini + 4 * DIA);
    expect(m.noite_fechada).toBeNull();
    // a que ninguém abriu e ainda não acabou não conta
    ir(ini + 6 * DIA + 2 * H); // terça 20h: a de segunda abriu (passou segunda 3h); a de terça ninguém abriu e está em andamento
    m = (await lugar()).mecanica;
    expect(m.hoje.aberta).toBe(false);
    expect(m.noite_fechada).toBeNull();
  });
  it('ultima_noite: a última noite aberta que fechou, com o que cada copão vendeu e a semente do chat', async () => {
    await bar();
    await por({ nome: 'Um' });
    await por({ extra: 2, nome: 'Dois' });
    const [c1, c2] = await copoes();
    const ini = inicioNoite(iso(agora).slice(0, 10));
    andar(2 * DIA);
    const noite = async (inicio: number, aberta: boolean, fechada: boolean, extra: Record<string, unknown> = {}) => {
      await q(`insert into public.idle_cup_noites (user_id, inicio, aberta, sexta, dj, vendas, fichas, pt, galera_delta, fechada)
               values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [A, iso(inicio), aberta, extra.sexta ?? false, extra.dj ?? null, extra.vendas ?? 0, extra.fichas ?? 0, extra.pt ?? false, extra.galera ?? 0, fechada]);
    };
    await noite(ini, true, true, { vendas: 30, fichas: 200, galera: 2 });
    await noite(ini + DIA, true, true, { vendas: 40, fichas: 260, pt: true, galera: -3.5, dj: 2 });
    await q(`insert into public.idle_cup_noite_copoes (user_id, inicio, copao, total, vendidos, fichas, pt) values
             ($1, $2, $3, 25, 25, 150, true), ($1, $2, $4, 15, 15, 110, false)`, [A, iso(ini + DIA), c1.id, c2.id]);
    await noite(ini + 2 * DIA, false, true); // ninguém abriu o bar: não é "a última noite"
    const u = (await lugar()).mecanica.ultima_noite!;
    expect(Date.parse(u.inicio as string)).toBe(ini + DIA);
    expect(Date.parse(u.fim as string)).toBe(ini + DIA + 8 * H);
    expect(u).toMatchObject({ sexta: false, dj: 2, vendas: 40, fichas: 260, pt: true, galera_delta: -3.5, chat_seed: noiteIdx(ini + DIA) });
    // o depois revelou os dois (a primeira noite aberta deles fechou com eles no cardápio)
    expect(u.copoes).toEqual([
      { id: c1.id, nome: 'Um', base: 1, mistura: 1, extra: 1, tamanho: 2, forca: 5, preco: 22, nota: c1.nota, vendidos: 25, fichas: 150, pt: true },
      { id: c2.id, nome: 'Dois', base: 1, mistura: 1, extra: 2, tamanho: 2, forca: 5, preco: 22, nota: c2.nota, vendidos: 15, fichas: 110, pt: false },
    ]);
    // uma noite aberta que ainda não fechou não conta
    await noite(ini + 3 * DIA, true, false, { vendas: 5 });
    expect(Date.parse((await lugar()).mecanica.ultima_noite!.inicio as string)).toBe(ini + DIA);
  });
  it('histórico: os revelados, o mais recente primeiro (até 10), mesmo os que já saíram', async () => {
    await bar(25);
    for (let i = 1; i <= 12; i++) {
      andar(DIA);
      await por({ extra: (i % 12) + 1, nome: `Copão ${i}` });
      if (i < 12) await tirar((await copoes()).find((c) => c.nome === `Copão ${i}`)!.id);
    }
    await q('update public.idle_cup_copoes set revelado = true where user_id = $1 and nome <> $2', [A, 'Copão 12']);
    const m = (await lugar()).mecanica;
    expect(m.cardapio.map((c) => c.nome)).toEqual(['Copão 12']);
    expect(m.historico.map((h) => h.nome)).toEqual(Array.from({ length: 10 }, (_, k) => `Copão ${11 - k}`));
    const c11 = (await copoes()).find((c) => c.nome === 'Copão 11')!;
    expect(m.historico[0]).toMatchObject({ id: c11.id, base: 1, mistura: 1, extra: 12, tamanho: 2, forca: 5, preco: 22, nota: c11.nota,
      sabor: c11.sabor, cb: c11.cb, moda: c11.moda, aguenta: c11.aguenta, noites: 0, vendido: 0, fichas: 0 });
    expect(Date.parse(m.historico[0].saiu_em as string)).toBe(c11.saiu_em!.getTime());
  });
  it('B não vê nada do A', async () => {
    await bar();
    await por();
    await escolherDj(1);
    await t.as(B);
    expect((await lugar()).mecanica).toBeNull();
  });
});

// ===== parte B: as noites do bar (avancar), o PT, a galera, a revelação, o caderninho, as conquistas e os desafios =====

type NoiteLinha = {
  inicio: Date; aberta: boolean; sexta: boolean; dj: number | null; vendas: number; fichas: number; pt: boolean; galera_delta: number;
  fechada: boolean; vagas: number; nivel: number; galera: number; conferida: boolean;
};
type NoiteCopao = { inicio: Date; copao: number; total: number; vendidos: number; fichas: number; pt: boolean };
type EstadoBar = { moeda: number; fas: number; volume: number; lendario: boolean; marcos: number[] };
const ir = (ms: number) => { agora = ms; vi.setSystemTime(agora); };
const noitesDb = () => q<NoiteLinha>(
  `select inicio, aberta, sexta, dj, vendas, fichas, pt, galera_delta, fechada, vagas, nivel, galera, conferida
     from public.idle_cup_noites where user_id = $1 order by inicio`, [A]);
const ultimaDb = async () => (await noitesDb()).at(-1)!;
const noiteCopoes = (inicio: number) => q<NoiteCopao>(
  `select k.inicio, k.copao::int as copao, k.total, k.vendidos, k.fichas, k.pt
     from public.idle_cup_noite_copoes k join public.idle_cup_copoes c on c.id = k.copao
    where k.user_id = $1 and k.inicio = $2 order by c.entrou_em, c.id`, [A, iso(inicio)]);
const estadoBar = async () => (await q<EstadoBar>(
  'select moeda, fas, volume, lendario, marcos from public.idle_place_state where user_id = $1 and lugar = 4', [A]))[0];
const abrirJogo = () => t.rpc('idle_open'); // trava + fecha a conta + salva: só o avancar roda (sem o depois)
const prods = () => q<{ nome: string; partes: number[]; numero: number; criado_em: Date }>(
  'select nome, partes, numero, criado_em from public.idle_place_prod where user_id = $1 and lugar = 4 order by id', [A]);
const notasCad = () => q<{ tipo: string; a: number; b: number; rotulo: number }>(
  'select tipo, a, b, rotulo from public.idle_place_notes where user_id = $1 and lugar = 4 order by tipo, a, b', [A]);
const conquistas = async () => (await q<{ c: number }>(
  'select conquista_id as c from public.idle_conquistas where user_id = $1 order by 1', [A])).map((x) => x.c);
const valuation = async () => (await q<{ v: number }>('select valuation as v from public.idle_state where user_id = $1', [A]))[0].v;
const setFas = (fas: number) => q('update public.idle_place_state set fas = $2 where user_id = $1 and lugar = 4', [A, fas]);
const setNivel = (nivel: number) => q('update public.idle_place_state set nivel = $2 where user_id = $1 and lugar = 4', [A, nivel]);
type Ajuste = Partial<Record<'nota' | 'chance_pt' | 'sabor' | 'moda' | 'aguenta' | 'preco', number>>;
/** Mexe no que foi calculado ao pôr (antes de estrear): nota, chance de PT, partes da nota, preço. */
async function ajustar(id: number, campos: Ajuste) {
  for (const [k, v] of Object.entries(campos)) await q(`update public.idle_cup_copoes set ${k} = $2 where id = $1`, [id, v]);
}
/** O que o cardápio (na ordem) venderia na noite inteira, pelo copao.ts. */
const totaisTs = (cs: CopaoLinha[], n: Noite) => vendasNoite(
  cs.map((c) => ({ base: c.base, mistura: c.mistura, tamanho: c.tamanho, forca: c.forca, preco: c.preco, nota: c.nota, noites: c.noites })), n);
/** A sorte do PT de um copão numa noite, pela receita (copao.ts). */
const ptTs = (c: CopaoLinha, inicio: number) => deuPT(sementePT(c.base, c.mistura, c.extra, c.tamanho), noiteIdx(inicio), c.chance_pt);
const juntos = (xs: number[], ys: number[]) => {
  expect(xs).toHaveLength(ys.length);
  xs.forEach((x, i) => expect(rel(x, ys[i]), `${i}: ${x} × ${ys[i]}`).toBeLessThan(1e-12));
};

describe('as noites do bar (avancar)', () => {
  it('vende proporcional nas 8 h, fecha uma vez (galera, noites no cardápio) e o total bate com vendasNoite', async () => {
    await bar();
    await por({ nome: 'Um' });
    await por({ extra: 2, forca: 6, preco: 30, nome: 'Dois' });
    await setFas(50);
    const cs = await copoes();
    const ini = inicioNoite(iso(agora).slice(0, 10));
    ir(ini + 4 * H); // quarta 22h de Brasília: metade da noite
    let m = (await lugar()).mecanica;
    let ns = await noitesDb();
    expect(ns).toHaveLength(1);
    expect(ns[0]).toMatchObject({ aberta: true, sexta: false, dj: null, fechada: false, vagas: 3, nivel: 1, galera: 50, conferida: false, pt: false });
    expect(ns[0].inicio.getTime()).toBe(ini);
    const tot = totaisTs(cs, { nivel: 1, galera: 50, sexta: false, dj: null });
    const lucros = cs.map((c) => lucroVenda(c));
    let ks = await noiteCopoes(ini);
    expect(ks.map((k) => k.copao)).toEqual(cs.map((c) => c.id));
    juntos(ks.map((k) => k.total), tot);
    juntos(ks.map((k) => k.vendidos), tot.map((x) => vendidoNaNoite(x, ini, agora)));
    juntos(ks.map((k) => k.fichas), tot.map((x, i) => vendidoNaNoite(x, ini, agora) * lucros[i]));
    const meio = tot.reduce((s, x, i) => s + vendidoNaNoite(x, ini, agora) * lucros[i], 0);
    expect(rel(await fichas(), meio)).toBeLessThan(1e-12);
    expect(rel(m.hoje.vendido_ate_agora, tot.reduce((s, x) => s + x / 2, 0))).toBeLessThan(1e-12);
    expect(rel(m.hoje.fichas_ate_agora, meio)).toBeLessThan(1e-12);
    expect(m.hoje.aberta).toBe(true);
    expect(m.ultima_noite).toBeNull();
    expect((await estadoBar()).fas).toBe(50);
    // quinta 3h: a noite fechou
    ir(ini + 9 * H);
    m = (await lugar()).mecanica;
    ks = await noiteCopoes(ini);
    juntos(ks.map((k) => k.vendidos), tot);
    const pts = cs.map((c) => ptTs(c, ini));
    expect(ks.map((k) => k.pt)).toEqual(pts);
    const g = galeraNoite(50, 1, cs.map((c) => c.nota), pts.some(Boolean));
    const e1 = await estadoBar();
    expect(rel(e1.fas, g)).toBeLessThan(1e-12);
    const fim = tot.reduce((s, x, i) => s + x * lucros[i], 0);
    expect(rel(e1.moeda, fim)).toBeLessThan(1e-12);
    const cs1 = await copoes();
    expect(cs1.map((c) => c.noites)).toEqual([1, 1]);
    juntos(cs1.map((c) => c.vendido), tot);
    juntos(cs1.map((c) => c.fichas), tot.map((x, i) => x * lucros[i]));
    ns = await noitesDb();
    expect(ns).toHaveLength(1);
    expect(ns[0]).toMatchObject({ fechada: true, conferida: true, pt: pts.some(Boolean) });
    expect(rel(ns[0].galera_delta, g - 50)).toBeLessThan(1e-12);
    expect(Date.parse(m.ultima_noite!.inicio as string)).toBe(ini);
    expect(m.ultima_noite!.copoes.map((x) => x.id)).toEqual(cs.map((c) => c.id));
    expect(Date.parse(m.hoje.inicio)).toBe(ini + DIA); // a próxima, ainda não começou
    expect(m.hoje.aberta).toBe(true);
    // mais visitas não mexem em nada
    await lugar();
    ir(agora + H);
    await abrirJogo();
    await lugar();
    expect(await estadoBar()).toEqual(e1);
    expect(await copoes()).toEqual(cs1);
    // a noite seguinte: a novidade de quem já ficou 1 noite e a galera nova entram no total
    ir(ini + DIA + 2 * H);
    await lugar();
    juntos((await noiteCopoes(ini + DIA)).map((k) => k.total), totaisTs(cs1, { nivel: 1, galera: e1.fas, sexta: false, dj: null }));
  });

  it('Review Focus 1: some 3 dias: só a primeira noite abre, as fichas dela entram uma vez, a revelação sai na volta', async () => {
    await bar();
    await por({ nome: 'Sumiu' });
    const [c] = await copoes();
    const ini = inicioNoite(iso(agora).slice(0, 10)); // quarta 18h
    ir(ini + 3 * DIA + 2 * H); // sábado 20h de Brasília
    await abrirJogo(); // só o avancar
    let ns = await noitesDb();
    // quarta abriu (passou às 15h); quinta e sexta ninguém abriu (sem linha); sábado: a de hoje, fechada pra quem chegou agora
    expect(ns.map((n) => [n.inicio.getTime(), n.aberta, n.fechada])).toEqual([[ini, true, true], [ini + 3 * DIA, false, false]]);
    const [tot] = totaisTs([c], { nivel: 1, galera: 0, sexta: false, dj: null });
    expect(rel(await fichas(), tot * lucroVenda(c))).toBeLessThan(1e-12);
    expect((await copoes())[0]).toMatchObject({ noites: 1, revelado: false });
    expect(await prods()).toEqual([]);
    expect(await notasCad()).toEqual([]);
    expect((await estadoBar()).volume).toBe(0);
    // a próxima visita revela, com a hora do fim da primeira noite (quando ela vendeu a noite inteira)
    let m = (await lugar()).mecanica;
    expect(m.hoje).toMatchObject({ aberta: false, vendido_ate_agora: 0 });
    expect(Date.parse(m.ultima_noite!.inicio as string)).toBe(ini);
    const ps = await prods();
    expect(ps).toHaveLength(1);
    expect(ps[0]).toMatchObject({ nome: 'Sumiu', partes: [1, 1, 1, 2, 5], numero: c.nota });
    expect(ps[0].criado_em.getTime()).toBe(ini + 8 * H);
    expect(await notasCad()).toEqual([
      { tipo: 'aguenta', a: 1, b: 5, rotulo: c.aguenta },
      { tipo: 'par', a: 101, b: 0, rotulo: c.rot_bm },
      { tipo: 'par', a: 10101, b: 0, rotulo: c.rot_be },
      { tipo: 'par', a: 20101, b: 0, rotulo: c.rot_me },
    ]);
    const e1 = await estadoBar();
    expect(e1.volume).toBe(1);
    expect((await copoes())[0].revelado).toBe(true);
    // voltar de novo não paga nada de novo
    await lugar();
    ir(agora + H);
    await abrirJogo();
    await lugar();
    expect(await estadoBar()).toEqual(e1);
    expect(await prods()).toHaveLength(1);
    ns = await noitesDb();
    expect(ns).toHaveLength(2);
    // passou no sábado: a de domingo abre
    ir(ini + 4 * DIA + H);
    m = (await lugar()).mecanica;
    expect(m.hoje.aberta).toBe(true);
    expect((await noitesDb()).map((n) => [n.inicio.getTime(), n.aberta])).toEqual([[ini, true], [ini + 3 * DIA, false], [ini + 4 * DIA, true]]);
    expect(await noiteCopoes(ini + 4 * DIA)).toHaveLength(1);
  });

  it('nunca passou (visto_em nulo): nenhuma noite abre', async () => {
    await bar();
    await por();
    await q('update public.idle_state set visto_em = null where user_id = $1', [A]);
    ir(agora + 4 * H); // quarta 19h
    await q('select public.idle_cup_avancar(s) from public.idle_state s where user_id = $1', [A]);
    expect((await noitesDb()).map((n) => n.aberta)).toEqual([false]);
    expect(await fichas()).toBe(0);
  });

  it('a noite só começa depois das 18h: o copão posto às 18h em ponto estreia nela', async () => {
    await bar();
    const ini = inicioNoite(iso(agora).slice(0, 10));
    ir(ini);
    await por();
    expect(await noitesDb()).toEqual([]);
    const [c] = await copoes();
    expect(c.primeira_noite.getTime()).toBe(ini);
    expect((await lugar()).mecanica.hoje.aberta).toBe(true);
    ir(ini + H);
    await lugar();
    expect((await noiteCopoes(ini)).map((k) => k.copao)).toEqual([c.id]);
  });

  it('Review Focus 2: a noite de domingo atravessa a meia-noite e a virada da semana: vende e dá PT uma vez, na noite certa', async () => {
    await bar();
    await por();
    const ini = inicioNoite(iso(agora).slice(0, 10)); // quarta 18h
    const dom = ini + 4 * DIA; // domingo 18h de Brasília
    expect(ehSexta(dom)).toBe(false);
    ir(dom - 3 * H); // passa no domingo às 15h (a de domingo abre)
    await lugar();
    const semanaDom = await semana();
    const [c] = await copoes();
    expect(c.noites).toBe(1); // a de quarta
    await ajustar(c.id, { chance_pt: 100 });
    await setFas(1000);
    const [tot] = totaisTs([c], { nivel: 1, galera: 1000, sexta: false, dj: null });
    const m0 = await fichas();
    for (const h of [2.5, 5.5, 6.5, 7.99, 9, 12]) { // 20h30, 23h30, 0h30 (segunda), 1h59, 3h, 6h
      ir(dom + h * H);
      const m = (await lugar()).mecanica;
      const ks = await noiteCopoes(dom);
      expect(ks).toHaveLength(1);
      expect(rel(ks[0].total, tot), `${h}`).toBeLessThan(1e-12);
      expect(rel(ks[0].vendidos, vendidoNaNoite(tot, dom, agora)), `${h}`).toBeLessThan(1e-12);
      expect(rel((await fichas()) - m0, vendidoNaNoite(tot, dom, agora) * lucroVenda(c)), `${h}`).toBeLessThan(1e-9);
      if (h < 8) expect(Date.parse(m.hoje.inicio), `${h}`).toBe(dom);
      // a de segunda (18h) ainda não começou: nenhuma linha depois da de domingo
      expect((await ultimaDb()).inicio.getTime()).toBe(dom);
    }
    expect(await semana()).not.toBe(semanaDom); // virou a semana no meio da noite
    expect(await ultimaDb()).toMatchObject({ aberta: true, fechada: true, pt: true, sexta: false });
    expect(rel((await estadoBar()).fas, galeraNoite(1000, 1, [c.nota], true))).toBeLessThan(1e-12);
    expect((await copoes())[0].noites).toBe(2); // quarta e domingo
    expect(await conquistas()).toContain(115);
  });

  it('Review Focus 2: a sexta pesa 2× do começo ao fim, com o DJ escolhido quando ela começou (×1,2 nas bases dele)', async () => {
    await bar();
    await por({ nome: 'Vodka' }); // base 1: o DJ 2 curte
    await por({ base: 2, mistura: 2, nome: 'Cachaça' }); // base 2: não curte
    const ini = inicioNoite(iso(agora).slice(0, 10)); // quarta 18h
    const sex = ini + 2 * DIA;
    expect(ehSexta(sex)).toBe(true);
    ir(sex - DIA - 3 * H); // quinta 15h
    await lugar();
    ir(sex - 3 * H); // sexta 15h
    await escolherDj(2);
    const fas = (await estadoBar()).fas;
    const cs = await copoes();
    ir(sex + 2 * H);
    await lugar();
    expect(await ultimaDb()).toMatchObject({ sexta: true, dj: 2, aberta: true });
    const tot = totaisTs(cs, { nivel: 1, galera: fas, sexta: true, dj: 2 });
    const normal = totaisTs(cs, { nivel: 1, galera: fas, sexta: false, dj: null });
    juntos((await noiteCopoes(sex)).map((k) => k.total), tot);
    expect(rel(tot[0], normal[0] * 2.4)).toBeLessThan(1e-12);
    expect(rel(tot[1], normal[1] * 2)).toBeLessThan(1e-12);
    // trocar o DJ no meio da noite não muda a de sexta
    ir(sex + 3 * H);
    await escolherDj(null);
    expect((await ultimaDb()).dj).toBe(2);
    ir(sex + 7 * H); // sábado 1h de Brasília: ainda a noite de sexta
    await lugar();
    const ks = await noiteCopoes(sex);
    juntos(ks.map((k) => k.total), tot);
    juntos(ks.map((k) => k.vendidos), tot.map((x) => (x * 7) / 8));
    ir(sex + DIA + 2 * H); // sábado 20h
    await lugar();
    const ns = await noitesDb();
    expect(ns.find((n) => n.inicio.getTime() === sex)).toMatchObject({ fechada: true, sexta: true, dj: 2 });
    expect(ns.at(-1)).toMatchObject({ sexta: false, dj: null, aberta: true });
    juntos((await noiteCopoes(sex + DIA)).map((k) => k.total),
      totaisTs(await copoes(), { nivel: 1, galera: (await estadoBar()).fas, sexta: false, dj: null }));
  });

  it('Review Focus 3: PT pela semente (receita, noite), igual ao TS; recarregar dá o mesmo', async () => {
    await bar();
    await por({ forca: 10, preco: 33, nome: 'Forte' }); // vodka força 10: 50% de PT por noite
    await por({ extra: 2, forca: 8, preco: 30, nome: 'Médio' }); // 30%
    const cs = await copoes();
    expect(cs.map((c) => c.chance_pt)).toEqual([50, 30]);
    const ini = inicioNoite(iso(agora).slice(0, 10));
    const vistos: boolean[] = [];
    for (let d = 0; d < 8; d++) {
      ir(ini + d * DIA + H);
      await lugar();
      await lugar();
      const esperado = cs.map((c) => ptTs(c, ini + d * DIA));
      expect((await noiteCopoes(ini + d * DIA)).map((k) => k.pt), `noite ${d}`).toEqual(esperado);
      vistos.push(...esperado);
    }
    expect(vistos).toContain(true);
    expect(vistos).toContain(false);
    const fechadas = (await noitesDb()).filter((n) => n.fechada);
    expect(fechadas).toHaveLength(7);
    for (const n of fechadas) expect(n.pt).toBe(cs.some((c) => ptTs(c, n.inicio.getTime())));
  });

  it('tirar e pôr de novo a mesma receita não muda a sorte do PT nem zera a novidade', async () => {
    await bar();
    await por({ forca: 10, preco: 33, nome: 'Forte' });
    const [c] = await copoes();
    const ini = inicioNoite(iso(agora).slice(0, 10));
    ir(ini + 9 * H); // a de quarta fechou: 1 noite
    await lugar();
    ir(ini + 20 * H); // quinta 14h: tira e põe de novo a mesma receita (com outro preço e nome)
    await tirar(c.id);
    await por({ forca: 10, preco: 40, nome: 'Forte de novo' });
    const c2 = (await copoes())[1];
    expect(c2.noites).toBe(1); // a novidade continua de onde a receita parou
    ir(ini + DIA + H);
    await lugar();
    const [k] = await noiteCopoes(ini + DIA);
    expect(k.copao).toBe(c2.id);
    expect(k.pt).toBe(ptTs(c, ini + DIA)); // a mesma sorte da receita
    const [tot] = totaisTs([c2], { nivel: 1, galera: (await estadoBar()).fas, sexta: false, dj: null });
    expect(rel(k.total, tot)).toBeLessThan(1e-12);
    // tirar e pôr no meio da noite: a noite em andamento também conta (2 = a de quarta e a de quinta)
    await tirar(c2.id);
    await por({ forca: 10, preco: 41, nome: 'Terceiro' });
    expect((await copoes())[2].noites).toBe(2);
    // outra receita (outro tamanho) começa do zero
    await por({ tamanho: 1, preco: 10, nome: 'Copinho' });
    expect((await copoes())[3].noites).toBe(0);
  });

  it('Review Focus 3: dois copões em PT tiram 15% da galera uma vez só na noite; a conquista sai no depois', async () => {
    await bar();
    await por({ nome: 'Um' });
    await por({ extra: 2, nome: 'Dois' });
    const cs = await copoes();
    for (const c of cs) await ajustar(c.id, { chance_pt: 100 });
    await setFas(1000);
    const ini = inicioNoite(iso(agora).slice(0, 10));
    ir(ini + 9 * H);
    await abrirJogo();
    expect((await noiteCopoes(ini)).map((k) => k.pt)).toEqual([true, true]);
    const notas = cs.map((c) => c.nota);
    const g = galeraNoite(1000, 1, notas, true);
    const fas = (await estadoBar()).fas;
    expect(rel(fas, g)).toBeLessThan(1e-12);
    expect(rel(fas, galeraNoite(1000, 1, notas, false) * 0.85)).toBeLessThan(1e-12);
    expect(fas).toBeGreaterThan(galeraNoite(1000, 1, notas, false) * 0.85 * 0.85 + 1);
    expect(await conquistas()).not.toContain(115); // conquista só no depois
    await lugar();
    await lugar();
    expect((await estadoBar()).fas).toBe(fas);
    expect(await conquistas()).toContain(115);
    const n = (await noitesDb())[0];
    expect(n).toMatchObject({ pt: true, fechada: true, conferida: true });
    expect(rel(n.galera_delta, g - 1000)).toBeLessThan(1e-12);
  });

  it('Review Focus 4: copão tirado no meio da noite vende até a hora em que saiu; o que saiu antes de estrear não entra', async () => {
    await bar();
    await por({ nome: 'Sai' });
    await por({ extra: 2, nome: 'Fica' });
    await por({ extra: 3, nome: 'Nem estreia' });
    const cs = await copoes();
    await tirar(cs[2].id); // quarta 15h: saiu antes da primeira noite
    const ini = inicioNoite(iso(agora).slice(0, 10));
    const ativos = cs.slice(0, 2);
    const tot = totaisTs(ativos, { nivel: 1, galera: 0, sexta: false, dj: null });
    ir(ini + 3 * H); // quarta 21h
    await tirar(cs[0].id);
    ir(ini + 5 * H);
    await lugar();
    let ks = await noiteCopoes(ini);
    expect(ks.map((k) => k.copao)).toEqual([cs[0].id, cs[1].id]);
    juntos(ks.map((k) => k.total), tot); // o total ficou o do início
    juntos(ks.map((k) => k.vendidos), [(tot[0] * 3) / 8, (tot[1] * 5) / 8]);
    ir(ini + 9 * H);
    await lugar();
    ks = await noiteCopoes(ini);
    juntos(ks.map((k) => k.vendidos), [(tot[0] * 3) / 8, tot[1]]);
    const lucros = ativos.map((c) => lucroVenda(c));
    expect(rel(await fichas(), ((tot[0] * 3) / 8) * lucros[0] + tot[1] * lucros[1])).toBeLessThan(1e-12);
    // o que saiu no meio da primeira noite nunca é revelado (nem pódio, nem caderninho, nem volume); o que ficou, sim
    expect((await copoes()).map((c) => [c.revelado, c.noites])).toEqual([[false, 1], [true, 1], [false, 0]]);
    expect((await prods()).map((p) => p.nome)).toEqual(['Fica']);
    expect((await estadoBar()).volume).toBe(1);
    expect(await notasCad()).toHaveLength(4); // os 3 pares e o "aguenta" do 'Fica'
    const u = (await lugar()).mecanica.ultima_noite!;
    expect(u.copoes.map((x) => x.id)).toEqual([cs[1].id]);
    expect(rel(u.vendas as number, ks[0].vendidos + ks[1].vendidos)).toBeLessThan(1e-12);
    // a noite de quinta: só o que ficou
    ir(ini + DIA + H);
    await lugar();
    expect((await noiteCopoes(ini + DIA)).map((k) => k.copao)).toEqual([cs[1].id]);
    expect((await copoes())[2].revelado).toBe(false);
    ir(ini + DIA + 9 * H);
    await lugar();
    expect((await copoes()).map((c) => c.revelado)).toEqual([false, true, false]);
    expect((await estadoBar()).volume).toBe(1);
  });

  it('o PT de quem saiu com menos de 1 h de noite não conta (nem a galera, nem a conquista); com 1 h, conta', async () => {
    await bar();
    await por({ nome: 'Sai cedo' });
    await por({ extra: 2, nome: 'Fica' });
    const cs = await copoes();
    await ajustar(cs[0].id, { chance_pt: 100 });
    await setFas(1000);
    const ini = inicioNoite(iso(agora).slice(0, 10));
    ir(ini + 59 * 60_000); // 18h59
    await tirar(cs[0].id);
    ir(ini + 9 * H);
    await lugar();
    expect((await noiteCopoes(ini)).map((k) => k.pt)).toEqual([false, false]);
    expect(await ultimaDb()).toMatchObject({ pt: false, fechada: true });
    expect(rel((await estadoBar()).fas, galeraNoite(1000, 1, cs.map((c) => c.nota), false))).toBeLessThan(1e-12);
    expect(await conquistas()).not.toContain(115);
    // na noite seguinte, um que sai com 1 h em ponto: conta
    await por({ extra: 3, nome: 'Sai com 1 h' });
    const c3 = (await copoes())[2];
    await ajustar(c3.id, { chance_pt: 100 });
    const fas = (await estadoBar()).fas;
    ir(ini + DIA + H);
    await lugar();
    await tirar(c3.id);
    ir(ini + DIA + 9 * H);
    await lugar();
    expect((await noiteCopoes(ini + DIA)).map((k) => [k.copao, k.pt])).toEqual([[cs[1].id, false], [c3.id, true]]);
    expect(await ultimaDb()).toMatchObject({ pt: true });
    expect(rel((await estadoBar()).fas, galeraNoite(fas, 1, [cs[1].nota, c3.nota], true))).toBeLessThan(1e-12);
    expect(await conquistas()).toContain(115);
  });

  it('o fim da noite usa o nível e a galera do começo dela (gravados na linha), mesmo que mudem no meio', async () => {
    await bar(5);
    await por();
    const [c] = await copoes();
    await ajustar(c.id, { nota: 900, chance_pt: 0 });
    await setFas(400);
    const ini = inicioNoite(iso(agora).slice(0, 10));
    ir(ini + H);
    await lugar();
    expect(await ultimaDb()).toMatchObject({ nivel: 5, galera: 400 });
    await setNivel(20); // subiu de nível no meio da noite
    ir(ini + 9 * H);
    await lugar();
    const g = galeraNoite(400, 5, [900], false);
    expect(g).not.toBe(galeraNoite(400, 20, [900], false));
    expect(rel((await estadoBar()).fas, g)).toBeLessThan(1e-12);
    expect(rel((await ultimaDb()).galera_delta, g - 400)).toBeLessThan(1e-12);
  });
});

describe('o depois do copão', () => {
  it('marcos de volume, galera e lendário e a conquista da nota só saem no depois', async () => {
    await bar();
    await setFas(999);
    await q('update public.idle_place_state set volume = 29 where user_id = $1 and lugar = 4', [A]);
    await por();
    const [c] = await copoes();
    await ajustar(c.id, { nota: 999, chance_pt: 0 });
    const ini = inicioNoite(iso(agora).slice(0, 10));
    ir(ini + 9 * H);
    await abrirJogo(); // a noite fechou: a galera subiu (round(35 · 0,02 · 1) = 1), mas nada de marco
    let e = await estadoBar();
    expect(e).toMatchObject({ fas: 1000, volume: 29, lendario: false, marcos: [] });
    expect(await conquistas()).not.toContain(89);
    const resp = await lugar();
    e = await estadoBar();
    expect(e).toMatchObject({ fas: 1000, volume: 30, lendario: true });
    expect([...e.marcos].sort()).toEqual([46, 47, 48]);
    expect([...resp.marcos_novos!].sort()).toEqual([46, 47, 48]);
    expect(await conquistas()).toContain(89);
    const [n] = await noitesDb();
    expect(n.conferida).toBe(true);
    expect(rel(n.galera_delta, 1)).toBeLessThan(1e-12);
  });

  it('nota abaixo de 900: sem lendário e sem a conquista 89', async () => {
    await bar();
    await por();
    const [c] = await copoes();
    await ajustar(c.id, { nota: 899 });
    ir(c.primeira_noite.getTime() + 9 * H);
    await lugar();
    expect((await copoes())[0].revelado).toBe(true);
    expect((await estadoBar()).lendario).toBe(false);
    expect(await conquistas()).not.toContain(89);
    expect(await conquistas()).not.toContain(115);
  });
});

describe('desafios do copão', () => {
  type D = { id: number; lugar: number; tipo: string; valor: number; texto: string; premio: string; premio_valor: number };
  let todos: D[] = [];
  async function soDesafio(id: number) {
    if (todos.length === 0) todos = await q<D>('select * from public.idle_cat_place_desafio where lugar = 4 order by id');
    const d = todos.find((x) => x.id === id)!;
    await q('delete from public.idle_cat_place_desafio where lugar = 4');
    await q(`insert into public.idle_cat_place_desafio (id, lugar, tipo, valor, texto, premio, premio_valor) values ($1, $2, $3, $4, $5, $6, $7)`,
      [d.id, d.lugar, d.tipo, d.valor, d.texto, d.premio, d.premio_valor]);
  }
  const feitos = async () => (await q<{ d: number }>(
    'select desafio as d from public.idle_place_challenges where user_id = $1 and lugar = 4', [A])).map((x) => x.d);
  const limpar = async () => {
    await q('delete from public.idle_place_challenges where user_id = $1', [A]);
    await q('delete from public.idle_cup_copoes where user_id = $1', [A]);
    await q('delete from public.idle_place_notes where user_id = $1', [A]);
    await setFas(0);
  };
  type Copo = { o?: Partial<Opcoes>; aj?: Ajuste };
  /** Põe os copões (ajustados antes de estrear), passa no começo da primeira noite deles e, com `fechar`, no fim dela (a
   *  revelação sai aí); tira todos e vai pro dia seguinte às 16h. */
  async function noite(copos: Copo[], fechar: boolean) {
    for (const [k, x] of copos.entries()) {
      await por({ extra: k + 1, ...x.o });
      if (x.aj) await ajustar((await copoes()).at(-1)!.id, x.aj);
    }
    const ini = (await copoes()).at(-1)!.primeira_noite.getTime();
    ir(ini + 60_000);
    await lugar();
    if (fechar) {
      ir(ini + 9 * H);
      await lugar();
    }
    for (const c of await copoes()) if (c.saiu_em === null) await tirar(c.id);
    ir(ini + 22 * H);
  }
  const CASOS: [number, Copo[][], Copo[], boolean][] = [
    // os da nota e das partes: pagam na revelação, no fim da primeira noite
    [401, [[{ aj: { nota: 699 } }]], [{ aj: { nota: 700 } }], true],
    [412, [[{ aj: { nota: 849 } }]], [{ aj: { nota: 850 } }], true],
    [407, [[{ aj: { sabor: 299 } }]], [{ aj: { sabor: 300 } }], true],
    [408, [[{ aj: { moda: 75 } }]], [{ aj: { moda: 150 } }], true],
    [410, [[{ aj: { aguenta: 170 } }]], [{ aj: { aguenta: 199 } }], true],
    // a galera: média 500 não mexe; 999 soma round(35 · 0,02) = 1
    [403, [[{ aj: { nota: 500, chance_pt: 0 } }]], [{ aj: { nota: 999, chance_pt: 0 } }], true],
    // cardápio cheio (3 vagas no nível 1)
    [405, [[{ aj: { nota: 900 } }, { aj: { nota: 900 } }], [{ aj: { nota: 599 } }, { aj: { nota: 900 } }, { aj: { nota: 900 } }]],
      [{ aj: { nota: 600 } }, { aj: { nota: 700 } }, { aj: { nota: 800 } }], true],
    // lucro com cardápio cheio: 2 copões não enchem; a 1 ficha cada venda dá prejuízo
    [411, [[{}, {}], [{ aj: { preco: 1 } }, { aj: { preco: 1 } }, { aj: { preco: 1 } }]], [{}, {}, {}], true],
    [402, [[{ aj: { nota: 699, chance_pt: 0 } }]], [{ aj: { nota: 700, chance_pt: 0 } }], true],
  ];
  it('cada tipo com o valor dele: o que não alcança não paga, o que alcança paga', async () => {
    await bar();
    for (const [id, nao, sim, fechar] of CASOS) {
      await soDesafio(id);
      await limpar();
      for (const caso of nao) {
        await noite(caso, fechar);
        expect(await feitos(), `${id} ${JSON.stringify(caso)}`).toEqual([]);
      }
      await noite(sim, fechar);
      expect(await feitos(), `${id}`).toEqual([id]);
    }
  });
  it('balde no cardápio: paga na hora de pôr; o copo não', async () => {
    await bar();
    await setNivel(7);
    await soDesafio(406);
    await por({ tamanho: 1, preco: 8 });
    expect(await feitos()).toEqual([]);
    const v0 = await valuation();
    await por({ tamanho: 3, preco: 75 });
    expect(await feitos()).toEqual([406]);
    expect(await valuation()).toBeGreaterThan(v0);
  });
  it('sexta com o DJ que combina com 2 copões: paga quando a noite de sexta começa; noutra noite não', async () => {
    await bar();
    await soDesafio(404);
    await escolherDj(2); // curte a base 1
    await por({ nome: 'Vodka 1' });
    await por({ base: 2, mistura: 2, nome: 'Cachaça' });
    const ini = inicioNoite(iso(agora).slice(0, 10)); // quarta 18h
    ir(ini + H);
    await lugar();
    ir(ini + DIA - 3 * H); // quinta 15h: troca a cachaça por outra vodka
    await tirar((await copoes())[1].id);
    await por({ extra: 2, nome: 'Vodka 2' });
    ir(ini + DIA + H); // quinta 19h: 2 vodkas, mas não é sexta
    await lugar();
    expect((await noiteCopoes(ini + DIA))).toHaveLength(2);
    expect(await feitos()).toEqual([]);
    ir(ini + 2 * DIA - 3 * H); // sexta 15h
    await lugar();
    expect(await feitos()).toEqual([]);
    ir(ini + 2 * DIA + 60_000); // sexta 18h01
    await lugar();
    expect(await feitos()).toEqual([404]);
  });
  it('sexta com 1 copão só da base do DJ não paga', async () => {
    await bar();
    await soDesafio(404);
    await escolherDj(2);
    await por({ nome: 'Vodka' });
    await por({ base: 2, mistura: 2, nome: 'Cachaça' });
    const ini = inicioNoite(iso(agora).slice(0, 10));
    for (const d of [0, 1, 2]) {
      ir(ini + d * DIA + H);
      await lugar();
    }
    ir(ini + 2 * DIA + 9 * H);
    await lugar();
    expect((await noitesDb()).find((n) => n.sexta)).toMatchObject({ aberta: true, fechada: true, dj: 2 });
    expect(await feitos()).toEqual([]);
  });
  it('5 noites abertas na semana (com copão no cardápio): paga quando a 5ª começa', async () => {
    await bar();
    await soDesafio(409);
    const ini = inicioNoite(iso(agora).slice(0, 10)); // quarta 18h
    const seg = ini + 5 * DIA; // segunda 18h
    ir(seg - 3 * H);
    await por();
    for (let d = 0; d < 5; d++) {
      ir(seg + d * DIA + H);
      await lugar();
      expect(await feitos(), `noite ${d + 1}`).toEqual(d < 4 ? [] : [409]);
    }
  });
  it('copão 700+ sem PT na semana: o PT da noite ou de antes na semana não deixa; na semana seguinte paga', async () => {
    await bar();
    await soDesafio(402);
    const ini = inicioNoite(iso(agora).slice(0, 10));
    const seg = ini + 5 * DIA; // segunda 18h
    ir(seg - 3 * H);
    await por({ nome: 'Bomba' });
    const [c] = await copoes();
    await ajustar(c.id, { nota: 900, chance_pt: 100 });
    ir(seg + 9 * H); // terça 3h: a de segunda deu PT
    await lugar();
    expect(await ultimaDb()).toMatchObject({ pt: true, fechada: true });
    expect(await feitos()).toEqual([]);
    await ajustar(c.id, { chance_pt: 0 });
    ir(seg + DIA + 9 * H); // quarta 3h: a de terça sem PT, mas a semana já teve
    await lugar();
    expect(await ultimaDb()).toMatchObject({ pt: false, fechada: true, aberta: true });
    expect(await feitos()).toEqual([]);
    ir(seg + 7 * DIA - 3 * H); // a outra segunda, 15h
    await lugar();
    ir(seg + 7 * DIA + 9 * H);
    await lugar();
    expect(await feitos()).toEqual([402]);
  });
  it('pago uma vez só na semana', async () => {
    await bar();
    await soDesafio(401);
    const taxa = async () => (await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [A]))[0].r;
    for (const k of [0, 1]) {
      await por({ extra: k + 1 });
      const c = (await copoes()).at(-1)!;
      await ajustar(c.id, { nota: 800 });
      ir(c.primeira_noite.getTime() + 9 * H);
      await abrirJogo(); // fecha a conta e a noite até agora (sem o depois)
      const v0 = await valuation();
      await lugar(); // revela: paga (ou não) sem passar tempo
      const dv = (await valuation()) - v0;
      if (k === 0) expect(rel(dv, 2 * 3600 * (await taxa()))).toBeLessThan(1e-6);
      else expect(dv).toBe(0);
      ir(agora + 20 * H);
    }
    expect(await feitos()).toEqual([401]);
  });
});
