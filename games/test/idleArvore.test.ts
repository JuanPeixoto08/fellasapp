// Banco da entrega 3 da Fellas Inc.: a árvore de habilidades (comprar nós e o que cada ramo faz), com as migrações
// reais no PGlite. A conta da produção, do teto, da caixinha e do preço do contrato com a árvore está na paridade.
import { beforeEach, describe, expect, it } from 'vitest';

import { catalogo } from '../idle/catalogo';
import { abertura, efeitosArvore } from '../idle/economia';
import { CAIXA_PADRAO, pendentes, tipo } from '../idle/oportunidades';
import { freshDb, type TestDb } from './db';

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const OUT = '00000000-0000-0000-0000-0000000000ff';

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;

type Estado = {
  user_id: string; week_start: string; started: boolean; valuation: number; rate: number; generators: number[];
  upgrades: number[]; server_now: string; opp_left: number; boost_until: string | null;
  bonus: { arvore: number[]; conquistas: number }; pontos: number; pontos_vida: number;
  equipe: { user_id: string; ate: string }[];
};

// sem o catálogo das conquistas: a conta exata não muda com o +1% de cada uma
beforeEach(async () => {
  t = await freshDb({ conquistas: false });
  for (const u of [A, B]) await t.member(u);
  await t.member(OUT, { isMember: false });
  await t.as(A);
});

const abrir = async (...us: string[]) => {
  for (const u of us) {
    await t.as(u);
    await t.rpc('idle_start');
  }
  await t.as(A);
};
const comprar = (no: number) => t.rpc<Estado>('idle_buy_node', { p_no: no });
const pontos = (u: string, ganhos: number, gastos = 0) =>
  q('update public.idle_state set prestige_earned = $2, prestige_spent = $3 where user_id = $1', [u, ganhos, gastos]);
/** Põe os nós direto (sem pagar), para testar o efeito. */
const ter = (u: string, nos: number[]) =>
  q('insert into public.idle_arvore (user_id, no_id) select $1, unnest($2::int[])', [u, nos]);

describe('comprar nós', () => {
  it('a raiz primeiro; cada nó exige o anterior do ramo; paga com os pontos livres e fica com o nó', async () => {
    await abrir(A);
    await pontos(A, 10);
    await expect(comprar(11)).rejects.toThrow(/idle_locked/);
    expect(await comprar(1)).toMatchObject({ pontos: 9, pontos_vida: 10, bonus: { arvore: [1] } });
    await expect(comprar(12)).rejects.toThrow(/idle_locked/);
    const s = await comprar(11);
    expect(s).toMatchObject({ pontos: 7, bonus: { arvore: [1, 11] } });
    expect(await q('select prestige_earned, prestige_spent from public.idle_state where user_id = $1', [A]))
      .toEqual([{ prestige_earned: 10, prestige_spent: 3 }]);
  });
  it('recusa não gasta nem grava nada: idle_points_low, idle_locked, idle_node_owned e idle_bad_choice', async () => {
    await abrir(A);
    await pontos(A, 2);
    const estado = async () => ({
      gasto: await q('select prestige_spent from public.idle_state where user_id = $1', [A]),
      nos: await q('select no_id from public.idle_arvore where user_id = $1 order by no_id', [A]),
    });
    await comprar(1);
    const base = await estado();
    expect(base).toEqual({ gasto: [{ prestige_spent: 1 }], nos: [{ no_id: 1 }] });
    await expect(comprar(11)).rejects.toThrow(/idle_points_low/); // custa 2, sobrou 1
    expect(await estado()).toEqual(base);
    await pontos(A, 10, 1);
    const base2 = await estado();
    await expect(comprar(12)).rejects.toThrow(/idle_locked/);
    await expect(comprar(1)).rejects.toThrow(/idle_node_owned/);
    await expect(comprar(99)).rejects.toThrow(/idle_bad_choice/);
    await expect(comprar(null as unknown as number)).rejects.toThrow(/idle_bad_choice/);
    expect(await estado()).toEqual(base2);
  });
  it('toque duplo: comprar o nó 1 duas vezes dá idle_node_owned na 2ª e gasta só 1', async () => {
    await abrir(A);
    await pontos(A, 5);
    await comprar(1);
    await expect(comprar(1)).rejects.toThrow(/idle_node_owned/);
    expect(await q('select prestige_spent from public.idle_state where user_id = $1', [A])).toEqual([{ prestige_spent: 1 }]);
    expect(await q('select no_id from public.idle_arvore where user_id = $1', [A])).toEqual([{ no_id: 1 }]);
  });
  it('Abrir CNPJ duas vezes sem fechar: idle_started, e a empresa fica como estava', async () => {
    const s = await t.rpc<Estado>('idle_start');
    await expect(t.rpc('idle_start')).rejects.toThrow(/idle_started/);
    expect((await t.rpc<Estado>('idle_open')).generators).toEqual(s.generators);
  });
  it('fecha a conta antes: o tempo parado rende sem o nó novo, e dali pra frente com ele', async () => {
    await abrir(A);
    await pontos(A, 1);
    await q(`update public.idle_state set settled_at = settled_at - interval '20000 seconds' where user_id = $1`, [A]);
    const s = await comprar(1);
    expect((s.valuation - 10) / (0.5 * 1.02 * 20000)).toBeCloseTo(1, 2);
    expect(s.rate).toBeCloseTo(0.5 * 1.02 * 1.05, 12);
  });
  it('dá pra comprar com a empresa fechada (entre a venda e o Abrir CNPJ)', async () => {
    await t.rpc('idle_open');
    await pontos(A, 1);
    expect(await comprar(1)).toMatchObject({ started: false, bonus: { arvore: [1] } });
  });
  it('não membro é barrado; ninguém escreve direto na árvore; membro lê a dos outros', async () => {
    await abrir(A);
    await pontos(A, 1);
    await comprar(1);
    await expect(t.asRole('authenticated', `insert into public.idle_arvore (user_id, no_id) values ('${B}', 1)`)).rejects.toThrow();
    await expect(t.asRole('authenticated', `delete from public.idle_arvore where user_id = '${A}'`)).rejects.toThrow();
    await t.as(B);
    expect(await t.asRole('authenticated', 'select no_id from public.idle_arvore')).toEqual([{ no_id: 1 }]);
    await expect(t.asRole('anon', 'select * from public.idle_arvore')).rejects.toThrow();
    await t.as(OUT);
    await expect(comprar(1)).rejects.toThrow(/not_member/);
  });
});

