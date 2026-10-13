// Mapa do rolê, a moldura (0066): migrações reais no PGlite. Lugares de verdade não entram aqui: os testes põem
// lugares de mentira em idle_places quando precisam.
import { beforeEach, describe, expect, it } from 'vitest';

import type { IdleState } from '../shared/types';
import { dicaProducao, porUnidade } from '../idle/dica';
import { custoNivel, LUGARES, MARCOS, multMapa } from '../idle/mapa';
import { freshDb, type TestDb } from './db';

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const OUT = '00000000-0000-0000-0000-0000000000ff';

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;
type Pino = { id: number; lancado: boolean; preco: number; aberto: boolean; nivel: number | null; nome: string | null; x: number | null; dono: { user_id: string } | null };
type Mapa = { mapa: string | null; lugares: Pino[]; mult: number };
const mapa = () => t.rpc<Mapa>('idle_mapa');
const abrir = (l: number) => t.rpc<{ valuation: number; mapa: Mapa; conquistas: { id: number }[] }>('idle_place_abrir', { p_lugar: l });
const taxa = async () => (await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [A]))[0].r;
const parar = () => q(`update public.idle_state set settled_at = now() + interval '1 day' where user_id = $1`, [A]);
/** A com a empresa na era `era` (geradores 1 e o primeiro da era), estratégias escolhidas e F$ `v`. */
async function empresa(era: number, v = 1e15) {
  const primeiro = [1, 7, 13, 19, 25][era - 1];
  await q(`update public.idle_state set valuation = $2, generators[1] = 50, generators[$3] = 1, strategies = '{0,0,0,0}' where user_id = $1`, [A, v, primeiro]);
  await parar();
}

beforeEach(async () => {
  t = await freshDb({ conquistas: true });
  await t.member(A);
  await t.member(B);
  await t.member(OUT, { isMember: false });
  await t.as(A);
  await t.rpc('idle_start');
});

describe('catálogo', () => {
  it('o banco tem os mesmos lugares e marcos de mapa.ts', async () => {
    const ls = await q<Record<string, unknown>>('select * from public.idle_cat_place order by id');
    expect(ls.map((r) => ({ id: r.id, faixa: r.faixa, horas: r.horas, era: r.era, lote: r.lote, custoBase: r.custo_base, moeda: r.moeda, moedaInicial: r.moeda_inicial, numero: r.numero })))
      .toEqual(LUGARES.map(({ id, faixa, horas, era, lote, custoBase, moeda, moedaInicial, numero }) => ({ id, faixa, horas, era, lote, custoBase, moeda, moedaInicial, numero })));
    const ms = await q<Record<string, unknown>>('select * from public.idle_cat_place_marco order by id');
    expect(ms.map((r) => ({ id: r.id, lugar: r.lugar, tipo: r.tipo, valor: r.valor, bonus: r.bonus }))).toEqual(MARCOS.map((m) => ({ ...m })));
  });
});

describe('privacidade', () => {
  it('idle_places e idle_map: membro lê, não membro e anônimo não', async () => {
    await q(`insert into public.idle_places (id, nome, x, y) values (3, 'Lugar de teste', 10, 10)`);
    expect(await t.asRole('authenticated', 'select nome from public.idle_places')).toHaveLength(1);
    await t.as(OUT);
    expect(await t.asRole('authenticated', 'select nome from public.idle_places')).toHaveLength(0);
    await expect(t.asRole('anon', 'select nome from public.idle_places')).rejects.toThrow();
  });
  it('estado dos lugares não é lido direto por ninguém', async () => {
    await expect(t.asRole('authenticated', 'select * from public.idle_place_state')).rejects.toThrow();
    await expect(t.asRole('authenticated', 'select * from public.idle_place_prod')).rejects.toThrow();
  });
});

