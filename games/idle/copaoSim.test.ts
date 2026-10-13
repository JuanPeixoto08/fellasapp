// Simulação do copão (Task 2, spec §5): uma pessoa que abre o jogo às 9h, 14h e 21h de Brasília, todo dia, a partir de uma
// segunda. Em cada visita: recebe o que o bar vendeu até agora (a noite das 18h às 2h vende linear), fecha as noites que
// acabaram (galera, PT, noites no cardápio), vê a revelação dos copões que já estrearam, sobe de nível enquanto der (pôr
// copão é de graça: a ficha só sai no custo de cada venda) e mexe no cardápio: fora da noite troca o copão cuja novidade
// caiu abaixo de 50% (6 noites abertas) e enche as vagas livres (no meio da noite só enche; o novo estreia na noite seguinte).
// Duas estratégias:
//  - "no chute": base, mistura, extra e tamanho aleatórios entre o liberado, força 5, preço = referência; DJ aleatório na sexta.
//  - "com caderninho": lembra os rótulos dos pares e o "aguenta" que viu (e daí o ponto de cada base), sabe o copão da moda
//    da semana (público); monta o copão de maior nota esperada (par nunca visto vale um pouco mais que "ok"), no maior
//    tamanho, força no ponto (ponto+1 em no máximo um copão do cardápio: o risco de PT que ela aceita), preço a 60% da
//    referência (sem nunca vender no prejuízo) e o DJ cujas bases estão no cardápio (as bases de cada DJ aparecem na caixinha
//    dele). Nunca olha tabela escondida: o ponto sai do "aguenta" revelado e os rótulos só depois da primeira noite.
// Sem banco: as mesmas contas puras de copao.ts e o custoNivel de mapa.ts. Sementes fixas, determinística.
//
// O lugar abre sem ficha (`moedaInicial` 0): a primeira noite paga o primeiro nível.
import { describe, expect, it } from 'vitest';

import {
  abreNoite, aguenta, avaliar, BASES, chancePT, deuPT, DJS, ehSexta, EXTRAS, galeraNoite, liberado, lucroVenda, MISTURAS, moda,
  NOITE_MS, noiteIdx, noitesEntre, novidade, PONTOS, precoFaixa, precoRef, TAMANHOS, vagas, vendasNoite,
  type Copao, type Rotulo,
} from './copao';
import { custoNivel, LUGARES, MARCOS, NIVEL_MAX } from './mapa';

const H = 3600_000;
const DIA = 24 * H;
/** Segunda, 12/10/2026, 00h de Brasília (UTC−3). */
const INICIO = Date.UTC(2026, 9, 12, 3);
const VISITAS = [9, 14, 21];
const DIAS = 56;
const COPAO = LUGARES[3];
/** O caderninho cobra 60% da referência (custo-benefício 233) e nunca abaixo do custo + 1. */
const FATOR_PRECO = 0.6;
/** O que o caderninho espera de um par nunca visto (entre "ok" e "boa": vale testar). */
const PAR_NOVO = 80;
/** "aguenta" esperado de uma base cujo ponto ainda não sabe (força 5). */
const AGUENTA_NOVO = 150;
/** Quanto o caderninho desconta de um copão com a mesma base e mistura de outro do cardápio (vende 30% menos, a nota é a mesma). */
const CANIBAL = 20;

type Estrategia = 'chute' | 'caderninho';
type NoBar = Copao & { id: number; nota: number; primeira: number; noites: number; revelado: boolean };
type NoiteSim = {
  inicio: number; aberta: boolean; sexta: boolean; nivel: number; cardapio: NoBar[]; lucro: number; creditado: number;
};
type Resultado = {
  nivelEm: Map<number, number>; nivelFinal: number;
  /** cada copão posto: dia, nota e as partes (sabor, custo-benefício, moda, aguenta) */
  notas: { dia: number; nota: number; partes: number[] }[];
  galeraNoDia: { dia: number; galera: number }[];
  noites: { dia: number; aberta: boolean; lucro: number; pt: boolean; galeraAntes: number; galeraDepois: number }[];
};