describe('o que cada ramo faz', () => {
  it('Produção: os nós multiplicam entre si (raiz ×1,05, depois ×1,1 ×1,25 ×1,5 ×2 ×2)', async () => {
    await abrir(A);
    await ter(A, [1, 11, 12, 13, 14, 15]);
    expect((await t.rpc<Estado>('idle_open')).rate).toBeCloseTo(0.5 * 1.02 * 1.05 * 1.1 * 1.25 * 1.5 * 2 * 2, 10);
  });
  it('Recomeço: o Abrir CNPJ começa com F$ 1 mil, 10 notebooks, 1 de cada gerador da era 1 e depois F$ 1 mi', async () => {
    await ter(A, [1, 21, 22]);
    let s = await t.rpc<Estado>('idle_start');
    expect(s.valuation).toBe(1000);
    expect(s.generators.slice(0, 7)).toEqual([10, 0, 0, 0, 0, 0, 0]);
    await q('update public.idle_state set started = false where user_id = $1', [A]);
    await ter(A, [23, 24, 25]);
    s = await t.rpc<Estado>('idle_start');
    expect(s.valuation).toBe(1e6);
    expect(s.generators.slice(0, 7)).toEqual([10, 1, 1, 1, 1, 1, 0]);
  });
  it('Oportunidades: caixinha de 4 (e 5), +3 por dia e bônus em dobro', async () => {
    await abrir(A);
    await q('update public.idle_state set week_start = public.games_week_start() - 7 where user_id = $1', [A]);
    const sem = await t.rpc<Estado>('idle_open');
    const agora = Date.parse(sem.server_now);
    const semana = Date.parse(sem.week_start + 'T00:00:00-03:00');
    await ter(A, [1, 31, 32, 33, 34]);
    const com = await t.rpc<Estado>('idle_open');
    expect(com.opp_left).toBe(sem.opp_left + 3);
    const lista = pendentes(A, agora, [], semana, { tamanho: 4, validadeS: CAIXA_PADRAO.validadeS });
    expect(lista).toHaveLength(4);
    const [{ l }] = await q<{ l: string[] }>('select public.idle_opp_list(s, $2::timestamptz) as l from public.idle_state s where user_id = $1', [A, sem.server_now]);
    expect(l.map(Number)).toEqual(lista);
    // bônus em dobro: a de 15 minutos de produção rende 30
    await q(`update public.idle_state set settled_at = now() + interval '1 hour' where user_id = $1`, [A]);
    const w = lista.find((x) => tipo(A, x) === 0)!;
    const depois = await t.rpc<Estado>('idle_claim_opportunity', { p_window: w });
    expect((depois.valuation - com.valuation) / (com.rate * 1800)).toBeCloseTo(1, 6);
  });
  it('Tempo: com o jogo fechado a empresa rende até 12h (e não 8h)', async () => {
    await abrir(A);
    await ter(A, [1, 41]);
    await q(`update public.idle_state set valuation = 0, settled_at = now() - interval '20 hours' where user_id = $1`, [A]);
    const s = await t.rpc<Estado>('idle_open');
    expect(s.valuation).toBeCloseTo(0.5 * 1.02 * 1.05 * 12 * 3600, 3);
  });
  it('Gente: contratar 25% (e 50%) mais barato, contrato de 10 dias pra quem contrata', async () => {
    await abrir(A, B);
    await q('update public.idle_state set valuation = 1e6 where user_id = $1', [A]);
    const sem = await t.rpc<Estado & { hire_price: number }>('idle_open');
    await ter(A, [1, 51, 52, 53]);
    const com = await t.rpc<Estado & { hire_price: number }>('idle_open');
    expect(com.hire_price / (com.rate * 1800)).toBeCloseTo(0.75, 12);
    expect(com.hire_price).toBeLessThan(sem.hire_price);
    const s = await t.rpc<Estado>('idle_hire', { p_user: B });
    expect(Date.parse(s.equipe[0].ate) - Date.parse(s.server_now)).toBeCloseTo(10 * 86400_000, -4);
    await ter(A, [54, 55]);
    const mais = await t.rpc<Estado & { hire_price: number }>('idle_open');
    expect(mais.hire_price / (mais.rate * 1800 * 1.5)).toBeCloseTo(0.5, 12);
  });
  it('Gente: Aniversariante do mês paga 15% por contratado; Passe de craque dobra o que quem te contratou rende pra você', async () => {
    await abrir(A, B);
    await q('update public.idle_state set valuation = 1e6 where user_id = $1', [A]);
    await ter(A, [1, 51, 52]);
    expect((await t.rpc<Estado>('idle_hire', { p_user: B })).rate).toBeCloseTo(0.5 * 1.05 * (1 + 0.15 + 0.02), 10);
    await t.as(B);
    expect((await t.rpc<Estado>('idle_open')).rate).toBeCloseTo(0.5 * 1.02, 10);
    await ter(B, [1, 51, 52, 53, 54]);
    expect((await t.rpc<Estado>('idle_open')).rate).toBeCloseTo(0.5 * 1.05 * 1.04, 10);
  });
  it('o catálogo no banco é o da página', async () => {
    const nos = await q<{ id: number; custo: number; requer: number | null; tipo: string; valor: number }>(
      'select id, custo, requer, tipo, valor from public.idle_cat_no order by id',
    );
    expect(nos).toEqual(catalogo.arvore.map((n) => ({ id: n.id, custo: n.custo, requer: n.requer, tipo: n.tipo, valor: n.valor })));
  });
});