describe('abrir', () => {
  it('idle_mapa sem empresa aberta: tudo fechado, preço 0, sem erro', async () => {
    await t.as(B);
    const m = await mapa();
    expect(m.lugares).toHaveLength(9);
    expect(m.lugares.every((l) => !l.aberto && l.preco === 0)).toBe(true);
  });
  it('não membro não vê o mapa', async () => {
    await t.as(OUT);
    await expect(mapa()).rejects.toThrow(/not_member/);
  });
  it('abre a camisetaria na era 2 pagando 2 h de produção, e ganha "Rolê marcado"', async () => {
    await empresa(2);
    const r = await taxa();
    const antes = (await q<{ v: number }>('select valuation as v from public.idle_state where user_id = $1', [A]))[0].v;
    const s = await abrir(3);
    expect(antes - s.valuation).toBeCloseTo(2 * 3600 * r, 0);
    expect(s.mapa.lugares.find((l) => l.id === 3)).toMatchObject({ aberto: true, nivel: 1 });
    expect(s.conquistas.map((c) => c.id)).toContain(83);
  });
  it('a camisetaria abre com 108 cupons; os outros lugares abrem com 0', async () => {
    await empresa(4);
    await abrir(3);
    await abrir(4);
    const ms = await q<{ lugar: number; moeda: number }>('select lugar, moeda from public.idle_place_state where user_id = $1 order by lugar', [A]);
    expect(ms).toEqual([{ lugar: 3, moeda: 108 }, { lugar: 4, moeda: 0 }]);
  });
  it('recusas: era baixa, lote não lançado, já aberto, sem dinheiro, lugar que não existe', async () => {
    await empresa(2);
    await expect(abrir(4)).rejects.toThrow(/idle_locked/); // médio pede era 3
    await expect(abrir(1)).rejects.toThrow(/idle_locked/); // lote 2
    await abrir(3);
    await expect(abrir(3)).rejects.toThrow(/idle_lugar_aberto/);
    await expect(abrir(99)).rejects.toThrow(/idle_bad_choice/);
    await empresa(4, 0);
    await expect(abrir(7)).rejects.toThrow(/idle_cant_afford/);
  });
  it('sem empresa aberta: idle_not_started', async () => {
    await t.as(B);
    await expect(abrir(3)).rejects.toThrow(/idle_not_started/);
  });
  it('valuation exatamente igual ao preço abre', async () => {
    await empresa(2);
    const preco = 2 * 3600 * (await taxa());
    await q('update public.idle_state set valuation = $2 where user_id = $1', [A, preco]);
    await parar();
    await expect(abrir(3)).resolves.toBeTruthy();
  });
  it('três abertos dão "Conhece a cidade"; vender a startup não fecha nada', async () => {
    await empresa(4);
    for (const l of [3, 4, 7]) await abrir(l);
    const ids = (await q<{ id: number }>('select conquista_id as id from public.idle_conquistas where user_id = $1', [A])).map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining([83, 84]));
    await q(`update public.idle_state set generators[30] = 150, strategies = '{0,0,0,0}', prestige_earned = 0, settled_at = now() where user_id = $1`, [A]);
    await t.rpc('idle_prestige'); // vende de verdade (sem engolir erro)
    expect((await q<{ s: boolean }>('select started as s from public.idle_state where user_id = $1', [A]))[0].s).toBe(false);
    expect((await q('select lugar from public.idle_place_state where user_id = $1', [A]))).toHaveLength(3);
  });
  it('nome, ícone e posição vêm de idle_places quando existem', async () => {
    await q(`insert into public.idle_places (id, nome, frase, x, y) values (3, 'Lugar de teste', 'frase', 40, 50)`);
    const l = (await mapa()).lugares.find((x) => x.id === 3)!;
    expect(l).toMatchObject({ nome: 'Lugar de teste', x: 40 });
    expect((await mapa()).lugares.find((x) => x.id === 4)!.nome).toBeNull();
  });
});

const nivel = (l: number) => t.rpc<{ lugar: { nivel: number }; marcos_novos: number[] }>('idle_place_nivel', { p_lugar: l });
const moeda = (l: number, v: number) => q('update public.idle_place_state set moeda = $3 where user_id = $1 and lugar = $2', [A, l, v]);

