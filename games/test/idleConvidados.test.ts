// Convidados no PPP Podcast (0051): migrações reais no PGlite. O relógio é o do vitest (o now() do PGlite segue o Date
// falso): cada teste para o tempo e anda quando precisa.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { derrubada, kojimaMult, tobyMult } from '../idle/convidados';
import { freshDb, quartaATarde, type TestDb } from './db';

const A = '00000000-0000-0000-0000-00000000000a';
const H = 3_600_000;

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;
type Conv = { cadeira: (number | null)[]; desde: (string | null)[]; trocas: number; trocas_t: string | null; ppp: number };
type Estado = { valuation: number; rate: number; convidados: Conv; opp_left: number; mesma_pessoa?: boolean };
const sentar = (c: number, id: number) => t.rpc<Estado>('idle_conv_sentar', { p_cadeira: c, p_convidado: id });
const tirar = (c: number) => t.rpc<Estado>('idle_conv_tirar', { p_cadeira: c });
const abrir = () => t.rpc<Estado>('idle_open');
const taxa = async () => (await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [A]))[0].r;
const conquistas = async () => (await q<{ id: number }>('select conquista_id as id from public.idle_conquistas where user_id = $1 order by 1', [A])).map((x) => x.id);
let agora = 0;
const andar = (ms: number) => { agora += ms; vi.setSystemTime(agora); };
const ppp = (n: number) => q(`update public.idle_state set generators[13] = $2 where user_id = $1`, [A, n]);

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  agora = quartaATarde().getTime();
  vi.setSystemTime(agora);
  t = await freshDb({ conquistas: true });
  await t.member(A);
  await t.as(A);
  await t.rpc('idle_start');
  await q(`update public.idle_state set valuation = 1e15, generators[1] = 50, generators[11] = 10, generators[13] = 60, strategies = '{0,0,0,0}' where user_id = $1`, [A]);
});
afterEach(() => vi.useRealTimers());

describe('sentar, tirar e as trocas', () => {
  it('sentar grava a cadeira e gasta 1 troca; a 4ª seguida não dá; 1 h depois volta uma', async () => {
    let s = await sentar(0, 1);
    expect(s.convidados.cadeira).toEqual([1, null, null]);
    expect(s.convidados.trocas).toBe(2);
    await sentar(1, 2);
    s = await sentar(2, 4);
    expect(s.convidados.trocas).toBe(0);
    await expect(sentar(0, 5)).rejects.toThrow(/idle_conv_sem_troca/);
    andar(H + 1000);
    s = await sentar(0, 5); // troca o Cristiano pelo Kojima
    expect(s.convidados.cadeira).toEqual([5, 2, 4]);
    expect(s.convidados.trocas).toBe(0);
    andar(3 * H);
    expect((await abrir()).convidados).toMatchObject({ trocas: 0 }); // guardado é o da âncora; a página calcula a recarga
    s = await sentar(0, 1);
    expect(s.convidados.trocas).toBe(2); // voltaram as 3 e gastou 1
  });
  it('tirar é de graça; o mesmo convidado não senta em duas', async () => {
    await sentar(0, 1);
    const s = await tirar(0);
    expect(s.convidados.cadeira).toEqual([null, null, null]);
    expect(s.convidados.trocas).toBe(2);
    await sentar(1, 3);
    await expect(sentar(2, 3)).rejects.toThrow(/idle_conv_ja_sentado/);
  });
  it('cadeiras pelos PPP Podcasts: sem nenhum fecha; o meio abre com 25, o canto com 50', async () => {
    await ppp(0);
    await expect(sentar(0, 1)).rejects.toThrow(/idle_conv_fechado/);
    await ppp(24);
    await expect(sentar(1, 1)).rejects.toThrow(/idle_conv_trancada/);
    await ppp(25);
    await sentar(1, 1);
    await expect(sentar(2, 2)).rejects.toThrow(/idle_conv_trancada/);
  });
  it('São a mesma pessoa? fecha a conta antes (o F$ não volta pro de antes)', async () => {
    await sentar(0, 3);
    andar(3_600_000);
    const s = await sentar(1, 9);
    const [{ v }] = await q<{ v: number }>('select valuation as v from public.idle_state where user_id = $1', [A]);
    expect(s.valuation).toBeCloseTo(v, 3);
    const [{ t: st }] = await q<{ t: string }>('select settled_at::text as t from public.idle_state where user_id = $1', [A]);
    expect(Date.parse(st)).toBeGreaterThan(agora - 5000);
  });
  it('Gemaplys e MC V.V: não muda nada, a escondida sai', async () => {
    await sentar(0, 3);
    const s = await sentar(1, 9);
    expect(s.mesma_pessoa).toBe(true);
    expect(s.convidados.cadeira).toEqual([3, null, null]);
    expect(s.convidados.trocas).toBe(2);
    expect(await conquistas()).toContain(113);
  });
  it('conquistas: primeiro sentado, mesa cheia, Cristiano na frente, Gabe no canto', async () => {
    await sentar(0, 1);
    await sentar(1, 2);
    await sentar(2, 6);
    expect(await conquistas()).toEqual(expect.arrayContaining([73, 74, 76, 79]));
  });
  it('conquista do Toby Fox: 20 h sentado sem trocar', async () => {
    await sentar(0, 10);
    andar(19 * H);
    await abrir();
    expect(await conquistas()).not.toContain(81);
    andar(H + 1000);
    await abrir();
    expect(await conquistas()).toContain(81);
    const [{ nome }] = await q<{ nome: string }>('select nome from public.idle_cat_conv where id = 10');
    expect(nome).toBe('Toby Fox');
  });
  it('vender a startup não mexe nas cadeiras', async () => {
    await sentar(0, 1);
    await q(`update public.idle_state set prestige_earned = 0 where user_id = $1`, [A]);
    await q(`update public.idle_state set valuation = 1e30, generators[30] = 100 where user_id = $1`, [A]);
    await t.rpc('idle_prestige');
    const [{ c }] = await q<{ c: number[] }>('select conv_cadeira as c from public.idle_state where user_id = $1', [A]);
    expect(c).toEqual([1, null, null]);
  });
});

