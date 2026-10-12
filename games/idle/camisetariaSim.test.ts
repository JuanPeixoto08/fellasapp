// Simulação da camisetaria (Task 2, spec §9): uma pessoa que abre o jogo às 9h, 14h e 21h de Brasília, todo dia, a partir
// de uma segunda. Em cada visita: recebe o que vendeu (e os fãs), sobe de nível enquanto der guardando cupom pro próximo
// lote médio de camiseta, e lança uma coleção se não tiver nenhuma rodando (médio se der, senão pequeno). Duas estratégias:
// "no chute" (tudo aleatório entre o liberado, foco 4/3/3, peça e cor aleatórias) e "com caderninho" (lembra rótulos e
// peça × tema que viu, repete a melhor combinação conhecida fugindo das 3 últimas, cor forte, compra relatório quando sobra).
// Sem banco: as mesmas contas puras de camisetaria.ts e o custoNivel de mapa.ts. Sementes fixas, determinística.
//
// O lugar abre com `moedaInicial` (108 cupons, 1 lote médio de camiseta no nível 1) e, sem cupom nem coleção rodando,
// o fornecedor fia um lote pequeno por dia (`podeFiar`).
import { describe, expect, it } from 'vitest';

import {
  CORES, custoLote, ESTILOS, fasExcesso, fasNota, liberado, notas, PECAS, pecasLote, pecaTema, pctProcura, podeFiar, precoPeca,
  precoRelatorio, procura, producaoMs, rotulo, TEMAS, tendencia, VENDA_MS, vendidoAte, type Lancamento,
} from './camisetaria';
import { custoNivel, LUGARES, MARCOS, NIVEL_MAX } from './mapa';

const H = 3600_000;
const DIA = 24 * H;
/** Segunda, 12/10/2026, 00h de Brasília (UTC−3). */
const INICIO = Date.UTC(2026, 9, 12, 3);
const VISITAS = [9, 14, 21];
const DIAS = 56;
const CAMISETARIA = LUGARES[2];
const BASE = [2.5, 4, 6, 7.5, 9];
const FOCO_PADRAO = [4, 3, 3] as const;

