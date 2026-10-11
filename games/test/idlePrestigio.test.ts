// Banco da entrega 3 da Fellas Inc.: vender a startup (prestígio), com as migrações reais no PGlite.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { catalogo } from '../idle/catalogo';
import { abertura, efeitosArvore, pontosTotais } from '../idle/economia';
import { pendentes } from '../idle/oportunidades';
import { freshDb, type TestDb } from './db';

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const C = '00000000-0000-0000-0000-00000000000c';
const OUT = '00000000-0000-0000-0000-0000000000ff';

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;

type Estado = {
  user_id: string; started: boolean; valuation: number; rate: number; era: number; generators: number[]; upgrades: number[];
  strategies: number[]; boost_until: string | null; half_price: boolean; opp_left: number; server_now: string; week_start: string;
  avatar: Record<string, number> | null; equipe: { user_id: string }[]; chefes: { user_id: string; ate: string }[];
  bonus: { arvore: number[]; conquistas: number }; pontos: number; pontos_vida: number; vendas: number; recorde: number;
  pontos_venda: number;
  conquistas: { id: number; em: string }[]; novas: number[]; descobertas: number[];
};

beforeEach(async () => {
  t = await freshDb();
  for (const u of [A, B, C]) await t.member(u);
  await t.member(OUT, { isMember: false });
  await t.as(A);
});

/** Abre a empresa de cada um (como ele) e volta a ser A. */
const abrir = async (...us: string[]) => {
  for (const u of us) {
    await t.as(u);
    await t.rpc('idle_start');
  }
  await t.as(A);
};
const vender = () => t.rpc<Estado>('idle_prestige');
/** 150 foguetes e as estratégias escolhidas: a venda vale uns 7 pontos. */
const enriquecer = (u: string) =>
  q(`update public.idle_state set generators[30] = 150, strategies = '{0,0,0,0}' where user_id = $1`, [u]);
const V = { pele: 1, cabelo: 2, cor_cabelo: 3, roupa: 1, cor_roupa: 4, acessorio: 3, cor_acessorio: 5 };

describe('pontos de prestígio', () => {
  it('pontos totais = floor(cbrt(F$/s ÷ 1 milhão)), exatos nos cubos', async () => {
    const casos: [number, number][] = [
      [0, 0], [-5, 0], [999_999, 0], [1e6, 1], [7_999_999, 1], [8e6, 2], [124_999_999, 4], [125e6, 5], [1e9, 10], [1e12, 100],
      [Infinity, 0], [-Infinity, 0], [NaN, 0], [1e33, 1e9], [1e40, 1e9],
    ];
    for (const [r, n] of casos) {
      expect((await q<{ n: number }>('select public.idle_prestige_total($1) as n', [r]))[0].n, String(r)).toBe(n);
    }
    expect((await q<{ n: number }>('select public.idle_prestige_total(null) as n'))[0].n).toBe(0);
  });
  it('não compensa: menos de 1 ponto é idle_prestige_low e nada muda', async () => {
    await abrir(A);
    expect((await t.rpc<Estado>('idle_open')).pontos_venda).toBe(0);
    await expect(vender()).rejects.toThrow(/idle_prestige_low/);
    expect(await q('select started, generators[1] as g, prestige_count from public.idle_state where user_id = $1', [A]))
      .toEqual([{ started: true, g: 1, prestige_count: 0 }]);
  });
  it('conta os ganhos na vida (gastos ou não): no mesmo ritmo não rende; com menos, ganha só a diferença', async () => {
    await abrir(A);
    await enriquecer(A);
    const total = pontosTotais((await t.rpc<Estado>('idle_open')).rate);
    // já ganhou tudo isso na vida e gastou tudo: vender no mesmo ritmo não rende nada
    await q('update public.idle_state set prestige_earned = $2, prestige_spent = $2 where user_id = $1', [A, total]);
    expect((await t.rpc<Estado>('idle_open')).pontos_venda).toBe(0);
    await expect(vender()).rejects.toThrow(/idle_prestige_low/);
    // ganhou 2 na vida e gastou 1: ganha o resto e os livres somam
    await q('update public.idle_state set prestige_earned = 2, prestige_spent = 1 where user_id = $1', [A]);
    const antes = await t.rpc<Estado>('idle_open');
    expect(antes).toMatchObject({ pontos: 1, pontos_vida: 2, pontos_venda: total - 2 });
    expect(await vender()).toMatchObject({ pontos: total - 1, pontos_vida: total });
  });
  it('pontos não mexem na produção: só os nós comprados', async () => {
    await abrir(A);
    const antes = await t.rpc<Estado>('idle_open');
    await q('update public.idle_state set prestige_earned = 50 where user_id = $1', [A]);
    expect((await t.rpc<Estado>('idle_open')).rate).toBeCloseTo(antes.rate, 12);
  });
  it('toque duplo em Vender: a segunda recebe idle_not_started e os pontos entram uma vez só', async () => {
    // em produção a segunda chamada espera a trava da linha (idle_lock_all) e já encontra a empresa vendida
    await abrir(A);
    await enriquecer(A);
    const s = await vender();
    await expect(vender()).rejects.toThrow(/idle_not_started/);
    expect(await q('select prestige_earned, prestige_count from public.idle_state where user_id = $1', [A]))
      .toEqual([{ prestige_earned: s.pontos_vida, prestige_count: 1 }]);
  });
  it('sem empresa aberta: idle_not_started; não membro é barrado', async () => {
    await expect(vender()).rejects.toThrow(/idle_not_started/);
    await t.as(OUT);
    await expect(vender()).rejects.toThrow(/not_member/);
  });
});