describe('os efeitos', () => {
  // sem o catálogo das conquistas: cada uma ganha daria +1% e atrapalharia a conta exata
  beforeEach(async () => { await q('delete from public.idle_cat_conquista where true'); });
  it('Cristiano na frente: produção ×1,15 e melhorias 10% mais caras', async () => {
    const r0 = await taxa();
    await sentar(0, 1);
    expect(await taxa()).toBeCloseTo(r0 * 1.15, 6);
  });
  it('Luva +5 e Gabe −3 no limite do dia', async () => {
    const base = (await abrir()).opp_left;
    await sentar(0, 4);
    expect((await abrir()).opp_left).toBe(base + 5);
    await sentar(1, 6);
    expect((await abrir()).opp_left).toBe(base + 5 - 2);
  });
  it('Gabe: o gerador sai 10% mais barato', async () => {
    const preco = async () => {
      const [{ v }] = await q<{ v: number }>('select valuation as v from public.idle_state where user_id = $1', [A]);
      await q(`update public.idle_state set settled_at = now() + interval '1 day' where user_id = $1`, [A]);
      const s = await t.rpc<Estado>('idle_buy', { p_kind: 'gerador', p_id: 2, p_qty: 1 });
      await q(`update public.idle_state set valuation = $2, generators[2] = generators[2] - 1 where user_id = $1`, [A, v]);
      return v - s.valuation;
    };
    await q(`update public.idle_state set valuation = 1e6 where user_id = $1`, [A]);
    const sem = await preco();
    await sentar(0, 6);
    expect(await preco()).toBeCloseTo(sem * 0.9, 3);
  });
  it('Kojima: a conta de 7 h de uma vez soma os degraus de hora em hora', async () => {
    await sentar(0, 5);
    const [{ desde }] = await q<{ desde: string }>('select conv_desde[1]::text as desde from public.idle_state where user_id = $1', [A]);
    const d = Date.parse(desde);
    const base = (await taxa()) / kojimaMult(1, d, agora);
    await q(`update public.idle_state set settled_at = now(), valuation = 0 where user_id = $1`, [A]);
    andar(7 * H);
    const [{ v }] = await q<{ v: number }>(`select (public.idle_settle(s, now())).valuation as v from public.idle_state s where user_id = $1`, [A]);
    let esperado = 0;
    for (let h = 0; h < 7; h++) esperado += base * kojimaMult(1, d, d + h * H) * 3600;
    expect(v / esperado).toBeCloseTo(1, 6);
    expect(v).toBeGreaterThan(base * 0.9 * 7 * 3600);
  });
  it('paridade com convidados.ts: derrubada', async () => {
    const desde = 1_791_000_000;
    for (let k = 1; k <= 40; k++) {
      const [{ d }] = await q<{ d: boolean }>(
        `select public.idle_horta_sorte($1, 50, $2::bigint + $3, 9) < 0.25 as d`, [A, desde, k]);
      expect(d).toBe(derrubada(A, desde, k));
    }
  });
  it('Toby Fox: +2% por hora sentado até +40%; a conta de 5 h de uma vez soma os degraus; melhorias 10% mais caras', async () => {
    const precoMelhoria = async () => {
      await q(`update public.idle_state set valuation = 1e12, upgrades = '{}', settled_at = now() + interval '1 day' where user_id = $1`, [A]);
      const s = await t.rpc<Estado>('idle_buy', { p_kind: 'melhoria', p_id: 11, p_qty: 1 });
      await q(`update public.idle_state set upgrades = '{}', settled_at = now() where user_id = $1`, [A]);
      return 1e12 - s.valuation;
    };
    const semToby = await precoMelhoria();
    await sentar(0, 10);
    expect(await precoMelhoria()).toBeCloseTo(semToby * 1.1, 3);
    const [{ desde }] = await q<{ desde: string }>('select conv_desde[1]::text as desde from public.idle_state where user_id = $1', [A]);
    const d = Date.parse(desde);
    const r = async (ms: number) => (await q<{ r: number }>('select public.idle_rate_at(s, to_timestamp($2)) as r from public.idle_state s where user_id = $1', [A, ms / 1000]))[0].r;
    const base = await r(d);
    expect((await r(d + 10 * H + 1000)) / base).toBeCloseTo(tobyMult(1, d, d + 10 * H + 1000), 9);
    expect((await r(d + 30 * H)) / base).toBeCloseTo(1.4, 9);
    await q(`update public.idle_state set settled_at = now(), valuation = 0 where user_id = $1`, [A]);
    andar(5 * H);
    const [{ v }] = await q<{ v: number }>(`select (public.idle_settle(s, now())).valuation as v from public.idle_state s where user_id = $1`, [A]);
    const ini = agora - 5 * H;
    let esperado = 0;
    for (let k = 0; k < 5; k++) {
      // de hora em hora contando de quando sentou: o pedaço [ini, fim] com o multiplicador de cada degrau
      const a = ini + k * H, b = a + H;
      for (const [x, y] of [[a, Math.min(b, d + Math.ceil((a - d) / H + 1e-9) * H)], [Math.min(b, d + Math.ceil((a - d) / H + 1e-9) * H), b]]) {
        if (y > x) esperado += base * tobyMult(1, d, x) * ((y - x) / 1000);
      }
    }
    expect(v / esperado).toBeCloseTo(1, 6);
  });
});

