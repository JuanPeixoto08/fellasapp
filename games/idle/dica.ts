// Caixinhas de informação (estilo Cookie Clicker): o que cada coisa da Fellas Inc. está fazendo agora, em números.
// Só conta da página (puro); quem mostra é dicaTela.ts. Regra: coisa nova com número ou efeito ganha caixinha
// (ver CLAUDE.md, "Fellas Inc.").
import type { IdleState, LugarEstado, PinoMapa } from '../shared/types';
import type { Marco } from './mapa';
import { catalogo, type Melhoria } from './catalogo';
import { copiasOportunidade, estrategiasAtivas, fatores, multBonus, partesContratos } from './economia';
import { formatarTaxa, formatarValor } from './formatar';
import { multGerador } from './convidados';
import { CORES, custoLote, ESTILOS, liberado, NOME_ROTULO, PECAS, pecasLote, precoPeca, producaoMs, TEMAS, type Caderno } from './camisetaria';

export type LinhaDica = { texto: string; tom?: 'bom' | 'ruim' | 'fraco' };
export type Dica = { titulo: string; linhas: LinhaDica[] };

/** "8 s", "1 min 8 s", "3 h 12 min", "2 dias 5 h": quanto tempo da sua produção uma coisa custa. */
export function tempoDeProducao(segundos: number): string {
  if (!Number.isFinite(segundos)) return 'muito tempo';
  const s = Math.floor(segundos);
  if (s < 1) return 'menos de 1 s';
  if (s < 60) return `${s} s`;
  const par = (a: number, ua: string, b: number, ub: string) => (b ? `${a} ${ua} ${b} ${ub}` : `${a} ${ua}`);
  if (s < 3600) return par(Math.floor(s / 60), 'min', s % 60, 's');
  if (s < 86400) return par(Math.floor(s / 3600), 'h', Math.floor((s % 3600) / 60), 'min');
  const d = Math.floor(s / 86400);
  return par(d, d === 1 ? 'dia' : 'dias', Math.floor((s % 86400) / 3600), 'h');
}

/** Número em pt-BR com até `casas` casas (1,5; 1.234,57). */
export const num = (x: number, casas = 2) => (Math.round(x * 10 ** casas) / 10 ** casas).toLocaleString('pt-BR');
const pct = (x: number) => `${num(x * 100, 1)}%`;
const vezes = (x: number) => `×${num(x)}`;
const hortaProd = (s: IdleState) => s.horta_bonus?.producao ?? 0;
/** O multiplicador do Mapa do rolê que o banco já pôs na taxa (sem lugar: 1). */
export const multMapaDe = (s: IdleState) => s.mapa_mult ?? 1;
/** "· 2 min da sua produção" (sem produção ainda, nada). */
const emTempo = (s: IdleState, preco: number) => (s.rate > 0 ? ` · ${tempoDeProducao(preco / s.rate)} da sua produção` : '');

/** Quanto as melhorias de gerador dobram e quanto as sinergias somam num gerador. */
function partesGerador(s: IdleState, gid: number) {
  let dobras = 0;
  let sinergia = 0;
  for (const id of s.upgrades) {
    const m = catalogo.melhorias.find((x) => x.id === id);
    if (m?.tipo === 'gerador' && m.gerador === gid) dobras++;
    if (m?.tipo === 'sinergia' && m.alvo === gid) sinergia += m.porUnidade * s.generators[m.fonte - 1];
  }
  const est = estrategiasAtivas(catalogo, s).reduce(
    (a, e) => (e.genDe !== null && e.genAte !== null && gid >= e.genDe && gid <= e.genAte ? a * e.genMult : a), 1);
  return { dobras, sinergia, est };
}

/** Quanto rende uma unidade de cada gerador agora (com tudo, horta e Mapa do rolê inclusos). */
export function porUnidade(s: IdleState) {
  const f = fatores(catalogo, s);
  const agora = Date.parse(s.server_now);
  return f.porGerador.map((x, i) => x * f.global * (1 + hortaProd(s)) * multGerador(s, i + 1, Number.isFinite(agora) ? agora : Date.now()) * multMapaDe(s));
}

