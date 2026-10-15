// Eventos na tela (tipo cookie dourado): a cada segundo há chance 1/600 de aparecer um (mais com o ramo Dourados da
// árvore ou o Gemaplys), pra quem está com o jogo aberto, e ele some em 12 s (24 com o Olho de lince). A sorte tem semente (id do jogador + segundo) e é a mesma conta do banco
// (idle_dourado na 0045), que confere o clique. BigInt: os quadrados passam de 2^53.
import type { DouradoPago } from '../shared/types';
import { catalogo } from './catalogo';
import type { Dica } from './dica';
import { VIRAL_MS } from './economia';
import { formatarValor } from './formatar';
import { CHAMADOS_MAX, semente } from './oportunidades';

export const TIPOS_DOURADO = ['investidor', 'promocao', 'viralizou', 'dupla', 'trend', 'linkedin', 'pix', 'tigrinho'] as const;
/** 0 Investidor apressado · 1 Promoção relâmpago · 2 Viralizou · 3 dupla de Viralizou · 4 Trend do TikTok · 5 Bombou no
 *  LinkedIn · 6 Pix errado · 7 Tigrinho (os quatro últimos desde 15/10, 0076). */
export type TipoDourado = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
/** Quanto tempo o evento fica na tela (s); o banco aceita até 15 s (folga da rede). */
export const JANELA_S = 12;

// os números dos dourados novos (0076; o Tigrinho com os do plano: paga 30 min e come 15, ver valorMedio.ts)
export const TREND_MAX = 20; // moedinhas que contam num Trend
export const CHUVA_S = 8; // a chuva do Trend (e quanto a escolha do Pix fica aberta depois da janela)
export const MOEDINHA_S = 60; // cada moedinha: 1 min de produção
export const PIX_FICAR_S = 1800; // ficar com o Pix: 30 min de produção
export const TIGRE_GRATIS = 3; // jogadas do dia que sempre pagam
export const TIGRE_CHANCE = 30; // depois, paga 30 em cada 100
export const TIGRE_PAGA_S = 1800;
export const TIGRE_COME_S = 900;
export const LINKEDIN_MULT = 30; // o gerador sorteado rende ×30
export const LINKEDIN_TOP = 5; // sorteado entre os 5 que mais rendem
export const COMBO_MULT = 7;
export const COMBO_PRECISA = 3; // pegos seguidos
export const COMBO_JANELA_S = 1800; // o último pego tem mais de 30 min: o combo zera

const P = 2147483647n;
const K = 1013904223n;
const mistura = (x: bigint) => (x * x + K) % P;

function h1(uid: string, s: number): bigint {
  const b = BigInt(s);
  return (b * b * 48271n + b * 16807n + BigInt(semente(uid)) * 69621n + 12345n) % P;
}
/** A 3ª mistura do segundo (igual a idle_dourado_h3): o tipo sai dela (r = h3 % 100), e os sorteios dos novos também. */
const h3 = (uid: string, s: number) => mistura(mistura(h1(uid, s)));

/** Faixas de r (0–99), na ordem da spec: dupla 0–1, Viralizou 2–14, Promoção 15–32, Investidor 33–57, Trend 58–69,
 *  LinkedIn 70–81, Pix 82–91, Tigrinho 92–99. */
const RODA: readonly (readonly [number, TipoDourado])[] = [[2, 3], [15, 2], [33, 1], [58, 0], [70, 4], [82, 5], [92, 6], [100, 7]];

/** O tipo sorteado pro segundo `s` (vale pros eventos da sorte e pras faixas do MC V.V). */
export function tipoDourado(uid: string, s: number): TipoDourado {
  const r = Number(h3(uid, s) % 100n);
  return RODA.find(([lim]) => r < lim)![1];
}

/** O "sal" de cada sorteio dos dourados novos (o mesmo no banco). */
export const SAL = { tigre: 4242, linkedin: 5151, pix: 6161, frase: 7373 } as const;
/** Um sorteio de 0 a n − 1 do segundo `s` (igual a idle_dourado_sorteio). */
export const sorteioDourado = (uid: string, s: number, sal: number, n: number) => Number(mistura(h3(uid, s) + BigInt(sal)) % BigInt(n));
/** O tipo de um dourado garantido (Pix devolvido, Chamar) no segundo `s`: a roda sem Pix e sem Tigrinho (viram Investidor). */
export function tipoGarantido(uid: string, s: number): TipoDourado {
  const t = tipoDourado(uid, s);
  return t >= 6 ? 0 : t;
}
/** Pix devolvido no segundo `s`: o segundo do garantido em dobro, de 20 a 120 s depois. */
export const segundoPix = (uid: string, s: number) => s + 20 + sorteioDourado(uid, s, SAL.pix, 101);
/** Tigrinho depois das 3 grátis do dia: paga? (3 em cada 10) */
export const tigrePaga = (uid: string, s: number) => sorteioDourado(uid, s, SAL.tigre, 100) < TIGRE_CHANCE;
/** Bombou no LinkedIn: o gerador sorteado entre os 5 que mais rendem (empate: o de id menor primeiro) e a parte dele na
 *  soma (`rendas[i]` = o gerador i + 1). Sem renda nenhuma: null. Igual a idle_linkedin. */
