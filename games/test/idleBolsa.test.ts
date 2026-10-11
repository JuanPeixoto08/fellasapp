// Banco da Bolsa (minigame 1): migrações reais no PGlite.
import { beforeEach, describe, expect, it } from 'vitest';

import { EMPRESAS_BOLSA, escolherHumor, inicial, normal, tick, type Mercado } from '../idle/bolsaMotor';
import { freshDb, type TestDb } from './db';

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;

beforeEach(async () => {
  t = await freshDb();
});

type Linha = { valor: number; delta: number; humor: number; humor_ate: string; geracao: number; rj_ate: string | null };
const paraTs = (l: Linha): Mercado => ({
  valor: l.valor, delta: l.delta, humor: l.humor, humorAte: Number(l.humor_ate), geracao: l.geracao,
  rjAte: l.rj_ate === null ? null : Number(l.rj_ate),
});

/** Roda o tick em SQL com o estado m (como linha de idle_bolsa_mercado). */
async function tickSql(m: Mercado, empresa: number, tt: number, u: number[]): Promise<Mercado> {
  const [r] = await q<Linha>(
    `select (x).valor, (x).delta, (x).humor, (x).humor_ate::text, (x).geracao, (x).rj_ate::text from (
       select public.idle_bolsa_tick(row($1::int, $2::bigint, $3::float8, $4::float8, $5::int, $6::bigint, $7::int, $8::bigint)::public.idle_bolsa_mercado, c, $9::bigint, $10::double precision[]) as x
       from public.idle_cat_bolsa c where c.id = $1) s`,
    [empresa, tt - 1, m.valor, m.delta, m.humor, m.humorAte, m.geracao, m.rjAte, tt, u],
  );
  return paraTs(r);
}

describe('catálogo e tick (paridade SQL × TS)', () => {
  it('o catálogo do banco é o mesmo da página', async () => {
    const rows = await q<{ id: number; codigo: string; nome: string; gerador: number; repouso: number; vol: number; pesos: number[]; quebra: number }>(
      'select id, codigo, nome, gerador, repouso, vol, pesos, quebra from public.idle_cat_bolsa order by id');
    expect(rows).toEqual(EMPRESAS_BOLSA.map((e) => ({ ...e, pesos: [...e.pesos] })));
  });
  it('normal e humor iguais', async () => {
    for (const [a, b] of [[0, 0], [0.3, 0.6], [0.999, 0.25], [0.5, 0.9]]) {
      const [r] = await q<{ n: number }>('select public.idle_bolsa_normal($1, $2) as n', [a, b]);
      expect(Math.abs(r.n - normal(a, b))).toBeLessThan(1e-9);
    }
    for (const u of [0, 0.1, 0.33, 0.5, 0.77, 0.999]) {
      const [r] = await q<{ h: number }>('select public.idle_bolsa_humor($1::double precision[], $2) as h', [EMPRESAS_BOLSA[3].pesos, u]);
      expect(r.h).toBe(escolherHumor(EMPRESAS_BOLSA[3].pesos, u));
    }
  });
  it('200 ticks de cada empresa com os mesmos sorteios dão o mesmo mercado (< 1e-9)', async () => {
    let s = 7;
    const u = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    for (const e of EMPRESAS_BOLSA) {
      let ts = inicial(e, 0);
      let sql = inicial(e, 0);
      for (let tt = 1; tt <= 200; tt++) {
        const sorteio = [u(), u(), u(), u(), u(), u(), u()];
        // força a zona de risco de vez em quando, pra exercitar a quebra
        if (tt % 50 === 0) { ts = { ...ts, valor: e.repouso * 0.1 }; sql = { ...sql, valor: e.repouso * 0.1 }; sorteio[6] = 0; }
        ts = tick(ts, e, tt, sorteio);
        sql = await tickSql(sql, e.id, tt, sorteio);
        expect(Math.abs(sql.valor - ts.valor), `${e.codigo} t${tt}`).toBeLessThan(1e-9 * Math.max(1, ts.valor));
        expect(Math.abs(sql.delta - ts.delta)).toBeLessThan(1e-9);
        expect({ ...sql, valor: 0, delta: 0 }).toEqual({ ...ts, valor: 0, delta: 0 });
      }
    }
  });
  it('catálogo: membro lê, anônimo não', async () => {
    await t.member('00000000-0000-0000-0000-00000000000a');
    await t.as('00000000-0000-0000-0000-00000000000a');
    expect(await t.asRole('authenticated', 'select id from public.idle_cat_bolsa')).toHaveLength(8);
    await expect(t.asRole('anon', 'select id from public.idle_cat_bolsa')).rejects.toThrow();
    await expect(t.asRole('authenticated', 'select * from public.idle_bolsa_mercado')).rejects.toThrow();
  });
});