export function dicaGerador(s: IdleState, gid: number, precoProximo: number): Dica {
  const cada = porUnidade(s);
  const n = s.generators[gid - 1];
  const soma = cada.reduce((a, x, i) => a + x * s.generators[i], 0);
  const linhas: LinhaDica[] = [{ texto: `Cada um rende ${formatarTaxa(cada[gid - 1])}` }];
  if (n > 0) {
    const fatia = soma > 0 ? (n * cada[gid - 1]) / soma : 0;
    linhas.push({ texto: `${n === 1 ? 'O seu rende' : `Os ${n} rendem`} ${formatarTaxa(n * cada[gid - 1])} · ${fatia < 0.01 ? 'menos de 1%' : `${Math.round(fatia * 100)}%`} da sua produção`, tom: 'bom' });
  }
  const p = partesGerador(s, gid);
  if (p.dobras) linhas.push({ texto: `Melhorias: rende ${2 ** p.dobras}× mais`, tom: 'fraco' });
  if (p.sinergia) linhas.push({ texto: `Sinergias: +${num(p.sinergia * 100, 0)}%`, tom: 'fraco' });
  if (p.est !== 1) linhas.push({ texto: `Estratégia: ${vezes(p.est)}`, tom: 'fraco' });
  if (hortaProd(s)) linhas.push({ texto: `Horta: ${hortaProd(s) > 0 ? '+' : '−'}${pct(Math.abs(hortaProd(s)))}`, tom: 'fraco' });
  const conv = multGerador(s, gid, Date.parse(s.server_now) || Date.now());
  if (Math.abs(conv - 1) > 1e-9) linhas.push({ texto: `Convidados: ${vezes(conv)}`, tom: conv >= 1 ? 'fraco' : 'ruim' });
  const mapa = multMapaDe(s);
  if (Math.abs(mapa - 1) > 1e-9) linhas.push({ texto: `Mapa do rolê: ${vezes(mapa)}`, tom: mapa >= 1 ? 'fraco' : 'ruim' });
  linhas.push({ texto: `O próximo custa ${formatarValor(precoProximo)}${emTempo(s, precoProximo)}` });
  return { titulo: catalogo.geradores[gid - 1].nome, linhas };
}

/** `preco` null = já comprada (sem preço nem quanto soma). */
export function dicaMelhoria(s: IdleState, m: Melhoria, preco: number | null): Dica {
  const cada = porUnidade(s);
  const nome = (gid: number) => `"${catalogo.geradores[gid - 1].nome}"`;
  const linhas: LinhaDica[] = [];
  let ganho = 0;
  if (m.tipo === 'gerador') {
    linhas.push({ texto: `${nome(m.gerador)} rende o dobro` });
    ganho = cada[m.gerador - 1] * s.generators[m.gerador - 1];
  } else if (m.tipo === 'geral') {
    linhas.push({ texto: `Toda a produção ${vezes(m.mult)}` });
    ganho = s.rate * (m.mult - 1);
  } else {
    const nf = s.generators[m.fonte - 1];
    linhas.push({ texto: `Cada ${nome(m.fonte)} dá +${num(m.porUnidade * 100)}% em ${nome(m.alvo)}` });
    linhas.push({ texto: `Com os seus ${nf}: ${nome(m.alvo)} +${num(m.porUnidade * nf * 100, 0)}%`, tom: 'fraco' });
    const atual = 1 + partesGerador(s, m.alvo).sinergia;
    ganho = (cada[m.alvo - 1] * s.generators[m.alvo - 1] * m.porUnidade * nf) / atual;
  }
  if (preco !== null) {
    if (ganho > 0) linhas.push({ texto: `Agora: ${formatarTaxa(ganho)}`, tom: 'bom' });
    linhas.push({ texto: `Custa ${formatarValor(preco)}${emTempo(s, preco)}` });
  } else linhas.push({ texto: 'Comprada', tom: 'fraco' });
  return { titulo: m.nome, linhas };
}

