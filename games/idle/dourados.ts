// Eventos na tela (tipo cookie dourado): a cada segundo há chance 1/600 de aparecer um (mais com o ramo Dourados da
// árvore ou o Gemaplys), pra quem está com o jogo aberto, e ele some em 12 s (24 com o Olho de lince). A sorte tem semente (id do jogador + segundo) e é a mesma conta do banco
// (idle_dourado na 0045), que confere o clique. BigInt: os quadrados passam de 2^53.
import { formatarValor } from './formatar';
import { semente } from './oportunidades';

export const TIPOS_DOURADO = ['investidor', 'promocao', 'viralizou', 'dupla'] as const;
/** 0 Investidor apressado · 1 Promoção relâmpago · 2 Viralizou · 3 dupla de Viralizou. */
export type TipoDourado = 0 | 1 | 2 | 3;
/** Quanto tempo o evento fica na tela (s); o banco aceita até 15 s (folga da rede). */
export const JANELA_S = 12;

const P = 2147483647n;
const K = 1013904223n;
const mistura = (x: bigint) => (x * x + K) % P;

function h1(uid: string, s: number): bigint {
  const b = BigInt(s);
  return (b * b * 48271n + b * 16807n + BigInt(semente(uid)) * 69621n + 12345n) % P;
}

/** O tipo sorteado pro segundo `s` (vale pros eventos da sorte e pras faixas do MC V.V). */
export function tipoDourado(uid: string, s: number): TipoDourado {
  const r = Number(mistura(mistura(h1(uid, s))) % 100n);
  return r < 2 ? 3 : r < 20 ? 2 : r < 55 ? 1 : 0;
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
type ComBonus = { promo_ate: string | null; viral?: readonly string[] };
const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** 10^k em pt-BR: 10, 100, 1.000… (cada Viralizou ativo multiplica ×10, sem teto). */
const vezes = (k: number) => (10 ** k).toLocaleString('pt-BR');

/** Promoção relâmpago valendo agora (o custo das compras cai pela metade). */
export const promoAtiva = (s: { promo_ate: string | null }, agoraMs: number) => s.promo_ate !== null && Date.parse(s.promo_ate) > agoraMs;

/** Os fins dos Viralizou ainda ativos (ms), em ordem. */
export const viraisAtivos = (s: ComBonus, agoraMs: number) => (s.viral ?? []).map(Date.parse).filter((f) => f > agoraMs).sort((a, b) => a - b);

/** Selos ao lado do F$: "×10 · 0:42", "×100 · 0:15" (dourado a partir de dois, até o primeiro acabar), "Metade · 0:21". */
export function selosBonus(s: ComBonus, agoraMs: number): { texto: string; ouro: boolean }[] {
  const out: { texto: string; ouro: boolean }[] = [];
  const v = viraisAtivos(s, agoraMs);
  if (v.length) out.push({ texto: `×${vezes(v.length)} · ${mmss(v[0] - agoraMs)}`, ouro: v.length >= 2 });
  if (promoAtiva(s, agoraMs)) out.push({ texto: `Metade · ${mmss(Date.parse(s.promo_ate!) - agoraMs)}`, ouro: false });
  return out;
}

/** O texto que sobe quando pega: quanto ganhou (Investidor), a Promoção, o Viralizou (×100 quando são dois). */
export function textoPegou(tipo: TipoDourado, o: { ganho: number; viral: number; duracao?: number }): string {
  const d = o.duracao ?? 1; // Hype de lançamento: 2
  if (tipo === 0) return `+${formatarValor(o.ganho)}`;
  if (tipo === 1) return `Promoção! Tudo pela metade por ${d === 1 ? '30 s' : `${(d / 2).toLocaleString('pt-BR')} min`}`;
  return o.viral >= 2 ? `×${vezes(o.viral)}!` : `Viralizou! ×10 por ${d.toLocaleString('pt-BR')} min`;
}
