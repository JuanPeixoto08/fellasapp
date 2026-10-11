// Preferências da Fellas Inc. guardadas no aparelho (nada no banco): volume da música, efeitos, avisos e a última patch note lida.
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

export type ChaveSom = 'efeitos' | 'avisos';
const CHAVES: Record<ChaveSom, string> = { efeitos: 'fellas:idle-efeitos', avisos: 'fellas:idle-avisos' };
const VOLUME = 'fellas:idle-musica-vol';
const MUSICA_ANTIGA = 'fellas:idle-musica'; // a chave liga/desliga de antes da barra
/** Cada chave começa ligada; '0' = desligada. */
export const lerChave = (q: ChaveSom) => ler(CHAVES[q]) !== '0';
export const gravarChave = (q: ChaveSom, ligada: boolean) => gravar(CHAVES[q], ligada ? '1' : '0');

/** Volume da música, de 0 (desligada) a 1; começa em 1 (quem tinha desligado a música na chave antiga começa em 0). */
export function lerVolumeMusica(): number {
  const v = ler(VOLUME);
  if (v === null) return ler(MUSICA_ANTIGA) === '0' ? 0 : 1;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
}
export const gravarVolumeMusica = (v: number) => gravar(VOLUME, String(Math.max(0, Math.min(1, v))));

/** Id da última versão das patch notes que a pessoa abriu (null = nunca abriu). */
export const lerVista = () => ler(VISTA);
export const marcarVista = () => gravar(VISTA, NOVIDADES[0].id);