/** O F$/s do topo, multiplicador por multiplicador (a mesma conta de economia.ts/idle_rate_at). */
export function dicaProducao(s: IdleState, agoraMs: number): Dica {
  const f = fatores(catalogo, s);
  const base = f.porGerador.reduce((a, x, i) => a + x * s.generators[i], 0);
  const gerais = s.upgrades.reduce((a, id) => {
    const m = catalogo.melhorias.find((x) => x.id === id);
    return m?.tipo === 'geral' ? a * m.mult : a;
  }, 1);
  const est = estrategiasAtivas(catalogo, s);
  const distintos = s.generators.filter((n) => n > 0).length;
  const estrategias = est.reduce((a, e) => a * e.prodMult, 1) * (1 + est.reduce((a, e) => a + e.porGeradorDistinto, 0) * distintos);
  const contratos = partesContratos(catalogo, s).mult;
  const legado = multBonus(catalogo, s);
  const linhas: LinhaDica[] = [{ texto: `Geradores: ${formatarTaxa(base)}` }];
  const mult = (rotulo: string, x: number) => {
    if (Math.abs(x - 1) > 1e-9) linhas.push({ texto: `${rotulo}: ${vezes(x)}`, tom: x >= 1 ? 'fraco' : 'ruim' });
  };
  mult('Melhorias gerais', gerais);
  mult('Estratégias', estrategias);
  mult('Contratos', contratos);
  mult('Conquistas e árvore', legado);
  mult('Horta', 1 + hortaProd(s));
  mult('Convidados', multGerador(s, 0, agoraMs));
  mult('Mapa do rolê', multMapaDe(s));
  const cincos = (s.boosts ?? (s.boost_until ? [s.boost_until] : [])).filter((t) => Date.parse(t) > agoraMs).length;
  if (cincos) linhas.push({ texto: `Agora: ×${num(5 ** cincos, 0)} ${cincos === 1 ? 'da oportunidade' : 'das oportunidades'}`, tom: 'bom' });
  const virais = s.viral.filter((t) => Date.parse(t) > agoraMs).length;
  if (virais) linhas.push({ texto: `Agora: ×${num(10 ** virais, 0)} do Viralizou`, tom: 'bom' });
  linhas.push({ texto: `Total: ${formatarTaxa(s.rate)}` });
  return { titulo: 'De onde vem sua produção', linhas };
}

/** A caixinha de uma oportunidade da Caixinha (0062: tudo empilha), com o que a pessoa tem agora. Os 15 minutos de
 *  produção não têm (a linha já diz tudo). */
export function dicaOportunidade(s: IdleState, tipo: 0 | 1 | 2, agoraMs: number): Dica | null {
  if (tipo === 0) return null;
  const c = copiasOportunidade(catalogo, s); // "rendem o dobro" (Viralizar / Xepa da feira): conta como 2 pegas
  const rende = (k: number) => (k === 2 ? 'Rendem o dobro' : `Rendem ${k}×`);
  if (tipo === 1) {
    const n = (s.boosts ?? (s.boost_until ? [s.boost_until] : [])).filter((t) => Date.parse(t) > agoraMs).length;
    const texto = n
      ? `Agora: ×${num(5 ** n, 0)} no ar. Pegando esta, vira ×${num(5 ** (n + c), 0)}`
      : c > 1 ? `${rende(c)}: conta como ${c} de uma vez (×${num(5 ** c, 0)})`
        : 'Empilha: pegar outra com esta no ar dá ×25, e com o Viralizou multiplica de novo';
    return { titulo: 'Produção ×5 por 1 minuto', linhas: [{ texto }] };
  }
  const n = s.meias ?? (s.half_price ? 1 : 0);
  const texto = n
    ? `Você tem ${n} ${n === 1 ? 'guardada' : 'guardadas'}. Pegando esta, as próximas ${n + c} compras saem pela metade`
    : c > 1 ? `${rende(c)}: guarda ${c} compras pela metade de uma vez`
      : 'Empilha: cada uma guardada vale uma compra pela metade';
  return { titulo: 'Próxima compra pela metade', linhas: [{ texto }] };
}

export function dicaContratos(s: IdleState): Dica {
  const p = partesContratos(catalogo, s);
  const n = s.social?.contratei ?? 0;
  const k = s.social?.empregos.length ?? 0;
  const linhas: LinhaDica[] = [{ texto: `Você contratou ${n}: +${pct(p.contratei)}`, tom: n ? 'bom' : 'fraco' }];
  linhas.push(k
    ? { texto: `Trabalha em ${k === 1 ? '1 empresa' : `${k} empresas`}: +${pct(p.empregos)}`, tom: 'bom' }
    : { texto: `Ninguém te contratou: piso de freela +${pct(p.empregos)}`, tom: 'fraco' });
  if (p.efeito !== 1) linhas.push({ texto: `Estratégia: contratos valem ${vezes(p.efeito)}`, tom: 'fraco' });
  linhas.push({ texto: `Total: +${pct(p.mult - 1)} de produção` });
  return { titulo: 'Contratos', linhas };
}

// ===== Mapa do rolê: caixinhas em uma frase (pino fechado, marcos, desafio e o botão de nível) =====