describe('nível e marcos', () => {
  it('sobe pagando custo_base × 1,55^(n−1) da moeda do lugar', async () => {
    await empresa(2);
    await abrir(3);
    await moeda(3, 1000);
    const r = await nivel(3);
    expect(r.lugar.nivel).toBe(2);
    const sobra = (await q<{ m: number }>('select moeda as m from public.idle_place_state where user_id = $1 and lugar = 3', [A]))[0].m;
    expect(sobra).toBeCloseTo(1000 - custoNivel(LUGARES[2], 1)!);
  });
  it('recusas: fechado, sem moeda, nível 25', async () => {
    await empresa(2);
    await expect(nivel(3)).rejects.toThrow(/idle_lugar_fechado/);
    await abrir(3);
    await moeda(3, 0);
    await expect(nivel(3)).rejects.toThrow(/idle_lugar_moeda/);
    await q('update public.idle_place_state set nivel = 25, moeda = 1e30 where user_id = $1 and lugar = 3', [A]);
    await expect(nivel(3)).rejects.toThrow(/idle_lugar_nivel_max/);
  });
  it('nível 5 ganha o marco 31 e a produção da empresa sobe 2%', async () => {
    await empresa(2);
    await abrir(3);
    const antes = await taxa();
    await q('update public.idle_place_state set nivel = 4, moeda = 1e9 where user_id = $1 and lugar = 3', [A]);
    const r = await nivel(3);
    expect(r.marcos_novos).toEqual([31]);
    expect(await taxa()).toBeCloseTo(antes * 1.02, 6);
  });
  it('marcos de fãs, volume e lendário', async () => {
    await empresa(2);
    await abrir(3);
    await q('update public.idle_place_state set fas = 100000, volume = 50, lendario = true where user_id = $1 and lugar = 3', [A]);
    expect(await q<{ m: number[] }>('select public.idle_place_marcos($1, 3) as m', [A])).toEqual([{ m: [36, 37, 38] }]);
    expect(await q<{ m: number[] }>('select public.idle_place_marcos($1, 3) as m', [A])).toEqual([{ m: [] }]);
  });
  it('paridade do mult com mapa.ts: Monopólio dobra, Marca forte soma por lugar', async () => {
    await empresa(4);
    for (const l of [3, 4, 7]) await abrir(l);
    await q(`update public.idle_place_state set marcos = '{31,32,41}' where user_id = $1 and lugar in (3, 4)`, [A]);
    const bonus = 0.02 + 0.02 + 0.02 + 0.02 + 0.02 + 0.02; // os dois lugares com {31,32,41}: 6 marcos de 2%
    const mult = async () => (await q<{ m: number }>('select public.idle_place_mult(s) as m from public.idle_state s where user_id = $1', [A]))[0].m;
    await q(`update public.idle_state set strategies = '{0,0,0,0}' where user_id = $1`, [A]);
    expect(await mult()).toBeCloseTo(multMapa(bonus, 3, { marcosMult: 1, porLugar: 0 }));
    await q(`update public.idle_state set strategies = '{0,2,1,0}' where user_id = $1`, [A]);
    expect(await mult()).toBeCloseTo(multMapa(bonus, 3, { marcosMult: 2, porLugar: 0.05 }));
  });
});

const registrar = (u: string, l: number, nome: string, numero: number, quando = 'now()') =>
  q<{ id: number }>(`select public.idle_place_registrar($1, $2, $3, '{1,2}', $4) as id`, [u, l, nome, numero])
    .then(async (r) => { if (quando !== 'now()') await q(`update public.idle_place_prod set criado_em = ${quando} where id = $1`, [r[0].id]); return r[0].id; });
type Lugar = { podio: { user_id: string; nome: string; numero: number }[]; semana: { user_id: string; numero: number }[]; desafio: unknown; dono: unknown; mecanica: unknown; caderninho: unknown[] };
const lugar = (l: number) => t.rpc<Lugar>('idle_lugar', { p_lugar: l });
const C = '00000000-0000-0000-0000-00000000000c';
const D = '00000000-0000-0000-0000-00000000000d';
async function outros() {
  for (const u of [B, C, D]) {
    if (u !== B) await t.member(u);
    await t.as(u); await t.rpc('idle_start'); await t.as(A);
  }
}

describe('produções e pódio', () => {
  it('nome inválido é recusado', async () => {
    await expect(q(`select public.idle_place_nome('   ')`)).rejects.toThrow(/idle_lugar_nome/);
    await expect(q(`select public.idle_place_nome($1)`, ['x'.repeat(31)])).rejects.toThrow(/idle_lugar_nome/);
    expect(await q(`select public.idle_place_nome('  oi ') as v`)).toEqual([{ v: 'oi' }]);
  });
  it('pódio: 3 melhores, uma vez por pessoa, empate fica com quem fez antes', async () => {
    await outros();
    await registrar(A, 3, 'A1', 300, `now() - interval '3 days'`);
    await registrar(A, 3, 'A2', 290);           // a 2ª da A não entra: só a melhor dela
    await registrar(B, 3, 'B1', 250, `now() - interval '2 days'`);
    await registrar(C, 3, 'C1', 250, `now() - interval '1 day'`); // empate com B: B fez antes
    await registrar(D, 3, 'D1', 100);
    const p = (await lugar(3)).podio;
    expect(p.map((x) => x.nome)).toEqual(['A1', 'B1', 'C1']);
  });
  it('entrar no pódio dá "Tá no pódio"', async () => {
    await registrar(A, 3, 'Primeira', 10);
    const ids = (await q<{ id: number }>('select conquista_id as id from public.idle_conquistas where user_id = $1', [A])).map((x) => x.id);
    expect(ids).toContain(86);
  });
  it('placar da semana só conta a semana', async () => {
    await outros();
    await registrar(A, 4, 'velho', 900, `now() - interval '14 days'`);
    await registrar(B, 4, 'novo', 500);
    expect((await lugar(4)).semana.map((x) => x.numero)).toEqual([500]);
  });
});

