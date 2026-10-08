import { allowedOrigin, parseReviews, rssUrl } from './rules.ts';

export type Env = { SUPABASE_URL: string; SUPABASE_ANON_KEY: string };
export type Deps = { fetch: typeof fetch };

const defaults: Deps = { fetch: (...a) => fetch(...a) };

/** O feed raramente passa de 300 KB; acima disso algo está errado. */
const MAX_FEED_BYTES = 1_000_000;
const FEED_TIMEOUT_MS = 8000;

function cors(req: Request): Record<string, string> {
  const origin = allowedOrigin(req.headers.get('Origin'));
  return origin
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
        Vary: 'Origin',
      }
    : {};
}

const reply = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } });

const bearer = (req: Request) => /^Bearer (.+)$/.exec(req.headers.get('Authorization') ?? '')?.[1] ?? null;

const rest = (env: Env, token: string) => ({ apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` });

/**
 * As reviews do Letterboxd de quem chama. Não recebe usuário nem endereço: lê o `letterboxd_user` do próprio
 * perfil (com o login de quem chama) e busca só o feed público dele, host fixo, sem seguir redirecionamento.
 */
async function reviews(req: Request, env: Env, deps: Deps): Promise<Response> {
  const token = bearer(req);
  if (!token) return reply(req, 401, { error: 'unauthorized' });

  const who = await deps.fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: rest(env, token) });
  if (!who.ok) return reply(req, 401, { error: 'unauthorized' });
  const { id } = (await who.json()) as { id?: string };
  if (!id) return reply(req, 401, { error: 'unauthorized' });

  const member = await deps.fetch(`${env.SUPABASE_URL}/rest/v1/rpc/is_member`, {
    method: 'POST',
    headers: { ...rest(env, token), 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!member.ok) return reply(req, 502, { error: 'unavailable' });
  if ((await member.json()) !== true) return reply(req, 403, { error: 'forbidden' });

  const profile = await deps.fetch(
    `${env.SUPABASE_URL}/rest/v1/profiles?select=letterboxd_user&id=eq.${encodeURIComponent(id)}`,
    { headers: rest(env, token) },
  );
  if (!profile.ok) return reply(req, 502, { error: 'unavailable' });
  const [row] = (await profile.json()) as { letterboxd_user: string | null }[];
  const url = row?.letterboxd_user ? rssUrl(row.letterboxd_user) : null;
  if (!url) return reply(req, 409, { error: 'no_user' });

  let feed: Response;
  try {
    feed = await deps.fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
      headers: { 'User-Agent': 'fellasapp (reviews do próprio usuário)', Accept: 'application/rss+xml' },
    });
  } catch {
    return reply(req, 502, { error: 'unavailable' });
  }
  if (feed.status === 404) return reply(req, 404, { error: 'not_found' });
  if (feed.status !== 200) return reply(req, 502, { error: 'unavailable' });
  const xml = await feed.text();
  if (xml.length > MAX_FEED_BYTES) return reply(req, 502, { error: 'unavailable' });
  return reply(req, 200, { reviews: parseReviews(xml) });
}

export async function handle(req: Request, env: Env, deps: Deps = defaults): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  if (req.method === 'POST') return reviews(req, env, deps);
  return reply(req, 405, { error: 'method' });
}
