// Estado da tela da Fellas Inc.: tudo que o banco devolve fica ancorado no relógio DELE (server_now), não no do
// celular. O número anima com a mesma conta do banco (economia.ts acumular).
import type { IdleState } from '../shared/types';
import { catalogo } from './catalogo';
import { acumular, efeitosArvore, efeitosDe, estrategiasAtivas, type FatorTempo, VIRAL_MS } from './economia';
import { COMBO_MULT } from './dourados';
import { SILVER_MULT } from './eventosEra';
import { CAIXA_PADRAO, type Caixa } from './oportunidades';
import type { NomeCena } from './palco';
import { ERAS } from './nomes';

export type Fase = 'carregando' | 'sem_sessao' | 'antes' | 'abrindo' | 'jogando';
export type Ancora = { estado: IdleState; clienteMs: number; servidorMs: number };

export const ancorar = (estado: IdleState, clienteMs: number): Ancora => ({ estado, clienteMs, servidorMs: Date.parse(estado.server_now) });
export const agoraServidor = (a: Ancora, clienteMs: number) => a.servidorMs + (clienteMs - a.clienteMs);

/** Segunda 00:00 de Brasília da semana do estado, em ms (para `pendentes(..., inicioSemanaMs)`). */
export const inicioSemana = (estado: IdleState): number => Date.parse(estado.week_start + 'T00:00:00-03:00');

/** O que a árvore do estado faz (caixinha, eventos, horta…): a mesma conta do banco. */
export const efeitos = (estado: IdleState) => efeitosDe(catalogo, estado);
/** A caixinha de oportunidades: o tamanho vem da árvore; a validade é sempre a padrão (4h). */
export const caixa = (estado: IdleState): Caixa => ({ tamanho: efeitos(estado).caixinha, validadeS: CAIXA_PADRAO.validadeS });

/** Os bônus com tempo do estado que multiplicam a produção toda: LinkedIn (o mult que o banco congelou) e Combo (0076) e o
 *  Silver tape do Houston (0078). */
export function fatoresTempo(s: Pick<IdleState, 'linkedin_ate' | 'linkedin_mult' | 'combo_ate' | 'silver_ate'>, silverMult = SILVER_MULT): FatorTempo[] {
  const out: FatorTempo[] = [];
  if (s.linkedin_ate && s.linkedin_mult) out.push({ ateMs: Date.parse(s.linkedin_ate), mult: s.linkedin_mult });
  if (s.combo_ate) out.push({ ateMs: Date.parse(s.combo_ate), mult: COMBO_MULT });
  if (s.silver_ate) out.push({ ateMs: Date.parse(s.silver_ate), mult: silverMult }); // ×5 com a Fita prateada (0082)
  return out;
}

export function valuationAgora(a: Ancora, clienteMs: number): number {
  // os ×5 no ar (0062: cada um conta); a resposta de antes da 0062 só tem o boost_until
  const boost = a.estado.boosts ? a.estado.boosts.map(Date.parse) : a.estado.boost_until ? Date.parse(a.estado.boost_until) : null;
  const virais = (a.estado.viral ?? []).map(Date.parse); // Viralizou: ×10 cada (sem teto), igual ao banco
  const marmita = a.estado.marmita_ate ? Date.parse(a.estado.marmita_ate) : null; // Marmita da mãe: ×3 (0074)
  return acumular(a.estado.valuation, a.estado.rate, a.servidorMs, agoraServidor(a, clienteMs), boost, virais,
    VIRAL_MS * efeitos(a.estado).douradoDuracao, marmita, fatoresTempo(a.estado, efeitos(a.estado).silverMult));
}

export function faseDoEstado(estado: IdleState, atual: Fase): Fase {
  if (!estado.started) return 'antes';
  return atual === 'abrindo' ? 'abrindo' : 'jogando';
}

export function cenaDoEstado(estado: IdleState, fase: Fase): NomeCena {
  if (fase === 'antes' || !estado.started) return 'cena-0-antes';
  if (estado.era >= 7) return 'cena-7';
  if (estado.era === 6 || (estado.generators[29] ?? 0) > 0) return 'cena-6';
  return `cena-${Math.min(Math.max(estado.era, 1), 5)}` as NomeCena;
}

export function estrategiaPendente(estado: IdleState): number | null {
  // posição que falta (resposta de antes da 0078, com 4 estratégias) conta como não escolhida
  return estado.started && estado.era >= 2 && (estado.strategies[estado.era - 2] ?? -1) < 0 ? estado.era : null;
}

/** O editor de personagem abre sozinho até o primeiro "Bora": sem avatar salvo, sem fechar no X nesta sessão, sem rascunho
 *  aberto, fora da cena de abrir e sem a folha de estratégia por cima. */
export function deveAbrirEditor(estado: IdleState, fase: Fase, editorFechado: boolean, rascunhoAberto: boolean): boolean {
  if (estado.avatar || editorFechado || rascunhoAberto) return false;
  if (fase === 'antes') return true;
  return fase === 'jogando' && estrategiaPendente(estado) === null;
}

/** Quanto a oportunidade fica na cena (s): o maior entre o da estratégia (Rolê eterno) e o dos nós da árvore (Print de tudo). */
export function segundosOportunidade(estado: IdleState, arvore: readonly number[] = []): number {
  return Math.max(efeitosArvore(catalogo, arvore).oppSegundos, ...estrategiasAtivas(catalogo, estado).map((e) => e.oppSegundos));
}

/** Um contrato seu venceu (o relógio do servidor passou de muda_em): a taxa mudou e a tela precisa bater o ponto. */
export const vencido = (estado: IdleState, agoraServidorMs: number): boolean =>
  estado.muda_em !== null && agoraServidorMs >= Date.parse(estado.muda_em);

/** O nome da era: "Era 5 · Sede". Só com o gerador 30 (ainda na era 5) a cena já é a da órbita e o nome acompanha: "Era 6 ·
 *  Em órbita" (estratégias e conquistas ainda são da 5). Da era 6 em diante, o nome da era de verdade. `curto` = só o nome. */
export function rotuloEra(era: number, orbita: boolean, curto = false): string {
  const [n, nome] = orbita && era < 6 ? [6, ERAS[5]] : [era, ERAS[era - 1]];
  return curto ? nome : `Era ${n} · ${nome}`;
}

/** O monolito (conquista escondida 158) aparece na cena da Lua. */
export const CONQUISTA_MONOLITO = 158;
/** As peças de cena que aparecem (ids do JSON das vagas): "g31"… de cada gerador das eras 6+ que você tem e o monolito. */
export function pecasVisiveis(estado: IdleState): string[] {
  const out: string[] = [];
  estado.generators.forEach((n, i) => {
    if (i >= 30 && n > 0) out.push(`g${i + 1}`);
  });
  if (estado.conquistas.some((c) => c.id === CONQUISTA_MONOLITO)) out.push('monolito');
  return out;
}