describe('desafio da semana', () => {
  beforeEach(async () => {
    // só o de teste no lugar 3 (os da camisetaria, da 0067, sairiam no sorteio da semana)
    await q('delete from public.idle_cat_place_desafio where lugar = 3');
    await q(`insert into public.idle_cat_place_desafio (id, lugar, tipo, valor, texto, premio, premio_valor) values
             (9001, 3, 'teste', 5, 'desafio de teste', 'horas', 2)`);
    await empresa(2);
    await abrir(3);
  });
  it('paga uma vez por semana: 2 h de produção', async () => {
    const r = await taxa();
    const v = async () => (await q<{ v: number }>(
      `select (public.idle_place_desafio(s, 3, 'teste', 6)).valuation - s.valuation as v from public.idle_state s where user_id = $1`, [A]))[0].v;
    expect(await v()).toBeCloseTo(2 * 3600 * r, 0);
    expect(await v()).toBe(0);
  });
  it('não paga com valor abaixo nem com outro tipo', async () => {
    const dif = async (tipo: string, valor: number) => (await q<{ v: number }>(
      `select (public.idle_place_desafio(s, 3, $2, $3)).valuation - s.valuation as v from public.idle_state s where user_id = $1`, [A, tipo, valor]))[0].v;
    expect(await dif('teste', 4)).toBe(0);
    expect(await dif('outro', 99)).toBe(0);
  });
  it('legado soma pontos pra gastar sem mexer nos ganhos', async () => {
    await q(`update public.idle_cat_place_desafio set premio = 'legado', premio_valor = 3 where id = 9001`);
    // a função roda uma vez só (no CTE); depois compara com o antes
    const r = await q<{ ganhou: number; gasto: number }>(
      `with x as (select public.idle_place_desafio(s, 3, 'teste', 9) as n, s.prestige_earned as e0, s.prestige_spent as g0
                    from public.idle_state s where user_id = $1)
       select (n).prestige_earned - e0 as ganhou, (n).prestige_spent - g0 as gasto from x`, [A]);
    expect(r[0]).toEqual({ ganhou: 0, gasto: -3 });
  });
  it('legado salvo: prestige_spent fica negativo (pontos do desafio) e os pontos sobem 3', async () => {
    await q(`update public.idle_cat_place_desafio set premio = 'legado', premio_valor = 3 where id = 9001`);
    const e = (await q<{ e: number }>('select prestige_earned as e from public.idle_state where user_id = $1', [A]))[0].e;
    await q(`select public.idle_save(public.idle_place_desafio(s, 3, 'teste', 9)) from public.idle_state s where user_id = $1`, [A]);
    const r = await q<{ gasto: number; pontos: number }>(
      `select s.prestige_spent as gasto, (public.idle_json(s) ->> 'pontos')::double precision as pontos
         from public.idle_state s where user_id = $1`, [A]);
    expect(r[0]).toEqual({ gasto: -3, pontos: e + 3 });
  });
  it('o idle_lugar mostra o desafio e se já foi feito', async () => {
    expect((await lugar(3)).desafio).toMatchObject({ id: 9001, feito: false });
  });
});

