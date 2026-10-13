// Copão (0059, lugar 4 do Mapa do rolê), parte A: migrações reais no PGlite. As contas do banco batem com copao.ts (a nota
// e as partes dela bit a bit; o que é decimal com erro relativo < 1e-12) e as RPCs de pôr, tirar e escolher o DJ. O relógio
// fica parado numa quarta às 15h de Brasília (o now() do PGlite segue o Date falso).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LugarEstado } from '../shared/types';
import {
  abreNoite, aguenta, avaliar, BASES, chancePT, CONFLITOS, CRESCE, custoBeneficio, deuPT, DJS, ehSexta, ELASTICIDADE, EXTRAS,
  fimNoite, GALERA_TETO, galeraNoite, inicioNoite, liberado, lucroVenda, MISTURAS, moda, modaDaSemana, movimento, noiteIdx,
  noitesEntre, novidade, PONTOS, precoRef, precoValido, publico, PUBLICO_BASE, rotuloPar, rotulos, sabor, TAMANHOS, vagas,
  vendasNoite, vendidoNaNoite, type Copao, type NoCardapio, type Sabor, type TipoPar,
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
type NoCardapioJson = Record<string, unknown> & { id: number; nome: string; revelado: boolean; nota: number | null };
type Cup = {
  moda: { base: number; mistura: number }; dj: number | null; vagas: number; cardapio: NoCardapioJson[];
  hoje: { aberta: boolean; inicio: string; fim: string; sexta: boolean; dj: number | null; vendido_ate_agora: number; fichas_ate_agora: number };
  ultima_noite: (Record<string, unknown> & { copoes: Record<string, unknown>[] }) | null;
  historico: (Record<string, unknown> & { id: number; nome: string })[];
};
type Resp = { lugar: LugarEstado & { mecanica: Cup }; marcos_novos: number[] };

type Opcoes = { base: number; mistura: number; extra: number; tamanho: number; forca: number | null; preco: number | null; nome: string };
// Vodka + Energético tradicional + Limão no Copão, força 5, 22 fichas (referência 27,5)
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
    const tamanhos = await q<Record<string, unknown>>('select id, nome, doses, ref, nivel from public.idle_cup_cat_tamanho order by id');
    expect(tamanhos).toEqual(TAMANHOS.map((x) => ({ ...x })));
    const djs = await q<Record<string, unknown>>('select id, nome, estilo, bases, nivel from public.idle_cup_cat_dj order by id');
    expect(djs).toEqual(DJS.map((x) => ({ ...x, bases: [...x.bases] })));
    const conflitos = await q<{ a: string; b: string }>('select a, b from public.idle_cup_cat_conflito order by a, b');
    expect(conflitos.map((c) => [c.a, c.b])).toEqual(
      CONFLITOS.map(([a, b]) => [a, b]).sort((x, y) => (x[0] + ' ' + x[1]).localeCompare(y[0] + ' ' + y[1])));
    expect(await q('select publico_base, cresce, elasticidade, galera_teto, pontos from public.idle_cup_const')).toEqual([
      { publico_base: PUBLICO_BASE, cresce: CRESCE, elasticidade: ELASTICIDADE, galera_teto: GALERA_TETO, pontos: [...PONTOS] },
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
      'public.idle_cup_rotulos(1, 1, 1)', 'public.idle_cup_sabor(1, 1, 1)', 'public.idle_cup_preco_ref(1, 5)', 'public.idle_cup_preco_valido(1, 5, 8)',
      'public.idle_cup_custo_beneficio(1, 5, 8)', 'public.idle_cup_moda_base(current_date)', 'public.idle_cup_moda_mistura(current_date)',
      'public.idle_cup_moda(1, 1, current_date)', 'public.idle_cup_aguenta(5, 5)', 'public.idle_cup_chance_pt(5, 5)', 'public.idle_cup_deu_pt(1, 1, 50)',
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
  it('preço de referência, preço válido e custo-benefício de todo tamanho, força e preço', async () => {
    const rows = await q<{ t: number; f: number; p: number; ref: number; ok: boolean; cb: number }>(
      `select t, f, p, public.idle_cup_preco_ref(t, f) as ref, public.idle_cup_preco_valido(t, f, p) as ok,
              public.idle_cup_custo_beneficio(t, f, p) as cb
         from generate_series(1, 3) t cross join generate_series(1, 10) f cross join generate_series(0, 185) p`);
    let validos = 0;
    for (const x of rows) {
      const caso = `${x.t}/${x.f}/${x.p}`;
      expect(x.ref, caso).toBe(precoRef(x.t, x.f));
      expect(x.ok, caso).toBe(precoValido(x.t, x.f, x.p));
      expect(x.cb, caso).toBe(custoBeneficio(x.t, x.f, x.p));
      if (x.ok) validos++;
    }
    expect(validos).toBe(1732);
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
      const ref = precoRef(tamanho, forca);
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
  it('deuPT em 200 casos (e reabrir dá o mesmo)', async () => {
    const r = rng(7919);
    let deu = 0;
    for (let i = 0; i < 200; i++) {
      const id = ent(r, 1, 50_000_000);
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
  it('vendas da noite em 200 cardápios (canibal, sexta, DJ, elasticidade, nota 0)', async () => {
    const r = rng(1999);
    const visto = { canibal: 0, sextaDj: 0, curte: 0, vazio: 0, zero: 0, cheia: 0 };
    for (let i = 0; i < 200; i++) {
      const n = ent(r, 0, 5);
      const cardapio: NoCardapio[] = [];
      for (let k = 0; k < n; k++) {
        const repete = k > 0 && r() < 0.2 ? cardapio[ent(r, 0, k - 1)] : null;
        const tamanho = ent(r, 1, 3);
        const forca = ent(r, 1, 10);
        const ref = precoRef(tamanho, forca);
        cardapio.push({
          base: repete ? repete.base : ent(r, 1, 12), mistura: repete ? repete.mistura : ent(r, 1, 15), tamanho, forca,
          preco: ent(r, Math.ceil(0.5 * ref), Math.floor(2 * ref)), nota: r() < 0.05 ? 0 : ent(r, 0, 999), noites: ent(r, 0, 9),
        });
      }
      const noite = { nivel: ent(r, 1, 25), galera: r() < 0.2 ? 0 : r() * 3000, sexta: r() < 0.4, dj: r() < 0.25 ? null : ent(r, 1, 10) };
      const esperado = vendasNoite(cardapio, noite);
      const somaAtr = cardapio.reduce((s, c) => s + (c.nota / 999) ** 2 * novidade(c.noites), 0);
      if (n === 0) visto.vazio++;
      if (n > 0 && esperado.every((v) => v === 0)) visto.zero++;
      if (somaAtr > 1) visto.cheia++;
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
    // Copão força 5: referência 27,5, preço de 14 a 55
    for (const [o, erro] of [
      [{ base: 4 }, /idle_cup_trancado/], [{ mistura: 5 }, /idle_cup_trancado/], [{ extra: 4 }, /idle_cup_trancado/],
      [{ tamanho: 3, preco: 75 }, /idle_cup_trancado/],
      [{ base: 13 }, /idle_bad_choice/], [{ mistura: 0 }, /idle_bad_choice/], [{ extra: 13 }, /idle_bad_choice/], [{ tamanho: 4 }, /idle_bad_choice/],
      [{ forca: 0 }, /idle_cup_forca/], [{ forca: 11 }, /idle_cup_forca/], [{ forca: null }, /idle_cup_forca/],
      [{ preco: 13 }, /idle_cup_preco/], [{ preco: 56 }, /idle_cup_preco/], [{ preco: null }, /idle_cup_preco/], [{ preco: 0 }, /idle_cup_preco/],
      [{ nome: '   ' }, /idle_lugar_nome/], [{ nome: 'x'.repeat(31) }, /idle_lugar_nome/], [{ nome: 'a\nb' }, /idle_lugar_nome/],
    ] as [Partial<Opcoes>, RegExp][]) {
      await expect(por(o), JSON.stringify(o)).rejects.toThrow(erro);
      await nada();
    }
    // os limites da faixa passam
    await por({ preco: 14 });
    await por({ preco: 55, extra: 2 });
    expect((await copoes()).map((c) => c.preco)).toEqual([14, 55]);
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
    expect(m).toMatchObject({ moda: modaDaSemana(await semana()), dj: null, vagas: 3, cardapio: [], ultima_noite: null, historico: [] });
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
  it('esconde nota, partes, rótulos e chance de PT até a primeira noite começar', async () => {
    await bar();
    await por();
    const [c] = await copoes();
    let k = (await lugar()).mecanica.cardapio[0];
    expect(k).toMatchObject({ id: c.id, nome: 'Copão da Casa', base: 1, mistura: 1, extra: 1, tamanho: 2, forca: 5, preco: 22, revelado: false,
      nota: null, sabor: null, cb: null, moda: null, aguenta: null, rotulos: null, chance_pt: null, noites: 0, vendido: 0, fichas: 0 });
    expect(Date.parse(k.primeira_noite as string)).toBe(c.primeira_noite.getTime());
    andar(3 * H - 1);
    expect((await lugar()).mecanica.cardapio[0].nota).toBeNull();
    andar(1);
    k = (await lugar()).mecanica.cardapio[0];
    expect(k).toMatchObject({ revelado: true, nota: c.nota, sabor: c.sabor, cb: c.cb, moda: c.moda, aguenta: c.aguenta,
      rotulos: [c.rot_bm, c.rot_be, c.rot_me], chance_pt: c.chance_pt });
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
