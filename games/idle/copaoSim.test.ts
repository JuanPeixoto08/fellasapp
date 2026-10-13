// Simulação do copão (Task 2, spec §5): uma pessoa que abre o jogo às 9h, 14h e 21h de Brasília, todo dia, a partir de uma
// segunda. Em cada visita: recebe o que o bar vendeu até agora (a noite das 18h às 2h vende linear), fecha as noites que
// acabaram (galera, PT, noites no cardápio), vê a revelação dos copões que já estrearam, sobe de nível enquanto der (pôr
// copão é de graça: a ficha só sai no custo de cada venda) e mexe no cardápio: fora da noite troca o copão cuja novidade
// caiu abaixo de 80% (3 noites abertas) e enche as vagas livres (no meio da noite só enche; o novo estreia na noite seguinte).
// A novidade é da receita (base, mistura, extra e tamanho): um copão novo com a receita de um que já saiu começa com as
// noites abertas que os de antes venderam. A revelação (nota, pares, "aguenta") sai quando a primeira noite aberta dele
// fecha com ele no cardápio.
// Estratégias:
//  - "no chute": base, mistura, extra e tamanho aleatórios entre o liberado, força 5, preço = referência; DJ aleatório na sexta.
//  - "com caderninho": lembra os rótulos dos pares e o "aguenta" que viu, sabe o copão da moda da semana (público) e monta o
//    copão que mais vende com lucro: a nota esperada (par nunca visto vale um pouco mais que "ok") dá a fatia da noite, e a
//    base, o tamanho e o preço dão o que cada venda rende. O preço final é o inteiro válido que dá mais lucro ao cardápio
//    inteiro (o copão novo barato tira venda dos outros), com o que ela já viu das vendas: o custo-benefício que aparece na
//    revelação e o quanto o preço espanta a galera (ELASTICIDADE). Força: o ponto da base só vale como sabido depois de ver
//    o "aguenta" em duas forças diferentes; até lá testa (5 primeiro, depois outra força perto do palpite); sabido, põe no
//    ponto (ponto+1 em no máximo um copão do cardápio: o risco de PT que ela aceita). DJ: o que curte as bases do cardápio
//    (as bases de cada DJ aparecem na caixinha dele). Nunca olha tabela escondida.
//  - "no dobro" e "no barato": iguais ao caderninho, mas sempre cobram 2× a referência / 60% da referência.
//    Servem para conferir que o preço certo é o que mais rende.
//  - "repõe toda manhã": igual ao caderninho, mas na visita das 9h tira cada copão e põe de novo o mesmo (o truque de
//    tirar e repor pra zerar a novidade, que a novidade por receita desarma).
//  - "monta de novo toda manhã": igual ao caderninho, mas na visita das 9h tira o cardápio inteiro e monta outro (só
//    para comparar no log: girar as receitas é jogo, não truque).
// Sem banco: as mesmas contas puras de copao.ts e o custoNivel de mapa.ts. Sementes fixas, determinística.
//
// O lugar abre sem ficha (`moedaInicial` 0): a primeira noite paga o primeiro nível.
import { describe, expect, it } from 'vitest';