describe('semana e presença', () => {
  it('idle_lock marca visto_em', async () => {
    await q(`update public.idle_state set visto_em = null where user_id = $1`, [A]);
    await mapa();
    expect((await q<{ v: string | null }>('select visto_em as v from public.idle_state where user_id = $1', [A]))[0].v).not.toBeNull();
  });
  it('trava feita por outra pessoa ou pelo cron não marca visto_em de quem foi travado', async () => {
    const visto = async () => (await q<{ v: string | null }>('select visto_em as v from public.idle_state where user_id = $1', [A]))[0].v;
    await q(`update public.idle_state set visto_em = null where user_id = $1`, [A]);
    await t.as(null); // cron: auth.uid() nulo
    await q(`select public.idle_fechar_e_ganhar($1, 'mapa_dono')`, [A]);
    await q(`select public.idle_lock_all(array[$1::uuid])`, [A]);
    expect(await visto()).toBeNull();
    await t.as(B); // B travando A (contratar, equipe)
    await q(`select public.idle_lock_all(array[$1::uuid, $2::uuid])`, [A, B]);
    expect(await visto()).toBeNull();
    await t.as(A);
    await mapa();
    expect(await visto()).not.toBeNull();
  });
  it('a foto de segunda guarda o dono de cada lugar uma vez e dá "Dono do pedaço"', async () => {
    await outros();
    await registrar(B, 3, 'da B', 400, `public.games_week_start()::timestamp at time zone 'America/Sao_Paulo' - interval '2 days'`);
    await registrar(A, 3, 'da A', 100, `public.games_week_start()::timestamp at time zone 'America/Sao_Paulo' - interval '2 days'`);
    // semana passada com empresa aberta (a foto da empresa precisa de alguém jogando antes desta semana)
    await q(`update public.idle_state set week_start = public.games_week_start() - 7, started = true where true`);
    await q(`select public.idle_weekly_reset()`);
    await q(`select public.idle_weekly_reset()`);
    const w = await q<{ dono_id: string; lugar: number }>('select dono_id, lugar from public.idle_place_weeks');
    expect(w).toEqual([{ dono_id: B, lugar: 3 }]);
    const ids = (await q<{ id: number }>('select conquista_id as id from public.idle_conquistas where user_id = $1', [B])).map((x) => x.id);
    expect(ids).toContain(85);
    expect((await lugar(3)).dono).toMatchObject({ user_id: B });
  });
  it('sem placa da empresa (ninguém jogava antes desta semana) o dono do pedaço sai do mesmo jeito', async () => {
    await outros();
    await registrar(B, 3, 'da B', 400, `public.games_week_start()::timestamp at time zone 'America/Sao_Paulo' - interval '2 days'`);
    await q(`select public.idle_weekly_reset()`);
    expect(await q('select week_start from public.idle_weeks')).toHaveLength(0);
    expect(await q<{ dono_id: string }>('select dono_id from public.idle_place_weeks')).toEqual([{ dono_id: B }]);
    const ids = (await q<{ id: number }>('select conquista_id as id from public.idle_conquistas where user_id = $1', [B])).map((x) => x.id);
    expect(ids).toContain(85);
  });
  it('idle_lugar de lugar fechado responde sem erro; de lugar que não existe, idle_bad_choice', async () => {
    expect(await lugar(3)).toMatchObject({ aberto: false, mecanica: null });
    await expect(lugar(42)).rejects.toThrow(/idle_bad_choice/);
  });
  it('quem nunca abriu a empresa também vê o lugar (fechado)', async () => {
    await t.as(B);
    expect(await lugar(3)).toMatchObject({ aberto: false, nivel: null });
  });
  it('paridade do sorteio da semana com mapa.ts', async () => {
    const { semanaIdx } = await import('../idle/mapa');
    for (const semana of ['2026-10-12', '2026-10-19', '2027-03-01']) {
      for (const l of [3, 4, 7]) {
        const r = await q<{ i: number }>('select public.idle_place_semana_idx($1, 0, 12, $2::date) as i', [l, semana]);
        expect(r[0].i).toBe(semanaIdx(l, 0, 12, semana));
      }
    }
  });
});

/** [lugar, sal, n, semana, índice]: os mesmos fixos de idle/mapa.test.ts. */
const SEMANA_FIXOS: [number, number, number, string, number][] = [
  [3, 0, 12, '2026-10-12', 3], [4, 0, 12, '2026-10-12', 9], [7, 0, 12, '2026-10-12', 4], [3, 0, 12, '2026-10-19', 10],
  [7, 1, 5, '2027-03-01', 2], [4, 2, 7, '2026-01-05', 4], [3, 0, 1, '2026-11-02', 0], [7, 0, 12, '2025-12-29', 0],
];

describe('sorteio da semana (bits altos)', () => {
  it('o banco dá os valores fixos', async () => {
    for (const [l, sal, n, semana, idx] of SEMANA_FIXOS) {
      const r = await q<{ i: number }>('select public.idle_place_semana_idx($1, $2, $3, $4::date) as i', [l, sal, n, semana]);
      expect(r[0].i).toBe(idx);
    }
  });
  it('52 semanas seguidas com 12 opções: cada lugar passa por todas; o 3 e o 7 não andam juntos', async () => {
    const ano = async (l: number) => (await q<{ i: number }>(
      `select public.idle_place_semana_idx($1, 0, 12, date '2026-01-05' + 7 * k) as i from generate_series(0, 51) k order by k`, [l])).map((r) => r.i);
    for (const l of [3, 4, 7]) expect(new Set(await ano(l)).size).toBe(12);
    const [a3, a7] = [await ano(3), await ano(7)];
    expect(a3.some((x, k) => x !== a7[k])).toBe(true);
  });
});