type Estrategia = 'chute' | 'caderninho';
type Colecao = {
  l: Lancamento; media: number; procura: number; pecas: number; preco: number; pronta: number; fim: number;
  vendido: number; revelada: boolean; excessoPago: boolean;
};
type Resultado = {
  nivelEm: Map<number, number>; notas: { dia: number; media: number }[]; nivelFinal: number;
  /** maior % de procura até o dia 49, maior intervalo entre dois lançamentos (h), quantos lotes fiados */
  pctMax: number; maiorIntervaloH: number; fiados: number; fas: number;
  /** dia do primeiro lote fiado (null = nunca) e os fãs depois de cada visita */
  primeiroFiado: number | null; fasNoDia: { dia: number; fas: number }[];
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

const ids = (lista: readonly { id: number }[], tipo: 'tema' | 'estilo' | 'peca' | 'cor', nivel: number): number[] =>
  lista.filter((x) => liberado(tipo, x.id, nivel)).map((x) => x.id);

function simular(estrategia: Estrategia, semente: number, cupomInicial = CAMISETARIA.moedaInicial): Resultado {
  const sorte = aleatorio(semente);
  const escolhe = <T,>(xs: readonly T[]): T => xs[Math.floor(sorte() * xs.length)];
  let cupom = cupomInicial;
  let primeiroFiado: number | null = null;
  const fasNoDia: { dia: number; fas: number }[] = [];
  let ultimoFiado: number | null = null;
  let fiados = 0;
  let pctMax = 0;
  let ultimoLancamento = INICIO;
  let maiorIntervalo = 0;
  let nivel = 1;
  let fas = 0;
  let proximoId = semente * 1000 + 1;
  let ativa: Colecao | null = null;
  const historico: { tema: number; estilo: number }[] = []; // mais recente primeiro
  const nivelEm = new Map<number, number>([[1, 0]]);
  const notasDia: { dia: number; media: number }[] = [];
  // caderninho
  const combo = new Map<string, number>(); // "tema-estilo" → rótulo
  const pecaSabida = new Map<string, number>(); // "peca-tema" → peça × tema
  const focoSabido = new Map<number, readonly [number, number, number]>(); // estilo → foco ideal (relatório)
  const estilosLancados = new Set<number>();
  const reserva = (n: number) => custoLote(1, n, 1);

  function receber(t: number): void {
    const c = ativa;
    if (!c) return;
    if (t >= c.pronta) {
      const v = vendidoAte(Math.min(c.procura, c.pecas), c.pronta, t);
      cupom += (v - c.vendido) * c.preco;
      c.vendido = v;
    }
    if (t >= c.fim && !c.excessoPago) {
      fas += fasExcesso(c.procura, c.pecas, c.l.nivel);
      c.excessoPago = true;
    }
    if (t >= c.pronta && !c.revelada) {
      c.revelada = true;
      combo.set(`${c.l.tema}-${c.l.estilo}`, rotulo(c.l.tema, c.l.estilo));
      pecaSabida.set(`${c.l.peca}-${c.l.tema}`, pecaTema(c.l.peca, c.l.tema));
      fas += fasNota(c.media, c.l.nivel);
    }
    if (t >= c.fim) ativa = null;
  }

  function subir(t: number, dia: number): void {
    for (;;) {
      const custo = custoNivel(CAMISETARIA, nivel);
      if (custo === null || cupom - custo < reserva(nivel + 1)) return;
      cupom -= custo;
      nivel += 1;
      nivelEm.set(nivel, dia + (t - INICIO - dia * DIA) / DIA);
    }
  }

  /** A nota esperada (só com o que o caderninho sabe) de uma combinação agora. */
  function valor(tema: number, estilo: number, tend: number): number {
    const r = combo.get(`${tema}-${estilo}`);
    let v = r === undefined ? 7 : BASE[r];
    if (tema === tend) v += 1;
    if (historico.slice(0, 3).some((u) => u.tema === tema && u.estilo === estilo)) v -= 2;
    else if (historico[0] && (historico[0].tema === tema || historico[0].estilo === estilo)) v -= 1;
    if (!focoSabido.has(estilo)) v -= 0.6;
    return v;
  }

  function pecaPara(tema: number): number {
    const pecas = ids(PECAS, 'peca', nivel).filter((p) => p !== 6);
    let melhor = 1;
    let melhorV = -Infinity;
    for (const p of pecas) {
      const s = pecaSabida.get(`${p}-${tema}`);
      const v = (s === undefined ? 0.3 : s) + PECAS[p - 1].mult / 100;
      if (v > melhorV) [melhor, melhorV] = [p, v];
    }
    return melhor;
  }

  function lancar(t: number): void {
    const tend = tendencia(semanaDe(t));
    let tema: number; let estilo: number; let peca: number; let cor: number;
    let foco: readonly [number, number, number] = FOCO_PADRAO;
    if (estrategia === 'chute') {
      tema = escolhe(ids(TEMAS, 'tema', nivel));
      estilo = escolhe(ids(ESTILOS, 'estilo', nivel));
      peca = escolhe(ids(PECAS, 'peca', nivel));
      cor = escolhe(ids(CORES, 'cor', nivel));
    } else {
      let melhor: [number, number] = [1, 1];
      let melhorV = -Infinity;
      for (const te of ids(TEMAS, 'tema', nivel)) {
        for (const es of ids(ESTILOS, 'estilo', nivel)) {
          const v = valor(te, es, tend) + sorte() * 0.01;
          if (v > melhorV) [melhor, melhorV] = [[te, es], v];
        }
      }
      [tema, estilo] = melhor;
      peca = pecaPara(tema);
      cor = escolhe(ids(CORES, 'cor', nivel).filter((c) => CORES[c - 1].forte));
      foco = focoSabido.get(estilo) ?? FOCO_PADRAO;
    }
    let lote: 0 | 1 | null = cupom >= custoLote(peca, nivel, 1) ? 1 : cupom >= custoLote(peca, nivel, 0) ? 0 : null;
    let fiado = false;
    if (lote === null) {
      if (!podeFiar(true, cupom, custoLote(peca, nivel, 0), ultimoFiado, t)) return;
      [lote, fiado, ultimoFiado] = [0, true, t];
      fiados += 1;
      primeiroFiado ??= (t - INICIO) / DIA;
    }
    const l: Lancamento = {
      id: proximoId++, tema, estilo, peca, cor, foco, lote, nivel, fas, tendencia: tend, ultimas: historico.slice(0, 3),
    };
    const ns = notas(l);
    const media = ns.reduce((a, b) => a + b, 0) / 4;
    if (!fiado) cupom -= custoLote(peca, nivel, lote);
    const pronta = t + producaoMs(lote);
    ativa = {
      l, media, procura: procura(l, ns), pecas: pecasLote(nivel, lote), preco: precoPeca(peca), pronta, fim: pronta + VENDA_MS,
      vendido: 0, revelada: false, excessoPago: false,
    };
    historico.unshift({ tema, estilo });
    estilosLancados.add(estilo);
    notasDia.push({ dia: (t - INICIO) / DIA, media });
    if (t < INICIO + 49 * DIA) pctMax = Math.max(pctMax, pctProcura(l, ns));
    maiorIntervalo = Math.max(maiorIntervalo, (t - ultimoLancamento) / H);
    ultimoLancamento = t;
  }

  function relatorio(): void {
    const preco = precoRelatorio(nivel);
    if (cupom - reserva(nivel) < preco) return;
    // o estilo lançado sem relatório que aparece nas melhores combinações conhecidas
    const candidatos = [...estilosLancados].filter((e) => !focoSabido.has(e) && liberado('estilo', e, nivel));
    if (!candidatos.length) return;
    const peso = (e: number) => Math.max(...[...combo].filter(([k]) => Number(k.split('-')[1]) === e).map(([, r]) => r), -1);
    const e = candidatos.reduce((a, b) => (peso(b) > peso(a) ? b : a));
    cupom -= preco;
    focoSabido.set(e, ESTILOS[e - 1].foco);
  }

  for (let dia = 0; dia < DIAS; dia++) {
    for (const h of VISITAS) {
      const t = INICIO + dia * DIA + h * H;
      receber(t);
      subir(t, dia);
      if (estrategia === 'caderninho') relatorio();
      if (!ativa) lancar(t);
      fasNoDia.push({ dia: (t - INICIO) / DIA, fas });
    }
  }
  maiorIntervalo = Math.max(maiorIntervalo, (INICIO + DIAS * DIA - ultimoLancamento) / H);
  return { nivelEm, notas: notasDia, nivelFinal: nivel, pctMax, maiorIntervaloH: maiorIntervalo, fiados, fas, primeiroFiado, fasNoDia };
}

const media = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(xs.length, 1);
const mediaEntre = (r: Resultado, de: number, ate: number) => media(r.notas.filter((n) => n.dia >= de && n.dia < ate).map((n) => n.media));
const SEMENTES = Array.from({ length: 16 }, (_, k) => k + 1);

describe('balanceamento da camisetaria (simulação)', () => {
  const caderninho = SEMENTES.map((s) => simular('caderninho', s));
  const chute = SEMENTES.map((s) => simular('chute', s));

  if (process.env.SIM_LOG) {
    for (const [nome, rs] of [['caderninho', caderninho], ['chute', chute]] as const) {
      for (const [k, r] of rs.entries()) {
        const semanas = Array.from({ length: 8 }, (_, w) => mediaEntre(r, 7 * w, 7 * w + 7).toFixed(2)).join(' ');
        console.log(`${nome} s${SEMENTES[k]}: n5 ${r.nivelEm.get(5)?.toFixed(1)} n10 ${r.nivelEm.get(10)?.toFixed(1)} n15 ${r.nivelEm.get(15)?.toFixed(1)} n20 ${r.nivelEm.get(20)?.toFixed(1)} n25 ${r.nivelEm.get(25)?.toFixed(1)} final ${r.nivelFinal} | semanas ${semanas} | tudo ${mediaEntre(r, 0, 49).toFixed(2)} 14+ ${mediaEntre(r, 14, 49).toFixed(2)} | pctMax ${r.pctMax.toFixed(0)} intervalo ${r.maiorIntervaloH.toFixed(0)}h fiados ${r.fiados} fas ${r.fas.toFixed(0)}`);
      }
    }
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

  // A nota média é da população (média das sementes): cada semente tem ~35 coleções e oscila ±0,3.
  it('no chute: nota média entre 4,5 e 5,5', () => {
    const m = media(chute.map((r) => mediaEntre(r, 0, 49)));
    expect(m).toBeGreaterThanOrEqual(4.5);
    expect(m).toBeLessThanOrEqual(5.5);
  });

  it('ninguém no chute fica travado sem cupom (o fornecedor fia): no máximo 1 dia sem lançar', () => {
    for (const r of chute) expect(r.maiorIntervaloH).toBeLessThanOrEqual(48);
  });

  it('a % de procura fica abaixo de 1000% nos 49 dias', () => {
    for (const r of [...caderninho, ...chute]) expect(r.pctMax).toBeLessThan(1000);
  });

  it('com caderninho: nota média 8 ou mais depois de 14 dias', () => {
    expect(media(caderninho.map((r) => mediaEntre(r, 14, 49)))).toBeGreaterThanOrEqual(8);
  });
  // Pessoa quebrada: começa sem cupom (ou queimou tudo numa série ruim). O fornecedor fia o lote pequeno e ela volta a jogar.
  it('quem fica sem cupom recebe lote fiado, volta a lançar e depois sobe de nível', () => {
    for (const s of SEMENTES.slice(0, 8)) {
      const r = simular('chute', s, 0);
      expect(r.fiados).toBeGreaterThan(0);
      expect(r.primeiroFiado).toBeCloseTo(VISITAS[0] / 24, 9); // fiou já na primeira visita
      expect(r.notas.length).toBeGreaterThan(40); // continuou lançando (1 por dia)
      expect(r.maiorIntervaloH).toBeLessThanOrEqual(48);
      expect(r.nivelEm.get(2)).toBeGreaterThan(r.primeiroFiado!);
    }
  });

  // Marco de fãs da camisetaria (id 37): calibrado para a mediana do caderninho chegar por volta do dia 28.
  it('com caderninho: o marco de fãs chega por volta do dia 28 (mediana entre 25 e 31)', () => {
    const limiar = MARCOS.find((m) => m.id === 37)!.valor!;
    const dias = caderninho.map((r) => r.fasNoDia.find((f) => f.fas >= limiar)?.dia ?? Infinity).sort((a, b) => a - b);
    const mediana = (dias[7] + dias[8]) / 2;
    expect(mediana).toBeGreaterThanOrEqual(25);
    expect(mediana).toBeLessThanOrEqual(31);
  });
});