describe('avançar o mercado', () => {
  const precos = (empresa: number) =>
    q<{ tick: string; valor: number }>('select p.tick::text as tick, p.valor from public.idle_bolsa_precos p where p.empresa = $1 order by p.tick', [empresa]);
  const mercado = (empresa: number) => q<Linha & { tick: string }>('select *, tick::text, humor_ate::text, rj_ate::text from public.idle_bolsa_mercado where empresa = $1', [empresa]);

  it('primeira vez: cria as 8 no repouso, no tick de agora', async () => {
    await q('select public.idle_bolsa_avancar_ate(1000)');
    const rows = await q<{ n: number }>('select count(*)::int as n from public.idle_bolsa_mercado');
    expect(rows[0].n).toBe(8);
    expect(await precos(1)).toEqual([{ tick: '1000', valor: 30 }]);
  });
  it('gera os minutos que faltam, um preço por minuto por empresa; mesmo tick de novo não muda nada', async () => {
    await q('select setseed(0.42)');
    await q('select public.idle_bolsa_avancar_ate(1000)');
    await q('select public.idle_bolsa_avancar_ate(1005)');
    expect((await precos(3)).map((p) => p.tick)).toEqual(['1000', '1001', '1002', '1003', '1004', '1005']);
    const antes = await mercado(3);
    await q('select public.idle_bolsa_avancar_ate(1005)');
    expect(await mercado(3)).toEqual(antes);
    expect(await precos(3)).toHaveLength(6);
  });
  it('mais de 1 dia parado: gera só o último dia', async () => {
    await q('select public.idle_bolsa_avancar_ate(1000)');
    await q('select public.idle_bolsa_avancar_ate(1000 + 5000)');
    const p = await precos(1);
    expect(p).toHaveLength(1 + 1440);
    expect(p[1].tick).toBe(String(1000 + 5000 - 1440 + 1));
  });
  it('apaga o histórico de mais de 7 dias', async () => {
    await q('select public.idle_bolsa_avancar_ate(20000)');
    // 20001 − 10080 = 9921: o 9920 já passou de 7 dias, o 9921 ainda não
    await q('insert into public.idle_bolsa_precos (tick, empresa, valor) values (9920, 1, 1), (9921, 1, 1)');
    await q('select public.idle_bolsa_avancar_ate(20001)');
    expect((await precos(1)).map((p) => p.tick)).toEqual(['9921', '20000', '20001']);
  });
  it('quebra no banco: empresa na zona de risco com chance 1 quebra, fica 10 minutos parada e volta', async () => {
    await q('select public.idle_bolsa_avancar_ate(1000)');
    await q('update public.idle_cat_bolsa set quebra = 1 where id = 4');
    await q('update public.idle_bolsa_mercado set valor = 1, humor = 4, humor_ate = 99999 where empresa = 4');
    await q('select public.idle_bolsa_avancar_ate(1001)');
    let [m] = await mercado(4);
    expect(m.geracao).toBe(1);
    expect(m.rj_ate).toBe('1011');
    await q('select public.idle_bolsa_avancar_ate(1011)');
    [m] = await mercado(4);
    expect(m.rj_ate).toBeNull();
    expect(m.valor).toBe(20);
  });
  it('avançar de verdade usa o relógio: tick = minutos desde 1970', async () => {
    const [{ agora }] = await q<{ agora: string }>('select public.idle_bolsa_agora()::text as agora');
    expect(Math.abs(Number(agora) - Math.floor(Date.now() / 60000))).toBeLessThanOrEqual(1);
    const [{ v }] = await q<{ v: string }>('select public.idle_bolsa_avancar()::text as v');
    expect(Math.abs(Number(v) - Number(agora))).toBeLessThanOrEqual(1);
  });
});

