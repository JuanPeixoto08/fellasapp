/**
 * Versão nova do site (web/PWA/APK, que é o site numa casca do Chrome): cada publicação gera um bundle
 * `entry-<hash>.js` com outro nome. Comparando o da página aberta com o do index.html do servidor dá pra saber
 * se saiu atualização sem precisar de arquivo de versão.
 */
const ENTRY = /\/_expo\/static\/js\/web\/entry-[A-Za-z0-9]+\.js/;

/** O bundle que um index.html carrega, ou null. */
export function entryOf(html: string): string | null {
  return html.match(ENTRY)?.[0] ?? null;
}

/** O bundle da página aberta agora (null fora da web ou no modo dev, que não usa esse nome). */
export function loadedEntry(): string | null {
  if (typeof document === 'undefined') return null;
  for (const script of Array.from(document.querySelectorAll('script[src]'))) {
    const found = entryOf(script.getAttribute('src') ?? '');
    if (found) return found;
  }
  return null;
}

/**
 * Confere no servidor (sem cache) se o index.html já aponta pra outro bundle: devolve o bundle novo, ou null.
 * Erro de rede = sem novidade.
 */
export async function newVersion(fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const mine = loadedEntry();
  if (!mine) return null;
  try {
    const res = await fetchImpl('/', { cache: 'no-store' });
    if (!res.ok) return null;
    const latest = entryOf(await res.text());
    return latest && latest !== mine ? latest : null;
  } catch {
    return null;
  }
}

const RELOADED_KEY = 'fellas.reloadedFor';

/**
 * Já recarreguei por causa desse bundle nesta aba? Trava contra recarregar sem parar se a página recarregada
 * ainda vier velha (cache no caminho logo depois de publicar). Sem sessionStorage, deixa recarregar.
 */
export function alreadyReloadedFor(entry: string): boolean {
  try {
    return globalThis.sessionStorage?.getItem(RELOADED_KEY) === entry;
  } catch {
    return false;
  }
}

export function markReloadedFor(entry: string): void {
  try {
    globalThis.sessionStorage?.setItem(RELOADED_KEY, entry);
  } catch {
    // sem armazenamento: segue sem a trava
  }
}
