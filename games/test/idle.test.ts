import { beforeEach, describe, expect, it } from 'vitest';

import { catalogo } from '../idle/catalogo';
import { instante, pendentes, tipo } from '../idle/oportunidades';
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
  it('idle_open duas vezes seguidas devolve a mesma linha (user_id preenchido)', async () => {
    expect((await t.rpc<Estado>('idle_open')).user_id).toBe(A);
    expect((await t.rpc<Estado>('idle_open')).user_id).toBe(A);
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
    // na era 2 rende ~17/s: para o relógio até a compra para a conta não depender de milissegundos
    await q(`update public.idle_state set settled_at = now() + interval '1 hour' where user_id = $1`, [A]);
    const s = await buy('gerador', 1);
    expect(s.valuation).toBeCloseTo(100 - 17.25 * 1.25, 1);
  });
});

const claim = (w: number) => t.rpc<Estado>('idle_claim_opportunity', { p_window: w });

describe('oportunidades no banco', () => {
  beforeEach(async () => { await t.rpc('idle_start'); });
  const semana = (s: Estado) => Date.parse(s.week_start + 'T00:00:00-03:00');
  // para o relógio até as pegas: a conta do bônus não depende de milissegundos
  const parar = () => q(`update public.idle_state set settled_at = now() + interval '1 hour' where user_id = $1`, [A]);

  it('o banco e a tela concordam nas pendentes', async () => {
    const s = await t.rpc<Estado>('idle_open');
    expect(pendentes(A, Date.parse(s.server_now), [], semana(s))).toEqual(
      (await q<{ l: string[] }>(`select public.idle_opp_list(s, $2::timestamptz) as l from public.idle_state s where user_id = $1`, [A, s.server_now]))[0].l.map(Number),
    );
  });
  it('pega as 3 (cada tipo com o seu bônus) e não pega de novo', async () => {
    let s = await t.rpc<Estado>('idle_open');
    await parar();
    const lista = pendentes(A, Date.parse(s.server_now), [], semana(s));
    expect(lista).toHaveLength(3);
    expect(new Set(lista.map((w) => tipo(A, w)))).toEqual(new Set([0, 1, 2]));
    for (const w of lista) {
      const antes = s;
      s = await claim(w);
      if (tipo(A, w) === 0) expect(s.valuation).toBeCloseTo(antes.valuation + antes.rate * 900, 3);
      if (tipo(A, w) === 1) {
        const dur = Date.parse(s.boost_until!) - Date.parse(s.server_now);
        expect(dur).toBeGreaterThan(55_000);
        expect(dur).toBeLessThan(65_000);
      }
      if (tipo(A, w) === 2) expect(s.half_price).toBe(true);
      expect(s.opp_claimed.map(Number)).toContain(w);
      await expect(claim(w)).rejects.toThrow(/idle_opp_gone/);
    }
    expect(s.opp_left).toBe(7);
  });
  it('pegas as 3, a 4ª mais recente não entra na caixinha', async () => {
    const s = await t.rpc<Estado>('idle_open');
    const agora = Date.parse(s.server_now);
    for (const w of pendentes(A, agora, [], semana(s))) await claim(w);
    const apareceram: number[] = [];
    for (let w = Math.floor(agora / 600_000); apareceram.length < 4; w--) if (instante(A, w) <= agora) apareceram.push(w);
    expect(instante(A, apareceram[3])).toBeGreaterThan(agora - 4 * 3600_000);
    await expect(claim(apareceram[3])).rejects.toThrow(/idle_opp_gone/);
  });
  it('Viralizar: tipo 0 rende o dobro e o limite do dia vai a 13', async () => {
    await q(`update public.idle_state set generators[13] = 1, strategies = '{0,0,-1,-1}' where user_id = $1`, [A]);
    const s0 = await t.rpc<Estado>('idle_open');
    await parar();
    expect(s0.era).toBe(3);
    expect(s0.opp_left).toBe(13);
    const w = pendentes(A, Date.parse(s0.server_now), [], semana(s0)).find((x) => tipo(A, x) === 0)!;
    const s = await claim(w);
    expect((s.valuation - s0.valuation) / (s0.rate * 1800)).toBeCloseTo(1, 6);
    expect(s.opp_left).toBe(12);
  });
  it('janela do futuro ou velha demais: idle_opp_gone', async () => {
    const s = await t.rpc<Estado>('idle_open');
    const agoraW = Math.floor(Date.parse(s.server_now) / 600_000);
    await expect(claim(agoraW + 2)).rejects.toThrow(/idle_opp_gone/);
    await expect(claim(agoraW - 30)).rejects.toThrow(/idle_opp_gone/);
  });
  it('janela nula: idle_opp_gone e o estado não muda', async () => {
    await t.rpc<Estado>('idle_open');
    const ler = () => q<{ half_price: boolean; opp_count: number }>(`select half_price, opp_count from public.idle_state where user_id = $1`, [A]);
    const antes = (await ler())[0];
    await expect(claim(null as unknown as number)).rejects.toThrow(/idle_opp_gone/);
    const depois = (await ler())[0];
    expect(depois.half_price).toBe(antes.half_price);
    expect(depois.half_price).toBe(false);
    expect(depois.opp_count).toBe(antes.opp_count);
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

const envelhecer = () => q('update public.idle_state set week_start = week_start - 7 where true');

describe('placar', () => {
  it('só quem abriu a empresa, do maior pro menor R$/s (não pelo valuation)', async () => {
    await t.rpc('idle_start');
    await dar(A, 500);
    await ter(A, 2, 5);
    await t.as(B);
    await t.rpc('idle_start');
    await dar(B, 900);
    const rows = await t.rpc<{ user_id: string; valuation: number; rate: number; era: number }[]>('idle_board');
    expect(rows.map((r) => r.user_id)).toEqual([A, B]);
    expect(rows[0].rate).toBeGreaterThan(rows[1].rate);
    expect(rows[1].rate).toBe(0.5); // só o gerador 1 do Abrir CNPJ
    expect(rows[1].valuation).toBeGreaterThanOrEqual(900);
  });
  it('R$/s empatado: desempata pelo valuation', async () => {
    await t.rpc('idle_start');
    await dar(A, 500);
    await t.as(B);
    await t.rpc('idle_start');
    await dar(B, 900);
    const rows = await t.rpc<{ user_id: string }[]>('idle_board');
    expect(rows.map((r) => r.user_id)).toEqual([B, A]);
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
      { schedule: '2 3 * * 1', command: 'select public.idle_weekly_reset()' },
    ]);
  });
  it('reset de novo pra mesma semana velha (linha atrasada) não troca o selo do campeão', async () => {
    await envelhecer();
    await q('select public.idle_weekly_reset()');
    await q(
      `insert into public.idle_state (user_id, week_start, started, valuation) values ($1, public.games_week_start() - 7, true, 5000)`,
      [A],
    );
    await q('select public.idle_weekly_reset()');
    expect(await q('select id from public.profiles where \'weekly_unicorn\' = any (badges)')).toEqual([{ id: B }]);
    const semanas = await q<{ unicorn_id: string }>('select unicorn_id from public.idle_weeks');
    expect(semanas).toEqual([{ unicorn_id: B }]);
    expect(await q('select * from public.idle_state')).toEqual([]);
  });
  it('o pódio conta a produção só até a meia-noite de Brasília', async () => {
    await envelhecer();
    await q(
      `update public.idle_state
          set settled_at = (public.games_week_start()::timestamp at time zone 'America/Sao_Paulo') - interval '1 hour'
        where user_id = $1`,
      [A],
    );
    await q('select public.idle_weekly_reset()');
    const [semana] = await q<{ podium: { user_id: string; valuation: number }[] }>('select podium from public.idle_weeks');
    const a = semana.podium.find((p) => p.user_id === A)!;
    expect(a.valuation).toBeCloseTo(500 + 0.5 * 3600, 3);
    expect(semana.podium.map((p) => p.user_id)).toEqual([A, B]);
  });
});