/** mulberry32: aleatório com semente. */
function aleatorio(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A segunda 'YYYY-MM-DD' (Brasília) da semana do instante. */
function semanaDe(t: number): string {
  const dia = Math.floor((t - 3 * H) / DIA);
  const dow = (new Date(dia * DIA).getUTCDay() + 6) % 7;
  return new Date((dia - dow) * DIA).toISOString().slice(0, 10);
}

/** Início da primeira noite que começa em `t` ou depois (o copão posto estreia nela). */
const primeiraNoite = (t: number): number => noitesEntre(t, t + DIA + 1)[0];

const ids = (lista: readonly { id: number }[], tipo: 'base' | 'mistura' | 'extra' | 'tamanho' | 'dj', nivel: number): number[] =>
  lista.filter((x) => liberado(tipo, x.id, nivel)).map((x) => x.id);

/** `pula(dia, hora)`: a visita que a pessoa não fez. */
function simular(estrategia: Estrategia, semente: number, pula: (dia: number, h: number) => boolean = () => false): Resultado {
  const sorte = aleatorio(semente);
  const escolhe = <T,>(xs: readonly T[]): T => xs[Math.floor(sorte() * xs.length)];
  let fichas = COPAO.moedaInicial;
  let nivel = 1;
  let galera = 0;
  let dj: number | null = null;
  let visto: number | null = null;
  let proximoId = semente * 1000 + 1;
  let cursor = INICIO; // próxima noite a abrir: início ≥ cursor
  const cardapio: NoBar[] = [];
  const pendentes: NoiteSim[] = [];
  const nivelEm = new Map<number, number>([[1, 0]]);
  const notas: Resultado['notas'] = [];
  const galeraNoDia: { dia: number; galera: number }[] = [];
  const noites: Resultado['noites'] = [];
  // caderninho
  const pares = new Map<string, Rotulo>(); // "tipo-a-b" → rótulo
  const ponto = new Map<number, number>(); // base → ponto (tirado do "aguenta" revelado)

  function fechar(n: NoiteSim): void {
    const antes = galera;
    let pt = false;
    if (n.aberta) {
      pt = n.cardapio.some((c) => deuPT(c.id, noiteIdx(n.inicio), chancePT(c.forca, BASES[c.base - 1].ponto)));
      galera = galeraNoite(galera, n.nivel, n.cardapio.map((c) => c.nota), pt);
      for (const c of n.cardapio) c.noites += 1;
    }
    noites.push({ dia: (n.inicio - INICIO) / DIA, aberta: n.aberta, lucro: n.lucro, pt, galeraAntes: antes, galeraDepois: galera });
  }

  function creditar(t: number): void {
    for (const n of pendentes) {
      const f = Math.min(Math.max((t - n.inicio) / NOITE_MS, 0), 1);
      fichas += (f - n.creditado) * n.lucro;
      n.creditado = f;
    }
  }

  function avancar(t: number): void {
    for (const s of noitesEntre(cursor, t + 1)) {
      // antes de abrir a noite, fecha as que acabaram (a galera da noite anterior entra no movimento desta)
      creditar(s);
      while (pendentes.length && pendentes[0].inicio + NOITE_MS <= s) fechar(pendentes.shift()!);
      const aberta = abreNoite(s, visto);
      const noCardapio = cardapio.filter((c) => c.primeira <= s);
      const sexta = ehSexta(s);
      const vendas = aberta
        ? vendasNoite(noCardapio.map((c) => ({ base: c.base, mistura: c.mistura, nota: c.nota, noites: c.noites })), { nivel, galera, sexta, dj })
        : noCardapio.map(() => 0);
      const lucro = vendas.reduce((soma, v, i) => soma + v * lucroVenda(noCardapio[i]), 0);
      pendentes.push({ inicio: s, aberta, sexta, nivel, cardapio: noCardapio, lucro, creditado: 0 });
      cursor = s + 1;
    }
    creditar(t);
    while (pendentes.length && pendentes[0].inicio + NOITE_MS <= t) fechar(pendentes.shift()!);
    // a revelação: rótulos e "aguenta" de quem já estreou
    for (const c of cardapio) {
      if (c.revelado || c.primeira > t) continue;
      c.revelado = true;
      const a = avaliar(c, semanaDe(c.primeira));
      const [bm, be, me] = a.rotulos;
      pares.set(`0-${c.base}-${c.mistura}`, bm);
      pares.set(`1-${c.base}-${c.extra}`, be);
      pares.set(`2-${c.mistura}-${c.extra}`, me);
      // o "aguenta" revelado diz a distância até o ponto (199 = um acima, 170 = no ponto, 140 = um abaixo, e cada valor mais
      // longe é de uma distância só); se mais de um ponto daria o mesmo número, fica sem saber
      const possiveis = Array.from({ length: 10 }, (_, k) => k + 1).filter((p) => aguenta(c.forca, p) === a.aguenta);
      if (possiveis.length === 1) ponto.set(c.base, possiveis[0]);
    }
  }

  function subir(t: number): void {
    for (;;) {
      const custo = custoNivel(COPAO, nivel);
      if (custo === null || fichas < custo) return;
      fichas -= custo;
      nivel += 1;
      nivelEm.set(nivel, (t - INICIO) / DIA);
    }
  }

  const repetido = (b: number, m: number, e: number, tam: number) =>
    cardapio.some((c) => c.base === b && c.mistura === m && c.extra === e && c.tamanho === tam);

  function montar(t: number): Copao {
    const tamanhos = ids(TAMANHOS, 'tamanho', nivel);
    if (estrategia === 'chute') {
      for (;;) {
        const [base, mistura, extra, tamanho] = [
          escolhe(ids(BASES, 'base', nivel)), escolhe(ids(MISTURAS, 'mistura', nivel)), escolhe(ids(EXTRAS, 'extra', nivel)), escolhe(tamanhos),
        ];
        if (repetido(base, mistura, extra, tamanho)) continue;
        return { base, mistura, extra, tamanho, forca: 5, preco: Math.round(precoRef(tamanho, 5)) };
      }
    }
    const tamanho = Math.max(...tamanhos);
    const semana = semanaDe(t);
    const arrisca = !cardapio.some((c) => ponto.has(c.base) && c.forca > ponto.get(c.base)!);
    const par = (k: string) => {
      const r = pares.get(k);
      return r === undefined ? PAR_NOVO : PONTOS[r];
    };
    let melhor: Copao | null = null;
    let melhorV = -Infinity;
    for (const base of ids(BASES, 'base', nivel)) {
      const p = ponto.get(base);
      const forca = p === undefined ? 5 : Math.min(10, Math.max(1, arrisca ? p + 1 : p));
      const aguentaEsperado = p === undefined ? AGUENTA_NOVO : forca > p ? 199 : 170;
      const [lo, hi] = precoFaixa(tamanho, forca);
      const custo = lucroVenda({ base, tamanho, forca, preco: 0 }) * -1;
      const preco = Math.min(hi, Math.max(lo, Math.ceil(FATOR_PRECO * precoRef(tamanho, forca)), Math.floor(custo) + 1));
      for (const mistura of ids(MISTURAS, 'mistura', nivel)) {
        const canibal = cardapio.some((c) => c.base === base && c.mistura === mistura) ? CANIBAL : 0;
        for (const extra of ids(EXTRAS, 'extra', nivel)) {
          if (repetido(base, mistura, extra, tamanho)) continue;
          const v = par(`0-${base}-${mistura}`) + par(`1-${base}-${extra}`) + par(`2-${mistura}-${extra}`)
            + aguentaEsperado + moda(base, mistura, semana) - canibal + sorte() * 2;
          if (v > melhorV) [melhor, melhorV] = [{ base, mistura, extra, tamanho, forca, preco }, v];
        }
      }
    }
    return melhor!;
  }

  function por(t: number): void {
    const c = montar(t);
    const primeira = primeiraNoite(t);
    const a = avaliar(c, semanaDe(t));
    cardapio.push({ ...c, id: proximoId++, nota: a.nota, primeira, noites: 0, revelado: false });
    notas.push({ dia: (t - INICIO) / DIA, nota: a.nota, partes: [a.sabor, a.custoBeneficio, a.moda, a.aguenta] });
  }

  function escolherDj(t: number): void {
    const djs = ids(DJS, 'dj', nivel);
    if (estrategia === 'chute') {
      if (ehSexta(primeiraNoite(t)) && new Date(t - 3 * H).getUTCHours() === 9) dj = escolhe(djs);
      return;
    }
    const valor = (d: number) => cardapio
      .filter((c) => DJS[d - 1].bases.includes(c.base))
      .reduce((s, c) => s + lucroVenda(c) * novidade(c.noites), 0);
    dj = djs.reduce((a, b) => (valor(b) > valor(a) ? b : a));
  }

  function mexer(t: number): void {
    const noMeioDaNoite = pendentes.some((n) => t < n.inicio + NOITE_MS);
    if (!noMeioDaNoite) {
      for (let i = cardapio.length - 1; i >= 0; i--) if (novidade(cardapio[i].noites) < 0.5) cardapio.splice(i, 1);
    }
    while (cardapio.length < vagas(nivel)) por(t);
    if (!noMeioDaNoite) escolherDj(t);
  }

  for (let dia = 0; dia < DIAS; dia++) {
    for (const h of VISITAS) {
      if (pula(dia, h)) continue;
      const t = INICIO + dia * DIA + h * H;
      avancar(t);
      subir(t);
      mexer(t);
      visto = t;
      galeraNoDia.push({ dia: (t - INICIO) / DIA, galera });
    }
  }
  return { nivelEm, notas, nivelFinal: nivel, galeraNoDia, noites };
}

const media = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(xs.length, 1);
const mediaEntre = (r: Resultado, de: number, ate: number) => media(r.notas.filter((n) => n.dia >= de && n.dia < ate).map((n) => n.nota));
const SEMENTES = Array.from({ length: 16 }, (_, k) => k + 1);
const LIMIAR_GALERA = MARCOS.find((m) => m.id === 47)!.valor!;
const diaDaGalera = (r: Resultado) => r.galeraNoDia.find((g) => g.galera >= LIMIAR_GALERA)?.dia ?? Infinity;

describe('balanceamento do copão (simulação)', () => {
  const caderninho = SEMENTES.map((s) => simular('caderninho', s));
  const chute = SEMENTES.map((s) => simular('chute', s));

  if (process.env.SIM_LOG) {
    for (const [nome, rs] of [['caderninho', caderninho], ['chute', chute]] as const) {
      for (const [k, r] of rs.entries()) {
        const semanas = Array.from({ length: 8 }, (_, w) => mediaEntre(r, 7 * w, 7 * w + 7).toFixed(0)).join(' ');
        const g = (d: number) => r.galeraNoDia.find((x) => x.dia >= d)?.galera.toFixed(0);
        const pts = r.noites.filter((n) => n.pt).length;
        console.log(`${nome} s${SEMENTES[k]}: n5 ${r.nivelEm.get(5)?.toFixed(1)} n10 ${r.nivelEm.get(10)?.toFixed(1)} n15 ${r.nivelEm.get(15)?.toFixed(1)} n20 ${r.nivelEm.get(20)?.toFixed(1)} n25 ${r.nivelEm.get(25)?.toFixed(1)} final ${r.nivelFinal} | notas ${semanas} | tudo ${mediaEntre(r, 0, 49).toFixed(0)} 14+ ${mediaEntre(r, 14, 49).toFixed(0)} | galera d14 ${g(14)} d28 ${g(28)} d42 ${g(42)} marco ${diaDaGalera(r).toFixed(1)} | PT ${pts} | menor lucro ${Math.min(...r.noites.filter((n) => n.aberta).map((n) => n.lucro)).toFixed(0)}`);
      }
    }
    const partes = caderninho.flatMap((r) => r.notas.filter((n) => n.dia >= 14 && n.dia < 49).map((n) => n.partes));
    console.log(`caderninho 14+: sabor/cb/moda/aguenta ${[0, 1, 2, 3].map((k) => media(partes.map((p) => p[k])).toFixed(0)).join('/')}`);
    const faixa = (xs: number[]) => `${Math.min(...xs).toFixed(1)}–${Math.max(...xs).toFixed(1)}`;
    const dias = caderninho.map(diaDaGalera).sort((a, b) => a - b);
    console.log(`resumo: caderninho n10 ${faixa(caderninho.map((r) => r.nivelEm.get(10)!))} n25 ${faixa(caderninho.map((r) => r.nivelEm.get(NIVEL_MAX) ?? Infinity))}`
      + ` nota 14+ ${media(caderninho.map((r) => mediaEntre(r, 14, 49))).toFixed(0)} marco de galera (mediana) dia ${((dias[7] + dias[8]) / 2).toFixed(1)}`
      + ` | chute nota ${media(chute.map((r) => mediaEntre(r, 0, 49))).toFixed(0)} n10 ${faixa(chute.map((r) => r.nivelEm.get(10) ?? Infinity))} n25 ${faixa(chute.map((r) => r.nivelEm.get(NIVEL_MAX) ?? Infinity))}`);
  }

  it('com caderninho: nível 10 entre o dia 5 e o 9', () => {
    for (const r of caderninho) {
      expect(r.nivelEm.get(10)).toBeGreaterThanOrEqual(5);
      expect(r.nivelEm.get(10)).toBeLessThanOrEqual(9);
    }
  });

  it('com caderninho: nível 25 entre o dia 35 e o 49', () => {
    for (const r of caderninho) {
      expect(r.nivelEm.get(NIVEL_MAX)).toBeGreaterThanOrEqual(35);
      expect(r.nivelEm.get(NIVEL_MAX)).toBeLessThanOrEqual(49);
    }
  });

  // A nota média é da população (média das sementes).
  it('no chute: nota média entre 350 e 550', () => {
    const m = media(chute.map((r) => mediaEntre(r, 0, 49)));
    expect(m).toBeGreaterThanOrEqual(350);
    expect(m).toBeLessThanOrEqual(550);
  });

  it('com caderninho: nota média 750 ou mais depois de 14 dias', () => {
    expect(media(caderninho.map((r) => mediaEntre(r, 14, 49)))).toBeGreaterThanOrEqual(750);
  });

  it('com caderninho: nenhuma noite com lucro negativo', () => {
    for (const r of caderninho) for (const n of r.noites) expect(n.lucro).toBeGreaterThanOrEqual(0);
  });

  // Marco de galera do copão (id 47): calibrado para a mediana do caderninho chegar por volta do dia 28.
  it('com caderninho: o marco de galera chega por volta do dia 28 (mediana entre 25 e 31)', () => {
    const dias = caderninho.map(diaDaGalera).sort((a, b) => a - b);
    const mediana = (dias[7] + dias[8]) / 2;
    expect(mediana).toBeGreaterThanOrEqual(25);
    expect(mediana).toBeLessThanOrEqual(31);
  });

  it('visitando 9h, 14h e 21h, toda noite abre', () => {
    for (const r of [...caderninho, ...chute]) expect(r.noites.every((n) => n.aberta)).toBe(true);
  });

  // Sem a visita das 21h do dia 9 e sem nenhuma no dia 10: a noite do dia 9 abre (visita das 14h), a do dia 10 não
  // (ninguém passou desde as 18h do dia 9), a do dia 11 abre de novo (visita das 9h).
  it('quem some um dia: só a noite sem visita desde a anterior fica fechada (sem venda, galera parada)', () => {
    for (const s of SEMENTES.slice(0, 4)) {
      const r = simular('caderninho', s, (dia, h) => dia === 10 || (dia === 9 && h === 21));
      const fechadas = r.noites.filter((n) => !n.aberta);
      expect(fechadas.map((n) => Math.floor(n.dia))).toEqual([10]);
      expect(fechadas[0].lucro).toBe(0);
      expect(fechadas[0].galeraDepois).toBe(fechadas[0].galeraAntes);
      expect(r.noites.find((n) => Math.floor(n.dia) === 9)!.aberta).toBe(true);
      expect(r.noites.find((n) => Math.floor(n.dia) === 11)!.aberta).toBe(true);
    }
  });
});
