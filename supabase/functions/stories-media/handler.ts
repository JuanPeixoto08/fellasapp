import {
  allowedOrigin,
  basicAuth,
  deleteUrl,
  isExpired,
  listUrl,
  fotoEntregaUrl,
  randomFotoId,
  randomMediaId,
  resourceType,
  stringToSign,
  TRANSFORMATIONS,
  uploadUrl,
  type Kind,
  type UsoFoto,
  type ResourceType,
} from './rules.ts';

export type Env = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  STORIES_CRON_SECRET: string;
  /** Só a migração das fotos antigas usa (lê o Storage e troca os endereços no banco). */
  SUPABASE_SERVICE_ROLE_KEY: string;
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
  // foto de post/comentário/perfil/banner: sem eager (a entrega pede o tamanho de cada uso) e fora da limpeza de 24 h
  if (kind === 'foto') {
    const fotoParams = { public_id: randomFotoId(deps.uuid), timestamp: String(Math.floor(deps.now().getTime() / 1000)) };
    const fotoSignature = await deps.sha1Hex(stringToSign(fotoParams) + env.CLOUDINARY_API_SECRET);
    return reply(req, 200, {
      uploadUrl: uploadUrl(env.CLOUDINARY_CLOUD_NAME, 'photo'),
      fields: { ...fotoParams, api_key: env.CLOUDINARY_API_KEY, signature: fotoSignature },
    });
  }
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

/** Fotos antigas por chamada da migração (cabe no tempo da função). */
const LOTE_FOTOS = 25;

/**
 * Migração única das fotos do Storage pro Cloudinary (out/2026, o tráfego das fotos estourou o plano grátis): pega um lote
 * de caminhos que ainda aparecem no banco (0042 fotos_pendentes), baixa cada um do Storage, sobe no Cloudinary com nome
 * fixo (fotos/m-<sha1 do caminho>: rodar de novo sobrescreve, não duplica) e troca o endereço em todo lugar
 * (foto_trocar). Falhou uma foto: segue com as outras e devolve a lista. Chamada pelo banco com o segredo do cron.
 */
async function migrarFotos(req: Request, env: Env, deps: Deps): Promise<Response> {
  const secret = req.headers.get('x-cron-secret');
  if (!env.STORIES_CRON_SECRET || secret !== env.STORIES_CRON_SECRET) return reply(req, 401, { error: 'segredo' });
  const svc = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };
  const rpc = (fn: string, args: unknown) =>
    deps.fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { ...svc, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
  const lista = await rpc('fotos_pendentes', { p_limite: LOTE_FOTOS });
  if (!lista.ok) return reply(req, 502, { error: 'listar' });
  const pendentes = (await lista.json()) as { caminho: string; uso: UsoFoto }[];
  let migradas = 0;
  const falhas: string[] = [];
  for (const { caminho, uso } of pendentes) {
    try {
      const caminhoUrl = caminho.split('/').map(encodeURIComponent).join('/');
      const arq = await deps.fetch(`${env.SUPABASE_URL}/storage/v1/object/post-images/${caminhoUrl}`, { headers: svc });
      if (!arq.ok) throw new Error('baixar');
      const publicId = `fotos/m-${await deps.sha1Hex(caminho)}`;
      const params = { overwrite: 'true', public_id: publicId, timestamp: String(Math.floor(deps.now().getTime() / 1000)) };
      const signature = await deps.sha1Hex(stringToSign(params) + env.CLOUDINARY_API_SECRET);
      const form = new FormData();
      for (const [k, v] of Object.entries({ ...params, api_key: env.CLOUDINARY_API_KEY, signature })) form.append(k, v);
      form.append('file', await arq.blob());
      const up = await deps.fetch(uploadUrl(env.CLOUDINARY_CLOUD_NAME, 'photo'), { method: 'POST', body: form });
      if (!up.ok) throw new Error('subir');
      const troca = await rpc('foto_trocar', {
        p_caminho: caminho,
        p_url: fotoEntregaUrl(env.CLOUDINARY_CLOUD_NAME, publicId, uso),
        p_uso: uso,
      });
      if (!troca.ok) throw new Error('trocar');
      migradas++;
    } catch {
      falhas.push(caminho);
    }
  }
  const total = await rpc('fotos_pendentes_total', {});
  const restantes = total.ok ? ((await total.json()) as number) : -1;
  return reply(req, 200, { migradas, falhas, restantes });
}

/** Rotas pelo fim do caminho (o Supabase entrega /stories-media/<rota>). */
export async function handle(req: Request, env: Env, deps: Deps = defaults): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  const { pathname } = new URL(req.url);
  if (req.method === 'POST' && pathname.endsWith('/sign')) return sign(req, env, deps);
  if (req.method === 'POST' && pathname.endsWith('/delete')) return remove(req, env, deps);
  if (req.method === 'POST' && pathname.endsWith('/cleanup')) return cleanup(req, env, deps);
  if (req.method === 'POST' && pathname.endsWith('/migrar-fotos')) return migrarFotos(req, env, deps);
  return reply(req, 404, { error: 'não existe' });
}