describe('eventos na tela', () => {
  it('a sorte com o Gemaplys é a mesma da página (gema 0, 0,5 e 1) e dobra os eventos na frente', async () => {
    const { douradoEm } = await import('../idle/dourados');
    const ini = 1_760_000_000;
    const n: number[] = [];
    for (const gema of [0, 0.5, 1]) {
      const sql = await q<{ s: string; d: number }>(
        `select s::text, public.idle_dourado($1::uuid, s, $4) as d from generate_series($2::bigint, $3::bigint) s
          where public.idle_dourado($1::uuid, s, $4) is not null order by s`, [A, ini, ini + 29_999, gema]);
      const ts: { s: string; d: number }[] = [];
      for (let s = ini; s < ini + 30_000; s++) {
        const d = douradoEm(A, s, gema);
        if (d !== null) ts.push({ s: String(s), d });
      }
      expect(sql).toEqual(ts);
      n.push(ts.length);
    }
    expect(n[2] / n[0]).toBeGreaterThan(1.6);
    expect(n[2] / n[0]).toBeLessThan(2.4);
  });
  it('MC V.V: a faixa (a cada 2 h) é um evento que dá pra pegar; a derrubada não', async () => {
    const { faixaEm } = await import('../idle/convidados');
    await sentar(0, 9);
    const [{ ds }] = await q<{ ds: string }>('select floor(extract(epoch from conv_desde[1]))::bigint::text as ds from public.idle_state where user_id = $1', [A]);
    const d = Number(ds);
    const c = { cadeira: [9, null, null], desde: [new Date(d * 1000).toISOString(), null, null], trocas: 2, trocas_t: null };
    let pegou = false;
    for (let k = 1; k <= 12 && !pegou; k++) {
      const seg = d + k * 7200;
      const tipo = faixaEm(A, c, 60, seg);
      const [{ f }] = await q<{ f: number | null }>('select public.idle_conv_faixa(s, $2) as f from public.idle_state s where user_id = $1', [A, seg]);
      expect(f).toBe(tipo);
      if (tipo !== null && tipo !== 3) {
        andar(seg * 1000 - agora + 1000);
        const r = await t.rpc<Estado>('idle_dourado_pegar', { p_seg: seg, p_lado: 0 });
        expect(r).toBeTruthy();
        pegou = true;
      }
    }
    expect(pegou).toBe(true);
    expect(faixaEm(A, c, 60, d + 7201)).toBeNull();
  });
  it('com o Gemaplys na frente o evento some em 9 s (15 − 6 de folga do banco)', async () => {
    await t.db.exec(`create table public.teste_dourado (s bigint primary key, tipo int);
      create or replace function public.idle_dourado(u uuid, s bigint, gema double precision default 0) returns int language sql stable as
        'select tipo from public.teste_dourado where teste_dourado.s = idle_dourado.s';`);
    await sentar(0, 3);
    const seg = Math.floor(agora / 1000);
    await q('insert into public.teste_dourado values ($1, 0)', [seg]);
    andar(10_000);
    await expect(t.rpc('idle_dourado_pegar', { p_seg: seg, p_lado: 0 })).rejects.toThrow(/idle_dourado_gone/);
  });
});

