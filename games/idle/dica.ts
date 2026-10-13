// Caixinhas de informação (estilo Cookie Clicker): o que cada coisa da Fellas Inc. está fazendo agora, em números.
// Só conta da página (puro); quem mostra é dicaTela.ts. Regra: coisa nova com número ou efeito ganha caixinha
// (ver CLAUDE.md, "Fellas Inc.").
import type { IdleState } from '../shared/types';
import { catalogo, type Melhoria } from './catalogo';
import { estrategiasAtivas, fatores, multBonus, partesContratos } from './economia';
import { formatarTaxa, formatarValor } from './formatar';
import { multGerador } from './convidados';

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

const num = (x: number, casas = 2) => (Math.round(x * 10 ** casas) / 10 ** casas).toLocaleString('pt-BR');
const pct = (x: number) => `${num(x * 100, 1)}%`;
const vezes = (x: number) => `×${num(x)}`;
const hortaProd = (s: IdleState) => s.horta_bonus?.producao ?? 0;
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

/** Quanto rende uma unidade de cada gerador agora (com tudo, horta inclusa). */
function porUnidade(s: IdleState) {
  const f = fatores(catalogo, s);
  const agora = Date.parse(s.server_now);
  return f.porGerador.map((x, i) => x * f.global * (1 + hortaProd(s)) * multGerador(s, i + 1, Number.isFinite(agora) ? agora : Date.now()));
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
  if (tipo === 1) {
    const n = (s.boosts ?? (s.boost_until ? [s.boost_until] : [])).filter((t) => Date.parse(t) > agoraMs).length;
    const texto = n
      ? `Agora: ×${num(5 ** n, 0)} no ar. Pegando esta, vira ×${num(5 ** (n + 1), 0)}`
      : 'Empilha: pegar outra com esta no ar dá ×25, e com o Viralizou multiplica de novo';
    return { titulo: 'Produção ×5 por 1 minuto', linhas: [{ texto }] };
  }
  const n = s.meias ?? (s.half_price ? 1 : 0);
  const texto = n
    ? `Você tem ${n} ${n === 1 ? 'guardada' : 'guardadas'}. Pegando esta, as próximas ${n + 1} compras saem pela metade`
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
