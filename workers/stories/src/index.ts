import { allowedOrigin, KEY_RE, mediaType, parseRange, randomKey, tooBig } from './rules';

type R2Range = { offset: number; length?: number } | { suffix: number };
type StoredObject = {
  body: ReadableStream | null;
  size: number;
  httpMetadata?: { contentType?: string };
  range?: R2Range;
};
/** O que usamos do binding R2 (sem depender dos tipos da Cloudflare no tsc do app). */
type Bucket = {
  put(key: string, value: ArrayBuffer, opts: { httpMetadata: { contentType: string } }): Promise<unknown>;
  get(key: string, opts?: { range?: R2Range }): Promise<StoredObject | null>;
};
export type Env = { BUCKET: Bucket; SUPABASE_URL: string; SUPABASE_ANON_KEY: string };
type Deps = { fetch: typeof fetch; uuid: () => string };

const defaults: Deps = { fetch: (...a) => fetch(...a), uuid: () => crypto.randomUUID() };

function cors(req: Request): Record<string, string> {
  const origin = allowedOrigin(req.headers.get('Origin'));
  return origin
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type, range',
        'Access-Control-Expose-Headers': 'content-range, content-length',
        Vary: 'Origin',
      }
    : {};
}

const text = (req: Request, status: number, body: string) =>
  new Response(body, { status, headers: { ...cors(req), 'Content-Type': 'text/plain; charset=utf-8' } });

async function isMember(env: Env, token: string, deps: Deps): Promise<boolean | 'unauthorized'> {
  const res = await deps.fetch(`${env.SUPABASE_URL}/rest/v1/rpc/is_member`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (res.status === 401) return 'unauthorized';
  if (!res.ok) return false;
  return (await res.json()) === true;
}

async function upload(req: Request, env: Env, deps: Deps): Promise<Response> {
  const token = /^Bearer (.+)$/.exec(req.headers.get('Authorization') ?? '')?.[1];
  if (!token) return text(req, 401, 'sem login');
  const type = mediaType(req.headers.get('Content-Type'));
  if (!type) return text(req, 415, 'tipo não aceito');
  const declared = Number(req.headers.get('Content-Length') ?? '0');
  if (declared && tooBig(type.kind, declared)) return text(req, 413, 'grande demais');
  const member = await isMember(env, token, deps);
  if (member === 'unauthorized') return text(req, 401, 'login inválido');
  if (!member) return text(req, 403, 'só membros');
  const body = await req.arrayBuffer();
  if (body.byteLength === 0 || tooBig(type.kind, body.byteLength)) return text(req, 413, 'grande demais');
  const key = randomKey(type.ext, deps.uuid);
  await env.BUCKET.put(key, body, { httpMetadata: { contentType: req.headers.get('Content-Type')!.split(';')[0].trim() } });
  const url = `${new URL(req.url).origin}/m/${key}`;
  return new Response(JSON.stringify({ url }), { status: 200, headers: { ...cors(req), 'Content-Type': 'application/json' } });
}

async function serve(req: Request, env: Env, key: string): Promise<Response> {
  if (!KEY_RE.test(key)) return text(req, 404, 'não existe');
  const range = parseRange(req.headers.get('Range'));
  const obj = await env.BUCKET.get(key, range ? { range } : undefined);
  if (!obj) return text(req, 404, 'não existe (ou já sumiu)');
  const headers: Record<string, string> = {
    ...cors(req),
    'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
    'Cache-Control': 'public, max-age=86400',
    'Accept-Ranges': 'bytes',
  };
  if (!range) {
    headers['Content-Length'] = String(obj.size);
    return new Response(obj.body, { status: 200, headers });
  }
  const offset = 'suffix' in range ? Math.max(0, obj.size - range.suffix) : range.offset;
  const length = 'suffix' in range ? obj.size - offset : (range.length ?? obj.size - offset);
  const end = Math.min(obj.size, offset + length) - 1;
  headers['Content-Range'] = `bytes ${offset}-${end}/${obj.size}`;
  headers['Content-Length'] = String(end - offset + 1);
  return new Response(obj.body, { status: 206, headers });
}

export async function handle(req: Request, env: Env, deps: Deps = defaults): Promise<Response> {
  const { pathname } = new URL(req.url);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  if (req.method === 'POST' && pathname === '/upload') return upload(req, env, deps);
  if (req.method === 'GET' && pathname.startsWith('/m/')) return serve(req, env, decodeURIComponent(pathname.slice(3)));
  return text(req, 404, 'não existe');
}

export default { fetch: (req: Request, env: Env) => handle(req, env) };