import {
  abreNoite, aguenta, ALFA, avaliar, BASES, chancePT, custoBeneficio, deuPT, DJS, ehSexta, ELASTICIDADE, EXTRAS, galeraNoite, liberado,
  lucroVenda, MISTURAS, moda, NOITE_MS, noiteIdx, noitesEntre, novidade, PONTOS, precoFaixa, precoRef, sementePT, TAMANHOS, vagas, vendasNoite,
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
/** O que o caderninho espera de um par nunca visto (entre "ok" e "boa": vale testar). */
const PAR_NOVO = 80;
/** "aguenta" esperado de uma base nunca testada (força 5). */
const AGUENTA_NOVO = 150;
/** Fora da noite, o caderninho troca o copão cuja novidade caiu abaixo disso. */
const TROCA_NOVIDADE = 0.8;
/** O dia em que se comparam as fichas das estratégias de preço. */
const DIA_FICHAS = 28;

type Estrategia = 'chute' | 'caderninho' | 'dobro' | 'barato' | 'troca' | 'repoe';
type NoBar = Copao & {
  id: number; nota: number; /** a nota que a pessoa esperava (até a revelação) */ esperada: number; primeira: number; noites: number; revelado: boolean;
  /** quando saiu do cardápio */ saiu?: number;
};
type NoiteSim = {
  inicio: number; aberta: boolean; sexta: boolean; nivel: number; cardapio: NoBar[]; lucro: number; creditado: number;
};
type Resultado = {
  nivelEm: Map<number, number>; nivelFinal: number;
  /** cada copão posto: dia, nota, as partes (sabor, custo-benefício, moda, aguenta), preço/referência, base e tamanho */
  notas: { dia: number; nota: number; partes: number[]; precoRel: number; base: number; tamanho: number }[];
  galeraNoDia: { dia: number; galera: number }[];
  noites: { dia: number; aberta: boolean; lucro: number; pt: boolean; galeraAntes: number; galeraDepois: number }[];
  /** fichas ganhas (somando as vendas) até o dia DIA_FICHAS */
  fichasAte: number;
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

const FORCAS = Array.from({ length: 10 }, (_, k) => k + 1);

/** O que a pessoa sabe dos copões que já estão no cardápio: atração esperada (nota sabida se já revelou, novidade de agora)
 *  e quanto cada pessoa que compra dele rende (o quanto o preço espanta × o lucro da venda). */
type Outros = { atr: number; atrGanho: number };
const rende = (c: Copao) => ((precoRef(c.base, c.tamanho, c.forca) / c.preco) ** ELASTICIDADE / TAMANHOS[c.tamanho - 1].doses ** ALFA) * lucroVenda(c);
const chaveReceita = (c: { base: number; mistura: number; extra: number; tamanho: number }) => `${c.base}-${c.mistura}-${c.extra}-${c.tamanho}`;

/** O lucro esperado por pessoa do movimento, pela fatia da noite de cada copão (nota esperada × novidade da receita) vezes
 *  o que ele rende: `cardapio` = do cardápio inteiro com o copão novo (o novo barato tira venda dos outros dela); senão só o
 *  do novo. */
function lucroEsperado(n0: number, c: Copao, outros: Outros, canibal: number, cardapio: boolean, nov = 1): number {
  const nota = Math.min(999, n0 + custoBeneficio(c.base, c.tamanho, c.forca, c.preco));
  const atr = (nota / 999) ** 2 * canibal * nov;
  const soma = atr + outros.atr;
  if (soma <= 0) return 0;
  return ((atr * rende(c) + (cardapio ? outros.atrGanho : 0)) / soma) * Math.min(1, soma);
}

/** O preço inteiro válido que dá mais lucro esperado. */
function melhorPreco(n0: number, c: Omit<Copao, 'preco'>, outros: Outros, canibal: number, cardapio: boolean, nov = 1): { preco: number; valor: number } {
  const [lo, hi] = precoFaixa(c.base, c.tamanho, c.forca);
  let melhor = { preco: hi, valor: -Infinity };
  for (let preco = lo; preco <= hi; preco++) {
    const valor = lucroEsperado(n0, { ...c, preco }, outros, canibal, cardapio, nov);
    if (valor > melhor.valor) melhor = { preco, valor };
  }
  return melhor;
}

/** Quanto um copão sozinho rende por pessoa do movimento, por unidade de atração (a nota sem o custo-benefício = n0, força
 *  no ponto da base), no preço que mais rende: o custo-benefício do preço entra na nota. Compara bases e tamanhos. */
function rendePorAtracao(base: number, tamanho: number, n0: number): number {
  const forca = BASES[base - 1].ponto;
  return melhorPreco(n0, { base, mistura: 1, extra: 1, tamanho, forca }, { atr: 0, atrGanho: 0 }, 1, false).valor;
}

/** `pula(dia, hora)`: a visita que a pessoa não fez. */
function simular(estrategia: Estrategia, semente: number, pula: (dia: number, h: number) => boolean = () => false): Resultado {
  const sorte = aleatorio(semente);
  const escolhe = <T,>(xs: readonly T[]): T => xs[Math.floor(sorte() * xs.length)];
  let fichas = COPAO.moedaInicial;
  let ganho = 0;
  let fichasAte = NaN;
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
  const vistos = new Map<number, { forca: number; aguenta: number }[]>(); // base → "aguenta" revelado em cada força
  /** receita → noites abertas em que um copão dela estava no cardápio (a novidade é da receita) */
  const historia = new Map<string, number>();

  /** Pontos que batem com tudo o que viu da base. */
  const candidatos = (base: number) => FORCAS.filter((p) => (vistos.get(base) ?? []).every((o) => aguenta(o.forca, p) === o.aguenta));
  /** O ponto só vale como sabido com o "aguenta" visto em duas forças diferentes e um ponto só batendo com os dois. */
  function pontoSabido(base: number): number | undefined {
    const os = vistos.get(base) ?? [];
    if (new Set(os.map((o) => o.forca)).size < 2) return undefined;
    const cs = candidatos(base);
    return cs.length === 1 ? cs[0] : undefined;
  }

  /** A revelação: rótulos e "aguenta" de quem fechou a primeira noite aberta no cardápio. */
  function revelar(c: NoBar): void {
    c.revelado = true;
    const a = avaliar(c, semanaDe(c.primeira));
    const [bm, be, me] = a.rotulos;
    pares.set(`0-${c.base}-${c.mistura}`, bm);
    pares.set(`1-${c.base}-${c.extra}`, be);
    pares.set(`2-${c.mistura}-${c.extra}`, me);
    const os = vistos.get(c.base) ?? [];
    if (!os.some((o) => o.forca === c.forca)) vistos.set(c.base, [...os, { forca: c.forca, aguenta: a.aguenta }]);
  }

  function fechar(n: NoiteSim): void {
    const antes = galera;
    let pt = false;
    if (n.aberta) {
      pt = n.cardapio.some((c) => deuPT(sementePT(c.base, c.mistura, c.extra, c.tamanho), noiteIdx(n.inicio), chancePT(c.forca, BASES[c.base - 1].ponto)));
      galera = galeraNoite(galera, n.nivel, n.cardapio.map((c) => c.nota), pt);
      for (const c of n.cardapio) {
        c.noites += 1;
        if (!c.revelado && (c.saiu === undefined || c.saiu >= n.inicio + NOITE_MS)) revelar(c);
      }
    }
    noites.push({ dia: (n.inicio - INICIO) / DIA, aberta: n.aberta, lucro: n.lucro, pt, galeraAntes: antes, galeraDepois: galera });
  }

  function creditar(t: number): void {
    for (const n of pendentes) {
      const f = Math.min(Math.max((t - n.inicio) / NOITE_MS, 0), 1);
      fichas += (f - n.creditado) * n.lucro;
      ganho += (f - n.creditado) * n.lucro;
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
      const vendas = aberta ? vendasNoite(noCardapio, { nivel, galera, sexta, dj }) : noCardapio.map(() => 0);
      if (aberta) for (const c of noCardapio) historia.set(chaveReceita(c), (historia.get(chaveReceita(c)) ?? 0) + 1);
      const lucro = vendas.reduce((soma, v, i) => soma + v * lucroVenda(noCardapio[i]), 0);
      pendentes.push({ inicio: s, aberta, sexta, nivel, cardapio: noCardapio, lucro, creditado: 0 });
      cursor = s + 1;
    }
    creditar(t);
    while (pendentes.length && pendentes[0].inicio + NOITE_MS <= t) fechar(pendentes.shift()!);
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

  /** A força para a base e o "aguenta" que a pessoa espera dela. */
  function forcaPara(base: number, arrisca: boolean): { forca: number; aguentaEsperado: number } {
    const p = pontoSabido(base);
    if (p !== undefined) {
      const forca = Math.min(10, arrisca ? p + 1 : p);
      return { forca, aguentaEsperado: aguenta(forca, p) };
    }
    const os = vistos.get(base) ?? [];
    if (!os.length) return { forca: 5, aguentaEsperado: AGUENTA_NOVO };
    // testa outra força perto do palpite (o ponto do meio entre os que ainda batem)
    const cs = candidatos(base);
    const palpite = cs[Math.floor(cs.length / 2)] ?? 5;
    const testadas = new Set(os.map((o) => o.forca));
    const forca = [arrisca ? palpite + 1 : palpite, palpite, palpite - 1, palpite + 1, palpite - 2, palpite + 2]
      .find((f) => f >= 1 && f <= 10 && !testadas.has(f)) ?? FORCAS.find((f) => !testadas.has(f))!;
    return { forca, aguentaEsperado: aguenta(forca, palpite) };
  }

  /** Atração e rendimento que a pessoa espera dos copões que já estão no cardápio (nota sabida se já revelou). */
  function atracaoOutros(): Outros {
    let atr = 0;
    let atrGanho = 0;
    for (const c of cardapio) {
      const a = ((c.revelado ? c.nota : c.esperada) / 999) ** 2 * novidade(c.noites);
      atr += a;
      atrGanho += a * rende(c);
    }
    return { atr, atrGanho };
  }

  function montar(t: number): { copao: Copao; esperada: number } {
    const tamanhos = ids(TAMANHOS, 'tamanho', nivel);
    if (estrategia === 'chute') {
      for (;;) {
        const [base, mistura, extra, tamanho] = [
          escolhe(ids(BASES, 'base', nivel)), escolhe(ids(MISTURAS, 'mistura', nivel)), escolhe(ids(EXTRAS, 'extra', nivel)), escolhe(tamanhos),
        ];
        if (repetido(base, mistura, extra, tamanho)) continue;
        return { copao: { base, mistura, extra, tamanho, forca: 5, preco: Math.round(precoRef(base, tamanho, 5)) }, esperada: 0 };
      }
    }
    const semana = semanaDe(t);
    const arrisca = !cardapio.some((c) => {
      const p = pontoSabido(c.base);
      return p !== undefined && c.forca > p;
    });
    const par = (k: string) => {
      const r = pares.get(k);
      return r === undefined ? PAR_NOVO : PONTOS[r];
    };
    const outros = atracaoOutros();
    // 1) a nota esperada (sem o custo-benefício, que vem do preço) de cada combinação
    const combos: { base: number; mistura: number; extra: number; n0: number }[] = [];
    const forcas = new Map<number, { forca: number; aguentaEsperado: number }>();
    for (const base of ids(BASES, 'base', nivel)) {
      const f = forcaPara(base, arrisca);
      forcas.set(base, f);
      for (const mistura of ids(MISTURAS, 'mistura', nivel)) {
        for (const extra of ids(EXTRAS, 'extra', nivel)) {
          const n0 = par(`0-${base}-${mistura}`) + par(`1-${base}-${extra}`) + par(`2-${mistura}-${extra}`)
            + f.aguentaEsperado + moda(base, mistura, semana);
          combos.push({ base, mistura, extra, n0 });
        }
      }
    }
    // 2) por base, o tamanho e o preço em que um copão dela mais vende com lucro (com a melhor nota esperada da base)
    const planos = new Map<number, { tamanho: number; preco: number }>();
    for (const [base, f] of forcas) {
      const n0 = Math.max(...combos.filter((c) => c.base === base).map((c) => c.n0));
      let melhor = { tamanho: tamanhos[0], preco: 0, valor: -Infinity };
      for (const tamanho of tamanhos) {
        const m = melhorPreco(n0, { base, mistura: 1, extra: 1, tamanho, forca: f.forca }, outros, 1, false);
        if (m.valor > melhor.valor) melhor = { tamanho, ...m };
      }
      planos.set(base, melhor);
    }
    // 3) a combinação que mais vende com lucro (nota boa, base que rende e receita ainda nova), e o preço que dá mais lucro
    //    ao cardápio inteiro
    let escolhido: { c: Copao; n0: number; canibal: number; nov: number } | null = null;
    let melhorV = -Infinity;
    for (const { base, mistura, extra, n0 } of combos) {
      const { tamanho, preco } = planos.get(base)!;
      if (repetido(base, mistura, extra, tamanho)) continue;
      const canibal = cardapio.some((c) => c.base === base && c.mistura === mistura) ? 0.7 : 1;
      const c = { base, mistura, extra, tamanho, forca: forcas.get(base)!.forca, preco };
      const nov = novidade(historia.get(chaveReceita(c)) ?? 0);
      const v = lucroEsperado(n0, c, outros, canibal, false, nov) * (1 + sorte() * 0.01);
      if (v > melhorV) [escolhido, melhorV] = [{ c, n0, canibal, nov }, v];
    }
    if (escolhido) {
      const { c, n0, canibal, nov } = escolhido;
      const [lo, hi] = precoFaixa(c.base, c.tamanho, c.forca);
      const preco = estrategia === 'dobro' ? hi
        : estrategia === 'barato' ? Math.min(hi, Math.max(lo, Math.ceil(0.6 * precoRef(c.base, c.tamanho, c.forca))))
          : melhorPreco(n0, c, outros, canibal, true, nov).preco;
      return { copao: { ...c, preco }, esperada: Math.min(999, n0 + custoBeneficio(c.base, c.tamanho, c.forca, preco)) };
    }
    throw new Error('sem copão para pôr');
  }

  function por(t: number): void {
    const { copao: c, esperada } = montar(t);
    const primeira = primeiraNoite(t);
    const a = avaliar(c, semanaDe(t));
    // a novidade é da receita: começa com as noites abertas que os copões de antes com ela venderam
    cardapio.push({ ...c, id: proximoId++, nota: a.nota, esperada, primeira, noites: historia.get(chaveReceita(c)) ?? 0, revelado: false });
    notas.push({
      dia: (t - INICIO) / DIA, nota: a.nota, partes: [a.sabor, a.custoBeneficio, a.moda, a.aguenta], precoRel: c.preco / precoRef(c.base, c.tamanho, c.forca),
      base: c.base, tamanho: c.tamanho,
    });
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
      const manha = new Date(t - 3 * H).getUTCHours() === 9;
      // "repõe toda manhã": tira cada copão e põe o mesmo de novo (a nota sai de novo, com a moda desta semana)
      if (estrategia === 'repoe' && manha) {
        for (const [i, c] of [...cardapio.entries()]) {
          c.saiu = t;
          const a = avaliar(c, semanaDe(t));
          cardapio[i] = {
            ...c, id: proximoId++, nota: a.nota, esperada: c.revelado ? a.nota : c.esperada, primeira: primeiraNoite(t),
            noites: historia.get(chaveReceita(c)) ?? 0, revelado: false, saiu: undefined,
          };
        }
      }
      // "monta de novo toda manhã": tira tudo
      const tudo = estrategia === 'troca' && manha;
      for (let i = cardapio.length - 1; i >= 0; i--) {
        // a idade da receita (fora da noite é igual às noites do copão; quem repõe decide pela receita, como o caderninho)
        if (tudo || novidade(historia.get(chaveReceita(cardapio[i])) ?? 0) < TROCA_NOVIDADE) cardapio.splice(i, 1)[0].saiu = t;
      }
    }
    while (cardapio.length < vagas(nivel)) por(t);
    if (!noMeioDaNoite) escolherDj(t);
  }

  for (let dia = 0; dia < DIAS; dia++) {
    for (const h of VISITAS) {
      if (pula(dia, h)) continue;
      const t = INICIO + dia * DIA + h * H;
      avancar(t);
      if (Number.isNaN(fichasAte) && t >= INICIO + DIA_FICHAS * DIA) fichasAte = ganho;
      subir(t);
      mexer(t);
      visto = t;
      galeraNoDia.push({ dia: (t - INICIO) / DIA, galera });
    }
  }
  return { nivelEm, notas, nivelFinal: nivel, galeraNoDia, noites, fichasAte };
}

const media = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(xs.length, 1);
const mediaEntre = (r: Resultado, de: number, ate: number) => media(r.notas.filter((n) => n.dia >= de && n.dia < ate).map((n) => n.nota));
const SEMENTES = Array.from({ length: 16 }, (_, k) => k + 1);
const LIMIAR_GALERA = MARCOS.find((m) => m.id === 47)!.valor!;
const diaDaGalera = (r: Resultado) => r.galeraNoDia.find((g) => g.galera >= LIMIAR_GALERA)?.dia ?? Infinity;

/** Dia em que cada estratégia é comparada pelas escolhas (tamanho e base) do caderninho. */
const DIA_ESCOLHAS = 14;
/** A nota sem o custo-benefício de um copão típico do caderninho depois do dia 14 (sabor ~310, moda ~50, aguenta ~170). */
const N0_TIPICO = 530;

describe('balanceamento do copão (simulação)', () => {
  const caderninho = SEMENTES.map((s) => simular('caderninho', s));
  const chute = SEMENTES.map((s) => simular('chute', s));
  const dobro = SEMENTES.map((s) => simular('dobro', s));
  const barato = SEMENTES.map((s) => simular('barato', s));
  const troca = SEMENTES.map((s) => simular('troca', s));
  const repoe = SEMENTES.map((s) => simular('repoe', s));

  if (process.env.SIM_LOG) {
    for (const [nome, rs] of [['caderninho', caderninho], ['chute', chute], ['dobro', dobro], ['barato', barato], ['troca', troca], ['repoe', repoe]] as const) {
      for (const [k, r] of rs.entries()) {
        const semanas = Array.from({ length: 8 }, (_, w) => mediaEntre(r, 7 * w, 7 * w + 7).toFixed(0)).join(' ');
        const g = (d: number) => r.galeraNoDia.find((x) => x.dia >= d)?.galera.toFixed(0);
        const pts = r.noites.filter((n) => n.pt).length;
        console.log(`${nome} s${SEMENTES[k]}: n5 ${r.nivelEm.get(5)?.toFixed(1)} n10 ${r.nivelEm.get(10)?.toFixed(1)} n15 ${r.nivelEm.get(15)?.toFixed(1)} n20 ${r.nivelEm.get(20)?.toFixed(1)} n25 ${r.nivelEm.get(25)?.toFixed(1)} final ${r.nivelFinal} | notas ${semanas} | tudo ${mediaEntre(r, 0, 49).toFixed(0)} 14+ ${mediaEntre(r, 14, 49).toFixed(0)} | galera d14 ${g(14)} d28 ${g(28)} d42 ${g(42)} marco ${diaDaGalera(r).toFixed(1)} | PT ${pts} | fichas d${DIA_FICHAS} ${r.fichasAte.toFixed(0)} | menor lucro ${Math.min(...r.noites.filter((n) => n.aberta).map((n) => n.lucro)).toFixed(0)}`);
      }
    }
    const partes = caderninho.flatMap((r) => r.notas.filter((n) => n.dia >= 14 && n.dia < 49));
    console.log(`caderninho 14+: sabor/cb/moda/aguenta ${[0, 1, 2, 3].map((k) => media(partes.map((p) => p.partes[k])).toFixed(0)).join('/')}`
      + ` preço/ref ${media(partes.map((p) => p.precoRel)).toFixed(2)} (${Math.min(...partes.map((p) => p.precoRel)).toFixed(2)}–${Math.max(...partes.map((p) => p.precoRel)).toFixed(2)})`);
    const faixa = (xs: number[]) => `${Math.min(...xs).toFixed(1)}–${Math.max(...xs).toFixed(1)}`;
    const dias = caderninho.map(diaDaGalera).sort((a, b) => a - b);
    const fichas = (rs: Resultado[]) => media(rs.map((r) => r.fichasAte)).toFixed(0);
    console.log(`resumo: caderninho n10 ${faixa(caderninho.map((r) => r.nivelEm.get(10)!))} n25 ${faixa(caderninho.map((r) => r.nivelEm.get(NIVEL_MAX) ?? Infinity))}`
      + ` nota 14+ ${media(caderninho.map((r) => mediaEntre(r, 14, 49))).toFixed(0)} marco de galera (mediana) dia ${((dias[7] + dias[8]) / 2).toFixed(1)}`
      + ` | chute nota ${media(chute.map((r) => mediaEntre(r, 0, 49))).toFixed(0)} n10 ${faixa(chute.map((r) => r.nivelEm.get(10) ?? Infinity))} n25 ${faixa(chute.map((r) => r.nivelEm.get(NIVEL_MAX) ?? Infinity))}`
      + ` | fichas d${DIA_FICHAS}: caderninho ${fichas(caderninho)} dobro ${fichas(dobro)} barato ${fichas(barato)} repõe ${fichas(repoe)} monta de novo ${fichas(troca)} chute ${fichas(chute)}`
      + ` | barato perde em ${barato.filter((r, k) => r.fichasAte < caderninho[k].fichasAte).length}/16, repõe não ganha em ${repoe.filter((r, k) => r.fichasAte <= caderninho[k].fichasAte).length}/16`
      + `, monta de novo não ganha em ${troca.filter((r, k) => r.fichasAte <= caderninho[k].fichasAte).length}/16`);
    const escolhas = caderninho.flatMap((r) => r.notas.filter((n) => n.dia >= DIA_ESCOLHAS));
    const pct = (f: (n: (typeof escolhas)[number]) => boolean) => `${((100 * escolhas.filter(f).length) / escolhas.length).toFixed(0)}%`;
    console.log(`escolhas do caderninho depois do dia ${DIA_ESCOLHAS}: tamanhos ${TAMANHOS.map((t) => `${t.nome} ${pct((n) => n.tamanho === t.id)}`).join(' ')}`
      + ` | bases ${BASES.map((b) => `${b.id}:${pct((n) => n.base === b.id)}`).join(' ')}`
      + ` | preço/ref por base ${BASES.map((b) => `${b.id}:${media(escolhas.filter((n) => n.base === b.id).map((n) => n.precoRel)).toFixed(2)}`).join(' ')}`);
    for (const t of TAMANHOS) {
      const vs = BASES.map((b) => rendePorAtracao(b.id, t.id, N0_TIPICO));
      console.log(`rende por atração (n0 ${N0_TIPICO}), ${t.nome}: ${vs.map((v, k) => `${k + 1}:${(v / Math.max(...vs)).toFixed(2)}`).join(' ')}`);
    }
    console.log(`tamanhos por atração (Vodka): ${TAMANHOS.map((t) => rendePorAtracao(1, t.id, N0_TIPICO).toFixed(2)).join('/')}`);
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

  it('com caderninho: nota média 700 ou mais depois de 14 dias', () => {
    expect(media(caderninho.map((r) => mediaEntre(r, 14, 49)))).toBeGreaterThanOrEqual(700);
  });

  // O preço certo é o que mais rende: cobrar sempre o dobro (nota baixa e a galera foge do preço) rende bem menos fichas até
  // o dia 28 que o preço do caderninho, em cada semente.
  it('cobrar sempre o dobro da referência rende menos que o preço do caderninho até o dia 28', () => {
    for (const [k, r] of dobro.entries()) expect(r.fichasAte).toBeLessThanOrEqual(caderninho[k].fichasAte);
  });

  // 60% fica perto do topo nas bases baratas (o melhor preço delas é ~0,6× a referência): rende menos na maioria das
  // sementes, não em todas.
  it('cobrar sempre 60% da referência rende menos que o preço do caderninho até o dia 28 (na maioria das sementes)', () => {
    expect(barato.filter((r, k) => r.fichasAte < caderninho[k].fichasAte).length).toBeGreaterThan(SEMENTES.length / 2);
  });

  // Tirar e repor pra zerar a novidade não funciona: a novidade é da receita (com a novidade por copão, repor toda manhã
  // deixava a novidade sempre em 100%).
  it('tirar e repor o mesmo copão toda manhã não rende mais que o caderninho até o dia 28', () => {
    expect(repoe.filter((r, k) => r.fichasAte <= caderninho[k].fichasAte).length).toBeGreaterThan(SEMENTES.length / 2);
    expect(media(repoe.map((r) => r.fichasAte))).toBeLessThanOrEqual(media(caderninho.map((r) => r.fichasAte)));
  });

  // Nenhum tamanho é sempre pior: ou o caderninho escolhe ele em 10% das vezes depois do dia 14, ou ele rende pelo menos 70%
  // do melhor tamanho por unidade de atração, com cada base no preço que mais rende.
  it('nenhum tamanho dominado', () => {
    const escolhas = caderninho.flatMap((r) => r.notas.filter((n) => n.dia >= DIA_ESCOLHAS));
    for (const t of TAMANHOS) {
      if (escolhas.filter((n) => n.tamanho === t.id).length >= 0.1 * escolhas.length) continue;
      for (const b of BASES) {
        const vs = TAMANHOS.map((x) => rendePorAtracao(b.id, x.id, N0_TIPICO));
        expect(vs[t.id - 1], `${t.nome} de ${b.nome}`).toBeGreaterThanOrEqual(0.7 * Math.max(...vs));
      }
    }
  });

  // Nenhuma base é sempre pior: em cada tamanho, toda base rende pelo menos 60% da melhor por unidade de atração (no ponto
  // dela, no preço que mais rende; base cara tem referência maior). Vale para copão fraco, típico e bom.
  it('nenhuma base dominada', () => {
    for (const n0 of [400, N0_TIPICO, 650]) {
      for (const t of TAMANHOS) {
        const vs = BASES.map((b) => rendePorAtracao(b.id, t.id, n0));
        for (const [k, v] of vs.entries()) expect(v, `${BASES[k].nome} em ${t.nome}, n0 ${n0}`).toBeGreaterThanOrEqual(0.6 * Math.max(...vs));
      }
    }
  });

  // O preço que mais rende fica perto da referência em toda base (nenhuma pede o dobro). Embaixo não precisa de trava: a
  // faixa válida já começa em 0,5× a referência.
  it('o melhor preço de cada base fica até 1,3× a referência', () => {
    for (const b of BASES) for (const t of TAMANHOS) {
      const forca = b.ponto;
      const { preco } = melhorPreco(N0_TIPICO, { base: b.id, mistura: 1, extra: 1, tamanho: t.id, forca }, { atr: 0, atrGanho: 0 }, 1, false);
      const rel = preco / precoRef(b.id, t.id, forca);
      expect(rel, `${t.nome} de ${b.nome}`).toBeLessThanOrEqual(1.3);
    }
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
