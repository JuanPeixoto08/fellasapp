// Preferências da Fellas Inc. guardadas no aparelho (nada no banco): música, efeitos, avisos e a última patch note lida.
import { NOVIDADES } from './novidades';

const VISTA = 'fellas:idle-novidades-vista';

function ler(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null; // navegador sem storage (aba anônima travada): fica o padrão
  }
}
function gravar(chave: string, valor: string) {
  try {
    localStorage.setItem(chave, valor);
  } catch {
    // sem storage: vale só até fechar a página
  }
}

export type ChaveSom = 'musica' | 'efeitos' | 'avisos';
const CHAVES: Record<ChaveSom, string> = { musica: 'fellas:idle-musica', efeitos: 'fellas:idle-efeitos', avisos: 'fellas:idle-avisos' };
/** Cada chave começa ligada; '0' = desligada. */
export const lerChave = (q: ChaveSom) => ler(CHAVES[q]) !== '0';
export const gravarChave = (q: ChaveSom, ligada: boolean) => gravar(CHAVES[q], ligada ? '1' : '0');

/** Id da última versão das patch notes que a pessoa abriu (null = nunca abriu). */
export const lerVista = () => ler(VISTA);
export const marcarVista = () => gravar(VISTA, NOVIDADES[0].id);