describe('vender a startup', () => {
  it('zera a empresa e volta pro Abrir CNPJ; ficam pontos, nós, vendas, conquistas, personagem e o recorde; a cota do dia recomeça', async () => {
    await abrir(A);
    await t.rpc('idle_set_avatar', {
      p_pele: V.pele, p_cabelo: V.cabelo, p_cor_cabelo: V.cor_cabelo, p_roupa: V.roupa, p_cor_roupa: V.cor_roupa,
      p_acessorio: V.acessorio, p_cor_acessorio: V.cor_acessorio,
    });
    await enriquecer(A);
    await q('insert into public.idle_arvore (user_id, no_id) values ($1, 1), ($1, 11)', [A]); // Virou MEI e Cafezinho de garrafa térmica
    await q(
      `update public.idle_state
          set valuation = 5e9, upgrades = '{11,1001}', boost_until = now() + interval '1 hour', half_price = true,
              opp_day = public.games_today(), opp_count = 4
        where user_id = $1`,
      [A],
    );
    const antes = await t.rpc<Estado>('idle_open');
    const P = pontosTotais(antes.rate);
    expect(P).toBeGreaterThanOrEqual(5);
    expect(antes.pontos_venda).toBe(P);
    expect(antes.opp_left).toBe(9); // Viralizar: 13 por dia
    const s = await vender();
    expect(s).toMatchObject({
      started: false, valuation: 0, upgrades: [], strategies: [-1, -1, -1, -1], boost_until: null, half_price: false,
      era: 1, vendas: 1, pontos_venda: 0, avatar: V,
    });
    expect(s.generators).toEqual(Array(30).fill(0));
    expect(s).toMatchObject({ pontos: P, pontos_vida: P, bonus: { arvore: [1, 11] } });
    expect(s.recorde).toBeCloseTo(antes.rate, 6);
    expect(s.opp_left).toBe(10); // a cota do dia recomeça com a empresa nova (10 sem estratégia)
    expect(s.conquistas.map((c) => c.id)).toEqual(expect.arrayContaining(antes.conquistas.map((c) => c.id)));
    expect(s.novas).toEqual(expect.arrayContaining([51, 109])); // Exit; Modo sigma (nunca contratou)
    // Abrir CNPJ de novo: F$ 10, 1 notebook e o bônus valendo
    const r = await t.rpc<Estado>('idle_start');
    expect(r).toMatchObject({ started: true, valuation: 10, vendas: 1 });
    expect(r.generators[0]).toBe(1);
    expect(r.rate).toBeCloseTo(0.5 * 1.02 * 1.05 * 1.1 * (1 + 0.01 * r.bonus.conquistas), 10); // os nós continuam valendo
  });
  it('a cota do dia recomeça, mas a oportunidade já pega não paga de novo', async () => {
    await abrir(A);
    await enriquecer(A);
    const s0 = await t.rpc<Estado>('idle_open');
    const [w, outra] = pendentes(A, Date.parse(s0.server_now), [], Date.parse(s0.week_start + 'T00:00:00-03:00'));
    await t.rpc('idle_claim_opportunity', { p_window: w });
    // gastou a cota inteira do dia (13 com Viralizar)
    await q(`update public.idle_state set opp_day = public.games_today(), opp_count = 13 where user_id = $1`, [A]);
    expect((await t.rpc<Estado>('idle_open')).opp_left).toBe(0);
    await vender();
    const s = await t.rpc<Estado>('idle_start');
    expect(s.opp_left).toBe(10);
    await expect(t.rpc('idle_claim_opportunity', { p_window: w })).rejects.toThrow(/idle_opp_gone/);
    expect((await t.rpc<Estado>('idle_claim_opportunity', { p_window: outra })).opp_left).toBe(9);
  });
  it('os contratos que você fez vencem na hora, com a conta dos contratados fechada antes; quem te contratou continua', async () => {
    await abrir(A, B, C);
    // A com Cultura de startup (era 4, opção 2): quem A contrata ganha o triplo
    await q(`update public.idle_state set generators[30] = 150, strategies = '{0,0,2,0}', valuation = 1e15 where user_id = $1`, [A]);
    await t.rpc('idle_hire', { p_user: B });
    await t.as(C);
    await q('update public.idle_state set valuation = 1e15 where user_id = $1', [C]);
    await t.rpc('idle_hire', { p_user: A });
    await t.as(A);
    // contratos de ontem; B não abre o jogo há 1000 s
    await q(`update public.idle_contracts set created_at = created_at - interval '1 day', ends_at = ends_at - interval '1 day' where true`);
    await q(`update public.idle_state set valuation = 0, settled_at = now() - interval '1000 seconds' where user_id = $1`, [B]);
    const [{ r: rB }] = await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [B]);
    const s = await vender();
    expect(s.equipe).toEqual([]);
    expect(s.chefes.map((c) => c.user_id)).toEqual([C]);
    // B rendeu as 1000 s com o triplo de Cultura de startup (a regra de antes da venda)
    const [{ valuation }] = await q<{ valuation: number }>('select valuation from public.idle_state where user_id = $1', [B]);
    expect(valuation / (rB * 1000)).toBeCloseTo(1, 3);
    expect(await q('select employer_id, ends_at <= now() as vencido from public.idle_contracts order by employer_id'))
      .toEqual([{ employer_id: A, vencido: true }, { employer_id: C, vencido: false }]);
    await t.as(B);
    const b = await t.rpc<Estado>('idle_open');
    expect(b.chefes).toEqual([]);
    expect(b.rate).toBeLessThan(rB); // voltou pro piso de freela
  });
  it('contrato que já venceu, com o contratado sem fechar a conta desde antes: fecha antes também (o triplo não some pra trás)', async () => {
    await abrir(A, B);
    await q(`update public.idle_state set generators[30] = 150, strategies = '{0,0,2,0}', valuation = 1e15 where user_id = $1`, [A]);
    await t.rpc('idle_hire', { p_user: B });
    // venceu há 1 hora; B não fecha a conta desde 3 horas atrás
    await q(`update public.idle_contracts set created_at = created_at - interval '7 days 1 hour', ends_at = ends_at - interval '7 days 1 hour' where true`);
    await q(`update public.idle_state set valuation = 0, settled_at = now() - interval '3 hours' where user_id = $1`, [B]);
    const [{ v: esperado }] = await q<{ v: number }>('select (public.idle_settle(s)).valuation as v from public.idle_state s where user_id = $1', [B]);
    await vender();
    const [{ valuation }] = await q<{ valuation: number }>('select valuation from public.idle_state where user_id = $1', [B]);
    expect(valuation / esperado).toBeCloseTo(1, 4);
  });
  it('Recomeço: com Leva o crachá a venda mantém as melhorias gerais (e só elas)', async () => {
    await abrir(A);
    await q('insert into public.idle_arvore (user_id, no_id) values ($1, 1), ($1, 21), ($1, 22), ($1, 23)', [A]);
    await q(`update public.idle_state set generators[30] = 150, strategies = '{0,0,0,0}', upgrades = '{11,1001,1002,2001}' where user_id = $1`, [A]);
    const s = await vender();
    expect(s.upgrades.map(Number).sort()).toEqual([1001, 1002]);
  });
  it.each([
    ['sem Leva o crachá', [1, 21, 22]],
    ['com Leva o crachá', [1, 21, 22, 23]],
    ['com tudo do Recomeço', [1, 21, 22, 23, 24, 25]],
  ])('venda seguida de Abrir CNPJ, a partir de uma empresa suja, bate com abertura() do TS: %s', async (_nome, nos) => {
    await abrir(A);
    await q('insert into public.idle_arvore (user_id, no_id) select $1, unnest($2::int[])', [A, nos]);
    // empresa suja: geradores espalhados, melhorias de gerador, gerais e sinergia, boost, meia-preço e estratégias
    await q(
      `update public.idle_state
          set generators = array[40,12,9,5,3,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,150],
              upgrades = '{11,21,1001,1002,2001}', strategies = '{0,0,0,0}', valuation = 7e8,
              boost_until = now() + interval '1 hour', half_price = true
        where user_id = $1`,
      [A],
    );
    const vendida = await vender();
    expect(vendida).toMatchObject({ started: false, valuation: 0, boost_until: null, half_price: false, strategies: [-1, -1, -1, -1] });
    expect(vendida.generators).toEqual(Array(30).fill(0));
    const gerais = catalogo.melhorias.filter((m) => m.tipo === 'geral').map((m) => m.id);
    const mantidas = nos.includes(23) ? [1001, 1002] : [];
    expect(vendida.upgrades.map(Number).sort()).toEqual(mantidas);
    const esperado = abertura(catalogo, efeitosArvore(catalogo, nos), vendida.upgrades.map(Number).filter((u) => gerais.includes(u)));
    const s = await t.rpc<Estado>('idle_start');
    expect(s.valuation).toBe(esperado.valuation);
    expect(s.generators).toEqual(esperado.generators);
    expect(s.upgrades.map(Number).sort()).toEqual([...esperado.upgrades].sort());
    expect(s).toMatchObject({ boost_until: null, half_price: false, strategies: [-1, -1, -1, -1], era: 1 });
  });
  it('ninguém escreve nos pontos nem nas conquistas (nem nos próprios); as funções internas estão fechadas', async () => {
    await abrir(A);
    await expect(t.asRole('authenticated', `update public.idle_state set prestige_earned = 99 where user_id = '${A}'`)).rejects.toThrow();
    await expect(t.asRole('authenticated', `insert into public.idle_arvore (user_id, no_id) values ('${A}', 1)`)).rejects.toThrow();
    await expect(t.asRole('authenticated', `insert into public.idle_conquistas (user_id, conquista_id) values ('${A}', 1)`)).rejects.toThrow();
    await expect(t.asRole('authenticated', `delete from public.idle_conquistas where user_id = '${A}'`)).rejects.toThrow();
    await expect(t.rpc('idle_ganhar', { p_user: B, p_tipo: 'unicornio' })).rejects.toThrow();
    await expect(t.rpc('idle_check_conquistas', { p_user: B })).rejects.toThrow();
    await expect(t.rpc('idle_fechar_equipe', { p_user: B })).rejects.toThrow();
    await expect(t.rpc('idle_fechar_e_ganhar', { p_user: B, p_tipo: 'unicornio' })).rejects.toThrow();
    await expect(t.asRole('anon', 'select public.idle_prestige()')).rejects.toThrow();
  });
  it('placar: pontos ganhos na vida (gastos ou não) e quantas conquistas cada um tem', async () => {
    await abrir(A, B);
    await q('update public.idle_state set prestige_earned = 12, prestige_spent = 9 where user_id = $1', [B]);
    await q('insert into public.idle_conquistas (user_id, conquista_id) values ($1, 1), ($1, 2)', [B]);
    const rows = await t.rpc<{ user_id: string; pontos: number; conquistas: number }[]>('idle_board');
    expect(rows.find((r) => r.user_id === B)).toMatchObject({ pontos: 12, conquistas: 2 });
    expect(rows.find((r) => r.user_id === A)).toMatchObject({ pontos: 0, conquistas: 0 });
  });
});