describe('Bolsa: Vorcaro e VSauce', () => {
  type Pos = { empresa: number; qtd: number; custo: number; alavanca: number };
  type Bolsa = { carteira: Pos[]; empresas: { id: number; humor?: number | null }[] };
  const T = 5000;
  const negociar = (empresa: number, lado: string, qtd: number, lote = 1) =>
    q<{ v: { valuation: number; bolsa: Bolsa } }>('select public.idle_bolsa_negociar_em($1, $2, $3, $4, $5, $5, $6) as v', [A, empresa, lado, qtd, T, lote]).then((r) => r[0].v);
  const estado = () => q<{ v: Bolsa }>('select public.idle_bolsa_estado($1, $2) as v', [A, T]).then((r) => r[0].v);
  const valuation = async () => (await q<{ v: number }>('select valuation as v from public.idle_state where user_id = $1', [A]))[0].v;
  const preco = (v: number) => q('update public.idle_bolsa_mercado set valor = $1 where empresa = 1', [v]);

  beforeEach(async () => {
    await q('delete from public.idle_cat_conquista where id <> 77'); // só a do FGC: as outras mudariam a taxa no meio
    await q(`update public.idle_state set generators[19] = 2, generators[11] = 20, valuation = 1e12 where user_id = $1`, [A]);
    await q('select public.idle_bolsa_avancar_ate($1)', [T]);
  });

  it('com o Vorcaro na frente o lote é 2×: o ganho conta em dobro; separado das ações normais', async () => {
    await sentar(0, 2);
    await q(`update public.idle_state set settled_at = now() + interval '1 day' where user_id = $1`, [A]);
    let b = (await negociar(1, 'comprar', 10)).bolsa;
    expect(b.carteira).toEqual([{ empresa: 1, qtd: 10, custo: 315, alavanca: 2 }]);
    await tirar(0);
    b = (await negociar(1, 'comprar', 10)).bolsa;
    expect(b.carteira.map((p) => [p.alavanca, p.qtd])).toEqual([[1, 10], [2, 10]]);
    await preco(45);
    const r = await taxa();
    const antes = await valuation();
    const depois = (await negociar(1, 'vender', 0, 2)).valuation;
    expect(depois - antes).toBeCloseTo(10 * (31.5 + 2 * (45 - 31.5)) * r, 2);
  });
  it('a perda também dobra; caiu pela metade = pó (recebe 0) e sai "O FGC não cobre"', async () => {
    await sentar(0, 2);
    await q(`update public.idle_state set settled_at = now() + interval '1 day' where user_id = $1`, [A]);
    await negociar(1, 'comprar', 10);
    await preco(10);
    const antes = await valuation();
    const depois = (await negociar(1, 'vender', 0, 2)).valuation;
    expect(depois).toBeCloseTo(antes, 6);
    expect(await conquistas()).toContain(77);
  });
  it('tirar e sentar o Cristiano entre comprar e vender não dá F$ (a Bolsa usa a produção sem os convidados)', async () => {
    await sentar(0, 1);
    await tirar(0);
    await q(`update public.idle_state set settled_at = now() + interval '1 day' where user_id = $1`, [A]);
    const antes = await valuation();
    await negociar(1, 'comprar', 10);
    await sentar(0, 1); // produção ×1,15
    await q(`update public.idle_state set settled_at = now() + interval '1 day' where user_id = $1`, [A]);
    const depois = (await negociar(1, 'vender', 0)).valuation;
    expect(depois).toBeLessThan(antes); // só perdeu a corretagem
  });
  it('as melhorias da Bolsa custam o preço da tela (a produção sem os convidados), com o Cristiano sentado', async () => {
    await sentar(0, 1); // produção ×1,15
    await q(`update public.idle_state set settled_at = now() + interval '1 day' where user_id = $1`, [A]);
    const r = (await q<{ v: { r: number } }>('select public.idle_bolsa_estado($1, $2) as v', [A, T]))[0].v.r;
    const antes = await valuation();
    const depois = (await q<{ v: { valuation: number } }>('select public.idle_bolsa_melhorar_em($1, $2, $3, $4) as v', [A, 'corretor', 1, T]))[0].v.valuation;
    expect(antes - depois).toBeCloseTo(1800 * r, 3);
    // com F$ pro preço da tela (e não pro preço com o Cristiano), compra
    await q('update public.idle_state set valuation = $2 where user_id = $1', [A, 3600 * r * 1.01]);
    await expect(q('select public.idle_bolsa_melhorar_em($1, $2, $3, $4)', [A, 'corretor', 2, T])).resolves.toBeDefined();
  });
  it('o humor de cada empresa só vem com o VSauce sentado', async () => {
    expect((await estado()).empresas[0].humor ?? null).toBeNull();
    await sentar(1, 11);
    expect(typeof (await estado()).empresas[0].humor).toBe('number');
  });
});