describe('carteira e negociar', () => {
  const A = '00000000-0000-0000-0000-00000000000a';
  const OUT = '00000000-0000-0000-0000-0000000000ff';
  type Bolsa = {
    tick: number; vira_em_ms: number; r: number; aberta: boolean; corretor: number; escritorio: number; corretagem: number;
    empresas: { id: number; valor: number; limite: number; risco: boolean; rj_ate: number | null; historico: number[] }[];
    carteira: { empresa: number; qtd: number; custo: number }[]; viraram_po: { empresa: number; qtd: number }[];
  };
  type Resp = { valuation: number; bolsa: Bolsa };
  const T = 5000;
  const negociar = (empresa: number, lado: string, qtd: number, tick = T, agora = T) =>
    q<{ v: Resp }>('select public.idle_bolsa_negociar_em($1, $2, $3, $4, $5, $6) as v', [A, empresa, lado, qtd, tick, agora]).then((r) => r[0].v);
  const estado = (agora = T) => q<{ v: Bolsa }>('select public.idle_bolsa_estado($1, $2) as v', [A, agora]).then((r) => r[0].v);
  const r = async () => (await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [A]))[0].r;
  const valuation = async () => (await q<{ v: number }>('select valuation as v from public.idle_state where user_id = $1', [A]))[0].v;

  beforeEach(async () => {
    await t.member(A);
    await t.member(OUT, { isMember: false });
    await t.as(A);
    await t.rpc('idle_start');
    // 2 Grupos de trader, 20 Food trucks (o Pastel é ligado a eles: limite 120) e F$ de sobra; mercado no tick T, Pastel (1) a 30 s
    // conta fechada no futuro: negociar não soma produção no meio (a diferença de F$ é só a da compra/venda)
    await q(`update public.idle_state set generators[19] = 2, generators[11] = 20, generators[1] = 10, valuation = 1e12,
      settled_at = now() + interval '1 day' where user_id = $1`, [A]);
    await q('select public.idle_bolsa_avancar_ate($1)', [T]);
  });

  it('estado: aberta com trader, limite de cada empresa = 100 + o gerador ligado, corretagem 5%, preços e histórico', async () => {
    const b = await estado();
    expect(b.aberta).toBe(true);
    expect(b.empresas[0].limite).toBe(120); // Pastel ↔ 20 Food trucks
    expect(b.empresas[3].limite).toBe(102); // Cripto ↔ 2 Grupos de trader
    expect(b.empresas[1].limite).toBe(100); // Açaí ↔ nenhum Influencer
    expect(b).toMatchObject({ corretor: 0, escritorio: 0, corretagem: 0.05 });
    expect(b.tick).toBe(T);
    expect(b.r).toBeCloseTo(await r(), 9);
    expect(b.empresas).toHaveLength(8);
    expect(b.empresas[0]).toMatchObject({ id: 1, valor: 30, limite: 120, risco: false, rj_ate: null, historico: [30] });
    expect(b.carteira).toEqual([]);
  });
  it('comprar 10: paga 10 × valor × r × 1,05 e guarda o custo em segundos', async () => {
    const rr = await r();
    const antes = await valuation();
    const resp = await negociar(1, 'comprar', 10);
    expect(antes - resp.valuation).toBeCloseTo(10 * 30 * rr * 1.05, 3);
    expect(resp.bolsa.carteira).toEqual([{ empresa: 1, qtd: 10, custo: 10 * 30 * 1.05 }]);
  });
  it('vender: recebe qtd × valor × r sem taxa e tira o custo na proporção; Tudo (0) vende o resto', async () => {
    await negociar(1, 'comprar', 10);
    const rr = await r();
    const antes = await valuation();
    const resp = await negociar(1, 'vender', 1);
    expect(resp.valuation - antes).toBeCloseTo(30 * rr, 3);
    expect(resp.bolsa.carteira[0].qtd).toBe(9);
    expect(resp.bolsa.carteira[0].custo).toBeCloseTo(9 * 30 * 1.05, 9);
    const fim = await negociar(1, 'vender', 0);
    expect(fim.bolsa.carteira).toEqual([]);
  });
  it('Máx: compra o que o F$ e o limite deixam; F$ exato passa, um centavo a menos não', async () => {
    const rr = await r();
    const um = 30 * rr * 1.05;
    await q('update public.idle_state set valuation = $2 where user_id = $1', [A, um * 3]);
    const resp = await negociar(1, 'comprar', 0);
    expect(resp.bolsa.carteira[0].qtd).toBe(3);
    await q('update public.idle_state set valuation = $2 where user_id = $1', [A, um - 0.01]);
    await expect(negociar(1, 'comprar', 1)).rejects.toThrow('idle_cant_afford');
  });
  it('limite: 120 com 20 Food trucks no Pastel; acima disso idle_bolsa_limite', async () => {
    await negociar(1, 'comprar', 0);
    expect((await estado()).carteira[0].qtd).toBe(120);
    await expect(negociar(1, 'comprar', 1)).rejects.toThrow('idle_bolsa_limite');
  });
  it('recusas: preço mudou, sem trader, recuperação judicial, sem ações, opção inválida', async () => {
    await expect(negociar(1, 'comprar', 1, T - 1)).rejects.toThrow('idle_bolsa_preco_mudou');
    await expect(negociar(1, 'vender', 1)).rejects.toThrow('idle_bolsa_sem_acoes');
    await expect(negociar(1, 'comprar', 5)).rejects.toThrow('idle_bad_choice');
    await expect(negociar(99, 'comprar', 1)).rejects.toThrow('idle_bad_choice');
    await q('update public.idle_bolsa_mercado set rj_ate = $1 where empresa = 4', [T + 5]);
    await expect(negociar(4, 'comprar', 1)).rejects.toThrow('idle_bolsa_rj');
    await q(`update public.idle_state set generators[19] = 0 where user_id = $1`, [A]);
    await expect(negociar(1, 'comprar', 1)).rejects.toThrow('idle_bolsa_fechada');
  });
  it('quebrou: as ações da geração velha viram pó uma vez e não entram em venda nem limite', async () => {
    await negociar(4, 'comprar', 10);
    await q('update public.idle_bolsa_mercado set geracao = geracao + 1 where empresa = 4');
    await expect(negociar(4, 'vender', 1)).rejects.toThrow('idle_bolsa_sem_acoes');
    const b = await estado();
    expect(b.viraram_po).toEqual([{ empresa: 4, qtd: 10 }]);
    expect(b.carteira).toEqual([]);
    expect((await estado()).viraram_po).toEqual([]);
    const resp = await negociar(4, 'comprar', 0);
    expect(resp.bolsa.carteira[0].qtd).toBe(102); // Cripto ↔ 2 Grupos de trader
  });
  it('a carteira atravessa a venda da startup', async () => {
    await negociar(1, 'comprar', 10);
    await q(`update public.idle_state set generators[30] = 150, strategies = '{0,0,0,0}' where user_id = $1`, [A]);
    await t.rpc('idle_prestige');
    const b = await estado();
    expect(b.aberta).toBe(false);
    expect(b.carteira).toEqual([{ empresa: 1, qtd: 10, custo: 10 * 30 * 1.05 }]);
  });
  it('RPCs: membro chama idle_bolsa e negocia pelo relógio; não membro é recusado', async () => {
    // o mercado foi criado no tick 5000: sem isto o relógio de verdade faria gerar 1 dia inteiro (lento no PGlite)
    await q('update public.idle_bolsa_mercado set tick = public.idle_bolsa_agora() - 1 where true');
    const b = await t.rpc<Bolsa>('idle_bolsa');
    expect(b.empresas).toHaveLength(8);
    const resp = await t.rpc<Resp>('idle_bolsa_negociar', { p_empresa: 1, p_lado: 'comprar', p_qtd: 1, p_tick: b.tick });
    expect(resp.bolsa.carteira[0].qtd).toBe(1);
    await t.as(OUT);
    await expect(t.rpc('idle_bolsa')).rejects.toThrow('not_member');
    await expect(t.asRole('authenticated', 'select public.idle_bolsa_estado($1, 1)', [A])).rejects.toThrow();
  });

  const melhorar = (tipo: string, nivel: number) =>
    q<{ v: Resp }>('select public.idle_bolsa_melhorar_em($1, $2, $3, $4) as v', [A, tipo, nivel, T]).then((x) => x[0].v);

  it('Corretor 1: custa 1800 s de produção, corretagem cai pra 4% e a próxima compra paga 4%', async () => {
    const rr = await r();
    const antes = await valuation();
    const resp = await melhorar('corretor', 1);
    expect(antes - resp.valuation).toBeCloseTo(1800 * rr, 3);
    expect(resp.bolsa).toMatchObject({ corretor: 1, corretagem: 0.04 });
    // salvar a melhoria confere as conquistas (pode dar +1% cada): a produção da compra é a de agora
    const rr2 = await r();
    const v0 = await valuation();
    const c = await negociar(1, 'comprar', 10);
    expect(v0 - c.valuation).toBeCloseTo(10 * 30 * rr2 * 1.04, 3);
    expect(c.bolsa.carteira[0].custo).toBeCloseTo(10 * 30 * 1.04, 9);
  });
  it('Escritório: +25 em todas no nível 1, +50 no nível 2 (o do nível, não a soma)', async () => {
    await melhorar('escritorio', 1);
    expect((await estado()).empresas[0].limite).toBe(145);
    await melhorar('escritorio', 2);
    const b = await estado();
    expect(b.empresas[0].limite).toBe(170);
    expect(b.empresas[1].limite).toBe(150);
  });
  it('nível fora de ordem, repetido ou depois do 5: idle_bolsa_nivel; sem F$: idle_cant_afford; sem trader: idle_bolsa_fechada', async () => {
    await expect(melhorar('corretor', 2)).rejects.toThrow('idle_bolsa_nivel');
    await melhorar('corretor', 1);
    await expect(melhorar('corretor', 1)).rejects.toThrow('idle_bolsa_nivel');
    await expect(melhorar('outra', 1)).rejects.toThrow('idle_bad_choice');
    await q('update public.idle_bolsa_nivel set corretor = 5 where user_id = $1', [A]);
    await expect(melhorar('corretor', 6)).rejects.toThrow('idle_bolsa_nivel');
    await q('update public.idle_state set valuation = 1 where user_id = $1', [A]);
    await expect(melhorar('escritorio', 1)).rejects.toThrow('idle_cant_afford');
    await q(`update public.idle_state set generators[19] = 0 where user_id = $1`, [A]);
    await expect(melhorar('escritorio', 1)).rejects.toThrow('idle_bolsa_fechada');
  });
  it('as melhorias ficam na venda da startup', async () => {
    await melhorar('escritorio', 1);
    await q(`update public.idle_state set generators[30] = 150, strategies = '{0,0,0,0}' where user_id = $1`, [A]);
    await t.rpc('idle_prestige');
    expect(await estado()).toMatchObject({ escritorio: 1, corretor: 0 });
  });
  it('RPC idle_bolsa_melhorar: membro compra; não membro é recusado', async () => {
    await q('update public.idle_bolsa_mercado set tick = public.idle_bolsa_agora() - 1 where true');
    const resp = await t.rpc<Resp>('idle_bolsa_melhorar', { p_tipo: 'corretor', p_nivel: 1 });
    expect(resp.bolsa.corretor).toBe(1);
    await t.as(OUT);
    await expect(t.rpc('idle_bolsa_melhorar', { p_tipo: 'corretor', p_nivel: 2 })).rejects.toThrow('not_member');
  });
});
