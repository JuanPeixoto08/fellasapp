// Sons que a chegada de um estado novo pede: o que mudou sem ser um clique seu (era nova, alguém te contratou), e o
// tamanho de uma compra (pra cascata de moedas).
import type { IdleState } from '../../shared/types';
import type { IdEfeito } from './efeitos';

export function sonsDaMudanca(antes: IdleState | null, depois: IdleState): IdEfeito[] {
  if (!antes || antes.user_id !== depois.user_id) return [];
  const sons: IdEfeito[] = [];
  if (depois.era > antes.era) sons.push(antes.era < 6 && depois.era >= 6 ? 'zaratustra' : 'era'); // a fanfarra ao sair da atmosfera (gerador 31) // vender a startup volta a era: isso tem o som da venda
  const chefes = new Set(antes.chefes.map((c) => c.user_id));
  if (depois.chefes.some((c) => !chefes.has(c.user_id))) sons.push('contratado');
  return sons;
}

export function quantasCompradas(antes: IdleState | null, depois: IdleState, tipo: 'gerador' | 'melhoria', id: number): number {
  if (!antes || tipo !== 'gerador') return 1;
  return Math.max(1, (depois.generators[id - 1] ?? 0) - (antes.generators[id - 1] ?? 0));
}

/** A melhoria "Valsa do Danúbio Azul na acoplagem" (gerador 33, nível 1). */
export const MELHORIA_VALSA = 331;
/** O som da compra: a valsa na melhoria dela; senão a moeda (ou a cascata, se foram várias). */
export function somDaCompra(tipo: 'gerador' | 'melhoria', id: number, quantas: number): IdEfeito {
  if (tipo === 'melhoria' && id === MELHORIA_VALSA) return 'valsa';
  return quantas > 1 ? 'compraMuitas' : 'compra';
}