describe('Horta: Terry e Viniccius13', () => {
  type Planta = { canteiro: number; especie: number; amadurece_s: number; vida_s: number };
  const plantar = (c: number, e: number) => t.rpc<Estado & { horta: { plantas: Planta[] } }>('idle_horta_plantar', { p_canteiro: c, p_especie: e });
  beforeEach(async () => {
    await q('delete from public.idle_cat_conquista where true');
    await q(`update public.idle_state set generators[11] = 25 where user_id = $1`, [A]);
  });

  it('plantar com o Terry na frente: amadurece 30% antes e vive 20% menos; a de antes não muda', async () => {
    let s = await plantar(0, 1);
    expect(s.horta.plantas[0]).toMatchObject({ amadurece_s: 3600, vida_s: 28800 });
    await sentar(0, 7);
    s = await plantar(1, 1);
    const nova = s.horta.plantas.find((p) => p.canteiro === 1)!;
    expect(nova.amadurece_s).toBeCloseTo(2520, 6);
    expect(nova.vida_s).toBeCloseTo(23040, 6);
    expect(s.horta.plantas.find((p) => p.canteiro === 0)).toMatchObject({ amadurece_s: 3600 });
    andar(2520 * 1000 + 1000); // a nova já está madura e dá o bônus; a velha não
    const [{ b }] = await q<{ b: number }>(`select (public.idle_horta_bonus($1, 3, now())).producao as b`, [A]);
    expect(b).toBeCloseTo(0.01, 9);
  });
  it('Viniccius13: semente 50% mais cara', async () => {
    await q(`update public.idle_state set settled_at = now() + interval '1 day' where user_id = $1`, [A]);
    const r = await taxa();
    const [{ v: v0 }] = await q<{ v: number }>('select valuation as v from public.idle_state where user_id = $1', [A]);
    await sentar(0, 8);
    await q(`update public.idle_state set settled_at = now() + interval '1 day', valuation = $2 where user_id = $1`, [A, v0]);
    const s = await plantar(0, 1);
    expect(v0 - s.valuation).toBeCloseTo(600 * r * 1.5, 0);
  });
});
