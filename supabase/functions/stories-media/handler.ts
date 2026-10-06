import {
  allowedOrigin,
  basicAuth,
  deleteUrl,
  isExpired,
  listUrl,
  randomMediaId,
  resourceType,
  stringToSign,
  TRANSFORMATIONS,
  uploadUrl,
  type Kind,
  type ResourceType,
} from './rules.ts';

export type Env = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  STORIES_CRON_SECRET: string;
};
export type Deps = {
  fetch: typeof fetch;
  uuid: () => string;
  sha1Hex: (text: string) => Promise<string>;
  now: () => Date;
};

async function sha1Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

const defaults: Deps = {
  fetch: (...a) => fetch(...a),
  uuid: () => crypto.randomUUID(),
  sha1Hex,
  now: () => new Date(),
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Lote máximo do delete_resources da Admin API. */
const DELETE_BATCH = 100;

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

async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const restHeaders = (env: Env, token: string, extra: Record<string, string> = {}) => ({
  apikey: env.SUPABASE_ANON_KEY,
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  ...extra,
});

async function isMember(env: Env, token: string, deps: Deps): Promise<boolean | 'unauthorized' | 'failed'> {
  const res = await deps.fetch(`${env.SUPABASE_URL}/rest/v1/rpc/is_member`, {
    method: 'POST',
    headers: restHeaders(env, token),
    body: '{}',
  });
  if (res.status === 401) return 'unauthorized';
  if (!res.ok) return 'failed';
  return (await res.json()) === true;
}

async function sign(req: Request, env: Env, deps: Deps): Promise<Response> {
  const token = bearer(req);
  if (!token) return reply(req, 401, { error: 'sem login' });
  const member = await isMember(env, token, deps);
  if (member === 'unauthorized') return reply(req, 401, { error: 'login inválido' });
  if (member === 'failed') return reply(req, 502, { error: 'is_member falhou' });
  if (!member) return reply(req, 403, { error: 'só membros' });
  const { kind } = await body(req);
  if (kind !== 'photo' && kind !== 'video') return reply(req, 400, { error: 'kind inválido' });
  const params = {
    eager: TRANSFORMATIONS[kind as Kind],
    eager_async: 'true',
    public_id: randomMediaId(deps.uuid),
    timestamp: String(Math.floor(deps.now().getTime() / 1000)),
  };
  const signature = await deps.sha1Hex(stringToSign(params) + env.CLOUDINARY_API_SECRET);
  return reply(req, 200, {
    uploadUrl: uploadUrl(env.CLOUDINARY_CLOUD_NAME, kind as Kind),
    fields: { ...params, api_key: env.CLOUDINARY_API_KEY, signature },
  });
}

async function remove(req: Request, env: Env, deps: Deps): Promise<Response> {
  const token = bearer(req);
  if (!token) return reply(req, 401, { error: 'sem login' });
  const { storyId } = await body(req);
  if (typeof storyId !== 'string' || !UUID_RE.test(storyId)) return reply(req, 400, { error: 'storyId inválido' });
  const url = `${env.SUPABASE_URL}/rest/v1/stories?id=eq.${storyId}`;
  // a RLS só deixa o dono apagar: a linha volta só se era dele
  const del = await deps.fetch(`${url}&select=id,kind,media_id`, {
    method: 'DELETE',
    headers: restHeaders(env, token, { Prefer: 'return=representation' }),
  });
  if (del.status === 401) return reply(req, 401, { error: 'login inválido' });
  if (!del.ok) return reply(req, 500, { error: 'não apagou' });
  const [row] = (await del.json()) as { kind: Kind; media_id: string }[];
  if (!row) {
    const look = await deps.fetch(`${url}&select=id`, { headers: restHeaders(env, token) });
    const found = look.ok ? ((await look.json()) as unknown[]).length > 0 : false;
    return reply(req, found ? 403 : 404, { error: found ? 'não é seu' : 'não existe' });
  }
  // o arquivo: falhou, segue (a limpeza das 24 h pega)
  await deps
    .fetch(deleteUrl(env.CLOUDINARY_CLOUD_NAME, resourceType(row.kind), [row.media_id]), {
      method: 'DELETE',
      headers: { Authorization: basicAuth(env.CLOUDINARY_API_KEY, env.CLOUDINARY_API_SECRET) },
    })
    .catch(() => null);
  return reply(req, 200, { ok: true });
}

async function cleanup(req: Request, env: Env, deps: Deps): Promise<Response> {
  const secret = req.headers.get('x-cron-secret');
  if (!env.STORIES_CRON_SECRET || secret !== env.STORIES_CRON_SECRET) return reply(req, 401, { error: 'segredo' });
  const auth = { Authorization: basicAuth(env.CLOUDINARY_API_KEY, env.CLOUDINARY_API_SECRET) };
  const now = deps.now();
  let deleted = 0;
  for (const type of ['image', 'video'] as ResourceType[]) {
    const expired: string[] = [];
    let cursor: string | undefined;
    do {
      const res = await deps.fetch(listUrl(env.CLOUDINARY_CLOUD_NAME, type, cursor), { headers: auth });
      if (!res.ok) return reply(req, 502, { error: `listar ${type}`, deleted });
      const page = (await res.json()) as { resources?: { public_id: string; created_at: string }[]; next_cursor?: string };
      for (const r of page.resources ?? []) if (isExpired(r.created_at, now)) expired.push(r.public_id);
      cursor = page.next_cursor;
    } while (cursor);
    for (let i = 0; i < expired.length; i += DELETE_BATCH) {
      const ids = expired.slice(i, i + DELETE_BATCH);
      const res = await deps.fetch(deleteUrl(env.CLOUDINARY_CLOUD_NAME, type, ids), { method: 'DELETE', headers: auth });
      if (!res.ok) return reply(req, 502, { error: `apagar ${type}`, deleted });
      deleted += ids.length;
    }
  }
  return reply(req, 200, { deleted });
}

/** Rotas pelo fim do caminho (o Supabase entrega /stories-media/<rota>). */
export async function handle(req: Request, env: Env, deps: Deps = defaults): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  const { pathname } = new URL(req.url);
  if (req.method === 'POST' && pathname.endsWith('/sign')) return sign(req, env, deps);
  if (req.method === 'POST' && pathname.endsWith('/delete')) return remove(req, env, deps);
  if (req.method === 'POST' && pathname.endsWith('/cleanup')) return cleanup(req, env, deps);
  return reply(req, 404, { error: 'não existe' });
}