describe('nada retroativo', () => {
  it('comprar um nó de produção não muda o valuation do trecho anterior', async () => {
    await abrir(A);
    await pontos(A, 5);
    await q(`update public.idle_state set settled_at = settled_at - interval '20000 seconds' where user_id = $1`, [A]);
    const s = await comprar(1);
    expect((s.valuation - 10) / (0.5 * 1.02 * 20000)).toBeCloseTo(1, 2);
  });
  it('comprar o Carnaval (teto de 48h) depois de 50h fora rende só 36h, o teto de antes', async () => {
    await abrir(A);
    await ter(A, [1, 41, 42, 43, 44]);
    await pontos(A, 100);
    await q(`update public.idle_state set valuation = 0, settled_at = now() - interval '50 hours' where user_id = $1`, [A]);
    const s = await comprar(45);
    expect(s.valuation).toBeCloseTo(0.5 * 1.02 * 1.05 * 36 * 3600, 3);
  });
});

describe('paridade da abertura (economia.ts x idle_start)', () => {
  const combos: [string, number[]][] = [
    ['F$ 1 mil', [1, 21]],
    ['10 notebooks', [1, 21, 22]],
    ['F$ 1 mi', [1, 21, 22, 23, 24]],
    ['1 de cada gerador da era 1', [1, 21, 22, 23, 24, 25]],
    ['sem nó nenhum', []],
  ];
  it.each(combos)('%s', async (_nome, nos) => {
    await ter(A, nos);
    const esperado = abertura(catalogo, efeitosArvore(catalogo, nos));
    const s = await t.rpc<Estado>('idle_start');
    expect(s.valuation).toBe(esperado.valuation);
    expect(s.generators.slice(0, 30)).toEqual(esperado.generators.slice(0, s.generators.length));
  });
});