describe('nome com emoji e separadores do Unicode', () => {
  it('16 emojis passam, 31 não; U+2028, U+2029 e U+0085 não', async () => {
    expect(await q(`select public.idle_place_nome($1) as v`, ['😎'.repeat(16)])).toEqual([{ v: '😎'.repeat(16) }]);
    await expect(q(`select public.idle_place_nome($1)`, ['😎'.repeat(31)])).rejects.toThrow(/idle_lugar_nome/);
    for (const cp of [0x2028, 0x2029, 0x85]) {
      await expect(q(`select public.idle_place_nome($1)`, [`duas${String.fromCodePoint(cp)}linhas`])).rejects.toThrow(/idle_lugar_nome/);
    }
  });
});

describe('a produção na tela conta o Mapa do rolê', () => {
  it('idle_json manda mapa_mult; por unidade × geradores (dica.ts) bate com a taxa do banco e a caixinha mostra a linha', async () => {
    await empresa(4);
    for (const l of [3, 4, 7]) await abrir(l);
    await q(`update public.idle_place_state set marcos = '{31,32,41}' where user_id = $1 and lugar in (3, 4)`, [A]);
    await q(`update public.idle_state set strategies = '{0,2,1,0}' where user_id = $1`, [A]);
    await parar();
    const s = await t.rpc<IdleState>('idle_open');
    const mult = (await q<{ m: number }>('select public.idle_place_mult(s) as m from public.idle_state s where user_id = $1', [A]))[0].m;
    expect(s.mapa_mult).toBeCloseTo(mult, 12);
    expect(s.mapa_abertos).toBe(3);
    expect(mult).toBeGreaterThan(1);
    const soma = porUnidade(s).reduce((a, x, i) => a + x * s.generators[i], 0);
    expect(Math.abs(soma - s.rate) / s.rate).toBeLessThan(1e-9);
    const linhas = dicaProducao(s, Date.parse(s.server_now)).linhas.map((l) => l.texto);
    expect(linhas).toContain(`Mapa do rolê: ×${(Math.round(mult * 100) / 100).toLocaleString('pt-BR')}`);
  });
});

describe('marcos depois de fechar a conta (idle_lugar e idle_mapa)', () => {
  /** A na era 2 com a camisetaria aberta, F$ zerado, fãs no marco e 1 h para fechar com a taxa de antes. */
  async function umaHora() {
    await empresa(2);
    await abrir(3);
    await q(`update public.idle_state set valuation = 0, settled_at = now() - interval '1 hour' where user_id = $1`, [A]);
    await q('update public.idle_place_state set fas = 100000 where user_id = $1 and lugar = 3', [A]);
  }
  const valor = async () => (await q<{ v: number }>('select valuation as v from public.idle_state where user_id = $1', [A]))[0].v;
  it('idle_lugar devolve marcos_novos; a hora que passou rende com a taxa de antes, a de agora sobe 3%', async () => {
    await umaHora();
    const r0 = await taxa();
    const l = await t.rpc<{ marcos_novos: number[] }>('idle_lugar', { p_lugar: 3 });
    expect(l.marcos_novos).toEqual([37]);
    expect((await valor()) / (3600 * r0)).toBeCloseTo(1, 2);
    expect(await taxa()).toBeCloseTo(r0 * 1.03, 6);
    expect((await t.rpc<{ marcos_novos: number[] }>('idle_lugar', { p_lugar: 3 })).marcos_novos).toEqual([]);
  });
  it('idle_lugar de outro lugar também pega o marco de um lugar aberto', async () => {
    await umaHora();
    expect((await t.rpc<{ marcos_novos: number[] }>('idle_lugar', { p_lugar: 4 })).marcos_novos).toEqual([37]);
  });
  it('idle_mapa devolve marcos_novos do mesmo jeito', async () => {
    await umaHora();
    const r0 = await taxa();
    expect((await t.rpc<{ marcos_novos: number[] }>('idle_mapa')).marcos_novos).toEqual([37]);
    expect((await valor()) / (3600 * r0)).toBeCloseTo(1, 2);
    expect((await t.rpc<{ marcos_novos: number[] }>('idle_mapa')).marcos_novos).toEqual([]);
  });
  it('subir de nível com fãs e volume já passados dá os três marcos de uma vez', async () => {
    await empresa(2);
    await abrir(3);
    await q('update public.idle_place_state set nivel = 4, moeda = 1e9, fas = 100000, volume = 50 where user_id = $1 and lugar = 3', [A]);
    const antes = await taxa();
    expect((await nivel(3)).marcos_novos).toEqual([31, 37, 38]);
    expect(await taxa()).toBeCloseTo(antes * (1 + 0.02 + 0.03 + 0.02), 6);
  });
});