/** O nome dos fãs e do volume de cada lugar com mecânica (spec 3.3), no plural. */
export const TERMOS_LUGAR: Record<number, { fas: string; volume: string }> = {
  3: { fas: 'fãs', volume: 'coleções' },
  4: { fas: 'de galera', volume: 'copões' },
  7: { fas: 'de reputação', volume: 'casais formados' },
};
const inteiro = (n: number) => Math.floor(n).toLocaleString('pt-BR');
/** "cupom" → "cupons", "ficha" → "fichas" (sem moeda: "moedas"). */
export const plural = (palavra: string | null) => (!palavra ? 'moedas' : palavra.endsWith('m') ? `${palavra.slice(0, -1)}ns` : `${palavra}s`);

export function dicaPino(p: PinoMapa, valuation: number, era: number): string {
  let t = `Abre por ${formatarValor(p.preco)} (${num(p.horas)} h da sua produção).`;
  if (era < p.era) t += ` Precisa da era ${p.era}.`;
  if (valuation < p.preco) t += ` Falta ${formatarValor(p.preco - valuation)}.`;
  return t;
}

export function dicaMarco(m: Marco, l: LugarEstado): string {
  const base = `+${pct(m.bonus)} de produção na empresa.`;
  if (m.tipo === 'lendario') return `${base} Um resultado lendário neste lugar.${l.marcos.includes(m.id) ? ' Já ganhou.' : ''}`;
  const termos = TERMOS_LUGAR[m.lugar] ?? { fas: 'fãs', volume: 'feitos' };
  const valor = m.valor ?? 0;
  const [meta, ondeEsta] = m.tipo === 'nivel' ? [`Nível ${valor}`, `você está no ${l.nivel ?? 0}`]
    : m.tipo === 'fas' ? [`${inteiro(valor)} ${termos.fas}`, `você tem ${inteiro(l.fas ?? 0)}`]
      : [`${inteiro(valor)} ${termos.volume}`, `você fez ${inteiro(l.volume ?? 0)}`];
  return l.marcos.includes(m.id) ? `${base} ${meta}. Já ganhou.` : `${base} ${meta} (${ondeEsta}).`;
}

export function dicaDesafio(d: NonNullable<LugarEstado['desafio']>): string {
  const premio = d.premio === 'horas' ? `${num(d.premio_valor)} h da sua produção em F$`
    : d.premio === 'legado' ? `${num(d.premio_valor)} ${d.premio_valor === 1 ? 'ponto' : 'pontos'} do Legado`
      : 'um Investidor na hora (20 min de produção)';
  return `Prêmio: ${premio}.${d.feito ? ' Já fez esta semana.' : ''}`;
}

export function dicaNivel(l: LugarEstado, libera: string[]): string {
  const n = l.nivel ?? 1;
  if (l.preco_nivel === null) return `Nível ${n}: o máximo.`;
  const rende = libera.length ? `Rende mais e libera: ${libera.join(', ')}.` : 'Rende mais.';
  return `Nível ${n} → ${n + 1} por ${inteiro(Math.ceil(l.preco_nivel))} ${plural(l.moeda_nome)}. ${rende}`;
}

// ===== Camisetaria (lugar 3): caixinhas da bancada e do caderninho. Só o que a pessoa já sabe (o caderninho); o que
// nunca testou diz "Ainda não testou". Não entra no resultado nem no pódio. =====

/** "Combinação ótima!" já tem a pontuação; as outras levam ponto. */
const frase = (t: string) => (/[.!?]$/.test(t) ? t : `${t}.`);
const trancado = (nivel: number) => `Libera no nível ${nivel}.`;
/** "Com Grafite: Combinação ótima!" ou "Ainda não testou com Grafite." */
const combo = (cad: Caderno, tema: number, estilo: number, com: string) => {
  const r = cad.combos.get(`${tema},${estilo}`);
  return r === undefined ? `Ainda não testou com ${com}.` : `Com ${com}: ${frase(NOME_ROTULO[r])}`;
};
const focoTexto = (f: readonly number[]) => `Arte ${f[0]} · Tecido ${f[1]} · Divulgação ${f[2]}`;

/** O tema com o estilo escolhido agora (e se está em alta na semana). */
export function dicaTeeTema(tema: number, estilo: number, nivel: number, cad: Caderno, tendencia: number): string {
  const t = TEMAS[tema - 1];
  if (!liberado('tema', tema, nivel)) return trancado(t.nivel);
  const texto = combo(cad, tema, estilo, ESTILOS[estilo - 1].nome);
  return tema === tendencia ? `${texto} Em alta esta semana: a nota sobe.` : texto;
}