export function escolhaLinkedin(uid: string, s: number, rendas: readonly number[]): { gen: number; f: number } | null {
  const soma = rendas.reduce((a, x) => a + (x > 0 ? x : 0), 0);
  const top = rendas.map((renda, i) => ({ gen: i + 1, renda })).filter((x) => x.renda > 0)
    .sort((a, b) => b.renda - a.renda || a.gen - b.gen).slice(0, LINKEDIN_TOP);
  if (!top.length) return null;
  const e = top[sorteioDourado(uid, s, SAL.linkedin, top.length)];
  return { gen: e.gen, f: e.renda / soma };
}

/** O evento que aparece pro jogador no segundo `s` (epoch), ou null. `gema` = o peso do Gemaplys (0 a 1): mais
 *  segundos valem (até 2× com ele na frente), igual a idle_dourado na 0051. */
export function douradoEm(uid: string, s: number, gema = 0): TipoDourado | null {
  const h2 = mistura(h1(uid, s));
  const extra = gema > 0 && Number(mistura(h2 + 777n) % 2400n) < 4 * gema;
  if (h2 % 600n !== 0n && !extra) return null;
  return tipoDourado(uid, s);
}

/** Quanto tempo o evento fica na tela: `base` (12 s, 24 com o Olho de lince) e metade com o Gemaplys na frente. */
export const janelaS = (gema = 0, base = JANELA_S) => base * (1 - gema / 2);

/** Os eventos de [de, ate) (segundos): pra agendar o som com a aba escondida. */
export function douradosEntre(uid: string, de: number, ate: number): { seg: number; tipo: TipoDourado }[] {
  const out: { seg: number; tipo: TipoDourado }[] = [];
  for (let s = de; s < ate; s++) {
    const tipo = douradoEm(uid, s);
    if (tipo !== null) out.push({ seg: s, tipo });
  }
  return out;
}

/** Onde aparece (fração da tela, longe das bordas); só da página. Na dupla os dois lados usam o mesmo ponto e a tela
 *  põe o lado 1 um ícone ao lado (douradoTela). */
export function posicao(uid: string, s: number, _lado = 0): { x: number; y: number } {
  const h = Number(mistura(mistura(mistura(h1(uid, s)))));
  return { x: 0.08 + ((h % 1000) / 1000) * 0.7, y: 0.15 + ((Math.floor(h / 1000) % 1000) / 1000) * 0.7 };
}

// ---------- o que está valendo (selos) e os textos ----------
type ComBonus = {
  promo_ate: string | null; viral?: readonly string[]; boosts?: readonly string[]; marmita_ate?: string | null; upg_desc_ate?: string | null;
  linkedin_ate?: string | null; linkedin_gen?: number | null; linkedin_mult?: number | null; combo_ate?: string | null; cupons?: number;
  cashback_ate?: string | null; chamados?: number;
};
const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** 10^k em pt-BR: 10, 100, 1.000… (cada Viralizou ativo multiplica ×10, sem teto). */
const vezes = (k: number) => (10 ** k).toLocaleString('pt-BR');

/** Promoção relâmpago valendo agora (o custo das compras cai pela metade). */
export const promoAtiva = (s: { promo_ate: string | null }, agoraMs: number) => s.promo_ate !== null && Date.parse(s.promo_ate) > agoraMs;

/** Os fins dos Viralizou que estão valendo (ms), em ordem. Cada um vale [fim − viralMs, fim): o Viralizou em dobro são
 *  dois fins encadeados e o 2º só conta quando o 1º acaba (0076). */
export const viraisAtivos = (s: ComBonus, agoraMs: number, viralMs = VIRAL_MS) =>
  (s.viral ?? []).map(Date.parse).filter((f) => f > agoraMs && f - viralMs <= agoraMs).sort((a, b) => a - b);

/** Um selo ao lado do F$: o texto, se é dourado, a caixinha, se é botão (o Chamar) e uma classe a mais (as bolinhas). */
export type Selo = { texto: string; ouro: boolean; dica?: Dica; acao?: 'chamar'; classe?: string };
const dois = (x: number) => (Math.round(x * 100) / 100).toLocaleString('pt-BR');

