// Links assinados das fotos dos fellas (bucket privado), guardados no aparelho na mesma chave do app
// (lib/api/storage.ts SIGNED_URL_KEY): o mesmo link por dias deixa o navegador reaproveitar a foto já baixada. Assinar a
// cada chamada gerava link novo e baixava tudo de novo (estourou o tráfego do plano grátis em out/2026).

export const CHAVE_FOTOS = 'fellas:fotos-assinadas:v1';
/** 7 dias, como o app. */
const VALIDADE_S = 7 * 24 * 3600;
/** Assina de novo quando faltar menos de 1 dia. */
const RENOVA_MS = 24 * 3600 * 1000;

type Guardado = { url: string; expiresAt: number };
type Assinar = (caminhos: string[], ttl: number) => Promise<{ path: string | null; signedUrl: string | null }[]>;

const valido = (v: unknown): v is Guardado =>
  !!v && typeof (v as Guardado).url === 'string' && typeof (v as Guardado).expiresAt === 'number';

function ler(): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_FOTOS) ?? '{}') as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Caminho -> link assinado; reaproveita o guardado e assina só o que falta (de uma vez). */
export async function assinarFotos(caminhos: string[], assinar: Assinar): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unicos = [...new Set(caminhos)];
  if (!unicos.length) return out;
  const agora = Date.now();
  const guardado = ler();
  const faltam: string[] = [];
  for (const c of unicos) {
    const g = guardado[c];
    if (valido(g) && g.expiresAt - agora > RENOVA_MS) out.set(c, g.url);
    else faltam.push(c);
  }
  if (!faltam.length) return out;
  const expiresAt = agora + VALIDADE_S * 1000;
  for (const u of await assinar(faltam, VALIDADE_S)) {
    if (u.path && u.signedUrl) {
      out.set(u.path, u.signedUrl);
      guardado[u.path] = { url: u.signedUrl, expiresAt };
    }
  }
  const limpo = Object.fromEntries(Object.entries(guardado).filter(([, v]) => valido(v) && v.expiresAt > agora));
  try {
    localStorage.setItem(CHAVE_FOTOS, JSON.stringify(limpo));
  } catch {
    // aparelho sem espaço: segue sem guardar
  }
  return out;
}