/** O estilo com o tema escolhido agora e o foco ideal (se a pessoa comprou o relatório). */
export function dicaTeeEstilo(estilo: number, tema: number, nivel: number, cad: Caderno): string {
  const e = ESTILOS[estilo - 1];
  if (!liberado('estilo', estilo, nivel)) return trancado(e.nivel);
  const f = cad.focos.get(estilo);
  return `${combo(cad, tema, estilo, TEMAS[tema - 1].nome)} Foco ideal: ${f ? `${focoTexto(f)}.` : 'só com o relatório.'}`;
}

/** A peça: quanto custa, por quanto vende e se combina com o tema escolhido. */
export function dicaTeePeca(peca: number, tema: number, nivel: number, cad: Caderno): string {
  const p = PECAS[peca - 1];
  if (!liberado('peca', peca, nivel)) return trancado(p.nivel);
  const nomeTema = TEMAS[tema - 1].nome;
  const pt = cad.pecas.get(`${peca},${tema}`);
  const junto = pt === undefined ? `Ainda não testou com ${nomeTema}.`
    : `Com ${nomeTema}: ${pt > 0 ? 'combina' : pt < 0 ? 'não combina' : 'nem ajuda nem atrapalha'}.`;
  return `Custa ${num(p.custo)} cupons e vende por ${num(precoPeca(peca), 1)}. ${junto}`;
}

export function dicaTeeCor(cor: number, nivel: number): string {
  const c = CORES[cor - 1];
  if (!liberado('cor', cor, nivel)) return trancado(c.nivel);
  return c.forte ? 'Cor forte: o @SuperMauro64 curte.' : 'Cor discreta.';
}

/** O foco (arte, tecido, divulgação): o ideal do estilo escolhido, se a pessoa tem o relatório. */
export function dicaTeeFoco(estilo: number, cad: Caderno): string {
  const nome = ESTILOS[estilo - 1].nome;
  const f = cad.focos.get(estilo);
  return f ? `O ideal do ${nome}: ${focoTexto(f)}. Quanto mais longe dele, menor a nota.`
    : `O ideal do ${nome} é segredo. Depois de lançar um, o relatório do caderninho mostra.`;
}

/** O lote (0 pequeno, 1 médio, 2 grande) da peça escolhida no nível: peças, custo, tempo e o que rende esgotando. */
export function dicaTeeLote(peca: number, nivel: number, lote: 0 | 1 | 2): string {
  const n = pecasLote(nivel, lote);
  const preco = precoPeca(peca);
  return `${num(n, 0)} peças por ${num(custoLote(peca, nivel, lote), 0)} cupons. Fica pronto em ${producaoMs(lote) / 3600_000} h e vende em 12 h `
    + `a ${num(preco, 1)} cupons a peça: esgotando, rende ${num(n * preco, 0)}.`;
}

export function dicaTeeRelatorio(estilo: number, preco: number, moeda: number): string {
  const t = `Mostra pra sempre o foco ideal do ${ESTILOS[estilo - 1].nome}. Custa ${inteiro(Math.ceil(preco))} cupons.`;
  return moeda < preco ? `${t} Faltam ${inteiro(Math.ceil(preco - moeda))}.` : t;
}

const TIPO_TEE = { tema: ['tema', 'temas'], estilo: ['estilo', 'estilos'], peca: ['peça', 'peças'], cor: ['cor', 'cores'] } as const;
/** O cadeado de um grupo da bancada: o próximo que libera, em que nível, e quantos ainda faltam. Nos temas, se o tema em
 *  alta da semana (`tendencia`) ainda está trancado, diz qual é e em que nível libera. */
export function dicaTeeTrancados(tipo: 'tema' | 'estilo' | 'peca' | 'cor', nivel: number, tendencia?: number): string {
  const lista = { tema: TEMAS, estilo: ESTILOS, peca: PECAS, cor: CORES }[tipo];
  const falta = lista.filter((x) => !liberado(tipo, x.id, nivel));
  if (!falta.length) return '';
  const prox = falta.reduce((a, x) => (x.nivel < a.nivel ? x : a));
  const [um, varios] = TIPO_TEE[tipo];
  const resto = falta.length - 1;
  const texto = `Próximo: ${prox.nome}, no nível ${prox.nivel}.${resto ? ` Depois ${resto === 1 ? `mais 1 ${um}` : `mais ${resto} ${varios}`} até o nível ${Math.max(...falta.map((x) => x.nivel))}.` : ''}`;
  const alta = tipo === 'tema' && tendencia ? TEMAS[tendencia - 1] : undefined;
  return alta && !liberado('tema', alta.id, nivel) ? `${texto} Em alta esta semana: ${alta.nome} (libera no nível ${alta.nivel}).` : texto;
}
