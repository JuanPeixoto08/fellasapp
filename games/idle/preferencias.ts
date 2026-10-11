// Preferências da Fellas Inc. guardadas no aparelho (nada no banco): som e a última patch note lida.
import { NOVIDADES } from './novidades';

const SOM = 'fellas:idle-som';
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

/** Som ligado? Começa ligado; o som do jogo (quando existir) lê daqui. */
export const lerSom = () => ler(SOM) !== '0';
export const gravarSom = (ligado: boolean) => gravar(SOM, ligado ? '1' : '0');

/** Id da última versão das patch notes que a pessoa abriu (null = nunca abriu). */
export const lerVista = () => ler(VISTA);
export const marcarVista = () => gravar(VISTA, NOVIDADES[0].id);