/** Selos ao lado do F$: "×10 · 0:42", "×100 · 0:15" (dourado a partir de dois, até o primeiro acabar), "Metade · 0:21",
 *  e os de 0076. `viralMs` = quanto dura um Viralizou (o Hype dobra), `combo` = o combo em andamento (combo.ts),
 *  `duracao` = o Hype (o Combo dura isso em min). */
export function selosBonus(s: ComBonus, agoraMs: number, o: { viralMs?: number; combo?: number; duracao?: number } = {}): Selo[] {
  const out: Selo[] = [];
  const v = viraisAtivos(s, agoraMs, o.viralMs);
  if (v.length) out.push({ texto: `×${vezes(v.length)} · ${mmss(v[0] - agoraMs)}`, ouro: v.length >= 2 });
  // os ×5 da oportunidade empilhados somam (0064): ×5, ×10, ×15… até o primeiro acabar
  const b = (s.boosts ?? []).map(Date.parse).filter((f) => f > agoraMs).sort((x, y) => x - y);
  if (b.length) out.push({ texto: `×${(5 * b.length).toLocaleString('pt-BR')} · ${mmss(b[0] - agoraMs)}`, ouro: b.length >= 2 });
  if (promoAtiva(s, agoraMs)) out.push({ texto: `Metade · ${mmss(Date.parse(s.promo_ate!) - agoraMs)}`, ouro: false });
  // eventos de era (0074): a Marmita (×3) e a Atualização (melhorias −25%), cada um com a sua caixinha
  if (s.marmita_ate && Date.parse(s.marmita_ate) > agoraMs) {
    const falta = mmss(Date.parse(s.marmita_ate) - agoraMs);
    out.push({ texto: `Marmita ×3 · ${falta}`, ouro: false, dica: { titulo: 'Marmita da mãe', linhas: [
      { texto: 'Produção ×3, por cima de todo o resto' }, { texto: `Acaba em ${falta}`, tom: 'fraco' }] } });
  }
  if (s.upg_desc_ate && Date.parse(s.upg_desc_ate) > agoraMs) {
    const falta = mmss(Date.parse(s.upg_desc_ate) - agoraMs);
    out.push({ texto: `Melhorias −25% · ${falta}`, ouro: false, dica: { titulo: 'Atualização instalada', linhas: [
      { texto: 'Melhorias 25% mais baratas (junta com Promoção e Horta)' }, { texto: `Acaba em ${falta}`, tom: 'fraco' }] } });
  }
  // dourados novos e Caixinha (0076): LinkedIn, Combo (e as bolinhas do que está em andamento), Cupom, Cashback e o Chamar.
  // LinkedIn sem gerador rendendo: o banco grava gen null e mult 1 (e o fim); aí não tem o que mostrar
  if (s.linkedin_ate && s.linkedin_gen && (s.linkedin_mult ?? 1) > 1 && Date.parse(s.linkedin_ate) > agoraMs) {
    const falta = mmss(Date.parse(s.linkedin_ate) - agoraMs);
    const nome = catalogo.geradores[s.linkedin_gen - 1]?.nome ?? 'Gerador';
    out.push({ texto: `${nome} ×${LINKEDIN_MULT} · ${falta}`, ouro: false, dica: { titulo: 'Bombou no LinkedIn', linhas: [
      { texto: `${nome} rende ×${LINKEDIN_MULT}` }, { texto: `Produção ×${dois(s.linkedin_mult!)} no total` },
      { texto: `Acaba em ${falta}`, tom: 'fraco' }] } });
  }
  if (s.combo_ate && Date.parse(s.combo_ate) > agoraMs) {
    const falta = mmss(Date.parse(s.combo_ate) - agoraMs);
    out.push({ texto: `Combo ×${COMBO_MULT} · ${falta}`, ouro: true, dica: { titulo: 'Combo', linhas: [
      { texto: `Produção ×${COMBO_MULT}, por cima de todo o resto` }, { texto: `Acaba em ${falta}`, tom: 'fraco' }] } });
  }
  const cupons = s.cupons ?? 0;
  if (cupons > 0) {
    out.push({ texto: `Cupom · ${cupons} ${cupons === 1 ? 'restante' : 'restantes'}`, ouro: false, dica: { titulo: 'Cupom de primeira compra', linhas: [
      { texto: 'Cada compra de gerador (1, 10 ou Máx) sai 25% mais barata' },
      { texto: `Faltam ${cupons} ${cupons === 1 ? 'compra' : 'compras'}` },
      { texto: 'Com Promoção ou meia-preço o cupom fica guardado', tom: 'fraco' }] } });
  }
  if (s.cashback_ate && Date.parse(s.cashback_ate) > agoraMs) {
    const falta = mmss(Date.parse(s.cashback_ate) - agoraMs);
    out.push({ texto: `Cashback 30% · ${falta}`, ouro: false, dica: { titulo: 'Cashback', linhas: [
      { texto: 'Toda compra devolve 30% do preço na hora' }, { texto: `Acaba em ${falta}`, tom: 'fraco' }] } });
  }
  // as bolinhas do combo em andamento: pontos soltos depois dos selos (não são selo; tela: selosTela)
  const n = o.combo ?? 0;
  if (n > 0 && n < COMBO_PRECISA) {
    const resta = COMBO_PRECISA - n;
    const dur = o.duracao ?? 1;
    out.push({ texto: '●'.repeat(n) + '○'.repeat(resta), ouro: false, classe: 'combo-bolinhas', dica: { titulo: 'Combo em andamento', linhas: [
      { texto: `Pegue mais ${resta} sem deixar nenhum sumir: produção ×${COMBO_MULT} por ${dois(dur)} min` }] } });
  }
  // o único selo que é botão: roxo cheio (ação), não dourado
  const chamados = s.chamados ?? 0;
  if (chamados > 0) {
    out.push({ texto: `Chamar dourado (${chamados})`, ouro: false, acao: 'chamar', dica: { titulo: 'Chamar um dourado', linhas: [
      { texto: 'Clique: um dourado aparece no segundo seguinte (sem Pix nem Tigrinho)' },
      { texto: `Você tem ${chamados} de ${CHAMADOS_MAX}`, tom: 'fraco' }] } });
  }
  return out;
}