describe('o contrato das partes 2 a 4', () => {
  const FUNCOES = [
    'idle_tee_avancar(public.idle_state)', 'idle_cup_avancar(public.idle_state)', 'idle_din_avancar(public.idle_state)',
    'idle_tee_json(public.idle_state)', 'idle_cup_json(public.idle_state)', 'idle_din_json(public.idle_state)',
    'idle_place_avancar(public.idle_state)', 'idle_place_mecanica_json(public.idle_state, integer)', 'idle_place_marcos_todos(uuid)',
    'idle_place_registrar(uuid, integer, text, integer[], double precision, timestamptz, double precision)',
  ];
  it('os stubs de cada lugar existem e ninguém de fora chama', async () => {
    for (const f of FUNCOES) {
      for (const papel of ['anon', 'authenticated', 'public']) {
        const r = await q<{ pode: boolean }>(`select has_function_privilege($1, $2, 'execute') as pode`, [papel, `public.${f}`]);
        expect(r[0].pode, `${papel} ${f}`).toBe(false);
      }
    }
  });
  it('o lugar só anda (o stub dele) se está aberto', async () => {
    await q(`create or replace function public.idle_tee_avancar(s public.idle_state) returns void language plpgsql as $f$
             begin raise exception 'tee_andou'; end $f$`);
    await empresa(2);
    await mapa(); // fechado: não chama
    await abrir(3);
    await expect(mapa()).rejects.toThrow(/tee_andou/);
  });
  it('a mecânica de cada lugar vem do *_json dele', async () => {
    await q(`create or replace function public.idle_cup_json(s public.idle_state) returns jsonb language sql stable as $f$ select '{"copo": 1}'::jsonb $f$`);
    expect((await lugar(4)).mecanica).toEqual({ copo: 1 });
    expect((await lugar(3)).mecanica).toBeNull();
  });
  it('resultado registrado com p_quando na semana passada conta lá, não nesta', async () => {
    await outros();
    await q(`select public.idle_place_registrar(p_user => $1, p_lugar => 3, p_nome => 'velho', p_partes => '{1}', p_numero => 100,
               p_quando => public.games_week_start()::timestamp at time zone 'America/Sao_Paulo' - interval '1 day')`, [B]);
    expect((await lugar(3)).semana).toEqual([]);
    const passada = await q<{ x: { user_id: string }[] }>(`select public.idle_place_semana(3, public.games_week_start() - 7) as x`);
    expect(passada[0].x.map((p) => p.user_id)).toEqual([B]);
  });
  it('mesmo número: o desempate maior ganha no pódio e na semana', async () => {
    await outros();
    const reg = (u: string, nome: string, d: number) => q(`select public.idle_place_registrar(p_user => $1, p_lugar => 3, p_nome => $2,
      p_partes => '{1}', p_numero => 100, p_desempate => $3)`, [u, nome, d]);
    await reg(B, 'antes', 1);
    await reg(C, 'depois', 5);
    await reg(B, 'antes2', 2); // a melhor de B passa a ser esta (mesmo número, desempate maior)
    const l = await lugar(3);
    expect(l.podio.map((p) => p.nome)).toEqual(['depois', 'antes2']);
    expect(l.semana.map((p) => p.user_id)).toEqual([C, B]);
  });
});