describe('a migração 0041 conta o que já aconteceu', () => {
  it('melhorias, contratos, estratégias e unicórnio de antes; rodar de novo não muda nada', async () => {
    await abrir(A, B);
    await q('update public.idle_state set valuation = 1e9 where true');
    await t.rpc('idle_hire', { p_user: B });
    // como se a 0041 ainda não tivesse rodado
    await q(`update public.idle_state set upg_total = 0, hire_total = 0, hired_total = 0, est_usadas = '{}', upgrades = '{11,12}', strategies = '{1,-1,-1,-1}' where true`);
    await q('delete from public.idle_conquistas where true');
    await q('insert into public.idle_weeks (week_start, unicorn_id) values (public.games_week_start() - 7, $1)', [A]);
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/0041_fellas_inc_prestigio.sql'), 'utf8');
    const contar = () => q('select user_id, upg_total, hire_total, hired_total, est_usadas from public.idle_state order by user_id');
    await t.db.exec(sql);
    const depois = await contar();
    expect(depois).toEqual([
      { user_id: A, upg_total: 2, hire_total: 1, hired_total: 0, est_usadas: [21] },
      { user_id: B, upg_total: 2, hire_total: 0, hired_total: 1, est_usadas: [21] },
    ]);
    expect(await q('select user_id from public.idle_conquistas where conquista_id = 110')).toEqual([{ user_id: A }]);
    const conquistas = await q('select user_id, conquista_id from public.idle_conquistas order by 1, 2');
    await t.db.exec(sql);
    expect(await contar()).toEqual(depois);
    expect(await q('select user_id, conquista_id from public.idle_conquistas order by 1, 2')).toEqual(conquistas);
  });
});