/** O texto que sobe quando pega: quanto ganhou (Investidor), a Promoção, o Viralizou (×100 quando são dois). */
/** O que o Investidor apressado paga (igual a idle_dourado_pegar na 0061): 20 min da produção `rate`, × o Investidor anjo
 *  (`investidor`) e × (1 + o bônus de oportunidades da horta). */
export const ganhoInvestidor = (rate: number, investidor: number, hortaOportunidades: number) =>
  rate * 1200 * investidor * (1 + hortaOportunidades);

export function textoPegou(tipo: TipoDourado, o: { ganho: number; viral: number; duracao?: number }): string {
  const d = o.duracao ?? 1; // Hype de lançamento: 2
  if (tipo === 0) return `+${formatarValor(o.ganho)}`;
  if (tipo === 1) return `Promoção! Tudo pela metade por ${d === 1 ? '30 s' : `${(d / 2).toLocaleString('pt-BR')} min`}`;
  return o.viral >= 2 ? `×${vezes(o.viral)}!` : `Viralizou! ×10 por ${d.toLocaleString('pt-BR')} min`;
}

/** As frases do post de coach que sobem com o LinkedIn (uma por sorteio). */
export const FRASES_LINKEDIN = [
  'O Estagiário me ensinou mais sobre liderança do que meu MBA',
  'Fui demitido. Melhor coisa que me aconteceu. #gratidão',
  'Acordo às 4h. Meu concorrente ainda está dormindo',
  'Recusei uma oferta do Google pra seguir meu propósito',
] as const;
export const fraseLinkedin = (uid: string, seg: number): string => FRASES_LINKEDIN[sorteioDourado(uid, seg, SAL.frase, FRASES_LINKEDIN.length)];

/** O que o rolo do Tigrinho faz com a resposta do banco: para em PAGOU (true) ou COMEU (false); qualquer outra resposta
 *  (outro tipo, ou sem `dourado`, de um banco de antes da 0076) é null: o rolo só sai. */
export const resultadoTigre = (d?: DouradoPago | null): boolean | null => (d?.tipo === 7 ? !!d.tigre?.pagou : null);

/** O texto que sobe quando pega (com o que o banco pagou). `viral` = os Viralizou valendo depois; `duracao` = o Hype. */
export function textoDourado(d: DouradoPago, o: { viral: number; duracao: number; frase: string }): string {
  if (d.tipo <= 3) return textoPegou(d.tipo as TipoDourado, { ganho: d.ganho, viral: o.viral, duracao: o.duracao * (d.dobro ? 2 : 1) });
  if (d.tipo === 4) return `${d.moedas} ${d.moedas === 1 ? 'moedinha' : 'moedinhas'}! +${formatarValor(d.ganho)}`;
  if (d.tipo === 5) return o.frase;
  if (d.tipo === 6) return d.lado === 1 ? 'Devolveu! Deus te pague (em até 2 min)' : `+${formatarValor(d.ganho)} (ninguém viu)`;
  return d.tigre?.pagou ? `Pagou! +${formatarValor(d.ganho)}` : `O tigre comeu ${formatarValor(d.tigre?.perdeu ?? 0)}. Só mais uma?`;
}