describe('gancho depois (idle_place_depois)', () => {
  const stub = (fn: string) => q(`create or replace function public.${fn}(s public.idle_state)
    returns public.idle_state language plpgsql volatile set search_path = public as $$ begin s.valuation := s.valuation + 5; return s; end; $$`);
  const val = async () => (await q<{ v: number }>('select valuation as v from public.idle_state where user_id = $1', [A]))[0].v;
  it('chama o depois só dos lugares abertos', async () => {
    await empresa(4, 1000);
    await stub('idle_tee_depois');
    await stub('idle_cup_depois');
    await mapa();
    expect(await val()).toBe(1000); // nenhum aberto
    await q(`insert into public.idle_place_state (user_id, lugar) values ($1, 3)`, [A]);
    await mapa();
    expect(await val()).toBe(1005); // só o 3
  });
  it('idle_lugar roda o depois e salva o s que ele devolve', async () => {
    await empresa(4, 1000);
    await q(`insert into public.idle_place_state (user_id, lugar) values ($1, 3)`, [A]);
    await stub('idle_tee_depois');
    await t.rpc('idle_lugar', { p_lugar: 3 });
    expect(await val()).toBe(1005);
  });
  it('idle_place_responder roda o depois, salva e devolve lugar e marcos_novos', async () => {
    await empresa(4, 1000);
    await q(`insert into public.idle_place_state (user_id, lugar) values ($1, 3)`, [A]);
    await stub('idle_tee_depois');
    const r = (await q<{ r: { valuation: number; lugar: { id: number }; marcos_novos: number[] } }>(
      `select public.idle_place_responder(s, 3) as r from public.idle_state s where user_id = $1`, [A]))[0].r;
    expect(r.valuation).toBe(1005);
    expect(r.lugar.id).toBe(3);
    expect(r.marcos_novos).toEqual([]);
    expect(await val()).toBe(1005);
  });
  it('ajudantes revogados de authenticated', async () => {
    await expect(t.asRole('authenticated', `select public.idle_place_depois(s) from public.idle_state s`)).rejects.toThrow();
    for (const f of [
      'idle_place_depois(public.idle_state)', 'idle_place_responder(public.idle_state, integer)', 'idle_tee_depois(public.idle_state)',
      'idle_cup_depois(public.idle_state)', 'idle_din_depois(public.idle_state)', 'idle_tee_avancar(public.idle_state)',
      'idle_tee_json(public.idle_state)',
    ]) {
      const r = await q<{ pode: boolean }>(`select has_function_privilege('authenticated', $1, 'execute') as pode`, [`public.${f}`]);
      expect(r[0].pode, f).toBe(false);
    }
  });
  it('idle_lugar e idle_mapa salvam de novo só se o depois mexeu no s; estado_mudou diz se a tela busca a empresa', async () => {
    await empresa(4, 1000);
    await q(`insert into public.idle_place_state (user_id, lugar) values ($1, 3)`, [A]);
    // conta os idle_save: a de verdade vira idle_save_real e a nova anota antes de chamar
    await q('create table public.saves_teste (n int)');
    await q('alter function public.idle_save(public.idle_state) rename to idle_save_real');
    await q(`create function public.idle_save(s public.idle_state) returns void language plpgsql set search_path = public as $$
             begin insert into public.saves_teste values (1); perform public.idle_save_real(s); end; $$`);
    const saves = async () => (await q<{ n: number }>('select count(*)::int as n from public.saves_teste'))[0].n;
    type R = { estado_mudou: boolean };
    // nada pra revelar: o depois não mexe no s, um save só (o de fechar a conta)
    expect((await t.rpc<R>('idle_lugar', { p_lugar: 3 })).estado_mudou).toBe(false);
    expect(await saves()).toBe(1);
    expect((await t.rpc<R>('idle_mapa')).estado_mudou).toBe(false);
    expect(await saves()).toBe(2);
    // o depois mexe no s: salva de novo e avisa
    await stub('idle_tee_depois');
    expect((await t.rpc<R>('idle_lugar', { p_lugar: 3 })).estado_mudou).toBe(true);
    expect(await saves()).toBe(4);
    expect(await val()).toBe(1005);
    expect((await t.rpc<R>('idle_mapa')).estado_mudou).toBe(true);
    expect(await saves()).toBe(6);
    expect(await val()).toBe(1010);
    // o depois só dá conquista (o s igual): não salva de novo, mas avisa (a conquista mexe na taxa)
    await q(`create or replace function public.idle_tee_depois(s public.idle_state)
      returns public.idle_state language plpgsql volatile set search_path = public as $$
      begin perform public.idle_ganhar(s.user_id, 'mapa_podio'); return s; end; $$`);
    expect((await t.rpc<R>('idle_lugar', { p_lugar: 3 })).estado_mudou).toBe(true);
    expect(await saves()).toBe(7);
    expect((await t.rpc<R>('idle_lugar', { p_lugar: 3 })).estado_mudou).toBe(false); // já tinha a conquista
    expect(await saves()).toBe(8);
  });
});
