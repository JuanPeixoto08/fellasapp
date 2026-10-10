// Página de jogo aberta há tempo (aba esquecida, APK em segundo plano): ao abrir e ao voltar pra aba, confere se saiu
// versão nova e recarrega sozinha, como o AppUpdater do app. Cada publicação gera o bundle do jogo com outro nome
// (`/games/assets/<jogo>-<hash>.js`); comparando o da página aberta com o do index.html do servidor dá pra saber se
// mudou. Sem isso, uma aba velha falava com o banco novo (ex.: placar ordenado por R$/s mostrando o valuation).

const BUNDLE = /<script[^>]*\ssrc="(\/games\/assets\/[A-Za-z0-9_.-]+\.js)"/;
const CHAVE = 'fellas.jogoRecarregadoPara';
/** Intervalo mínimo entre duas conferências (voltar pra aba várias vezes seguidas não vira várias buscas). */
export const INTERVALO_MS = 60_000;

/** O bundle que um index.html de jogo carrega, ou null. */
export function bundleDe(html: string): string | null {
  return html.match(BUNDLE)?.[1] ?? null;
}

/** O bundle da página aberta agora, ou null (no dev o Vite não usa esse nome). */
export function bundleAberto(doc: Document = document): string | null {
  for (const s of Array.from(doc.querySelectorAll('script[src]'))) {
    const src = s.getAttribute('src') ?? '';
    if (/^\/games\/assets\/[A-Za-z0-9_.-]+\.js$/.test(src)) return src;
  }
  return null;
}

/** Busca o index.html da página sem cache: devolve o bundle novo, ou null (igual, erro de rede ou dev). */
export async function versaoNova(
  fetchImpl: typeof fetch = fetch,
  doc: Document = document,
  caminho: string = location.pathname,
): Promise<string | null> {
  const meu = bundleAberto(doc);
  if (!meu) return null;
  try {
    const res = await fetchImpl(caminho, { cache: 'no-store' });
    if (!res.ok) return null;
    const ultimo = bundleDe(await res.text());
    return ultimo && ultimo !== meu ? ultimo : null;
  } catch {
    return null;
  }
}

/** Trava contra recarregar sem parar se a página recarregada ainda vier velha (cache logo depois de publicar). */
function jaRecarreguei(bundle: string): boolean {
  try {
    return sessionStorage.getItem(CHAVE) === bundle;
  } catch {
    return false;
  }
}

function marcar(bundle: string): void {
  try {
    sessionStorage.setItem(CHAVE, bundle);
  } catch {
    // sem armazenamento: segue sem a trava
  }
}

/** Liga a conferência: agora e toda vez que a aba volta a ficar visível (no máximo uma por minuto). */
export function vigiarVersao(recarregar: () => void = () => location.reload(), fetchImpl: typeof fetch = fetch): () => void {
  let ultima = -INTERVALO_MS;
  let conferindo = false;
  const conferir = () => {
    if (conferindo || Date.now() - ultima < INTERVALO_MS) return;
    conferindo = true;
    ultima = Date.now();
    void versaoNova(fetchImpl)
      .then((novo) => {
        if (!novo || jaRecarreguei(novo)) return;
        marcar(novo);
        recarregar();
      })
      .finally(() => {
        conferindo = false;
      });
  };
  const aoMudar = () => {
    if (document.visibilityState === 'visible') conferir();
  };
  conferir();
  document.addEventListener('visibilitychange', aoMudar);
  return () => document.removeEventListener('visibilitychange', aoMudar);
}
