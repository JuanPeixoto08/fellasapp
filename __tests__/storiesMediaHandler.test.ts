// o tsconfig não carrega os tipos do Node (só jest): declara o pouco que o teste usa
declare const require: (id: string) => {
  createHash: (alg: string) => { update: (s: string) => { digest: (enc: string) => string } };
};
const { createHash } = require('crypto');

import { handle, type Deps, type Env } from '../supabase/functions/stories-media/handler';

const env: Env = {
  SUPABASE_URL: 'https://sb.test',
  SUPABASE_ANON_KEY: 'anon',
  CLOUDINARY_CLOUD_NAME: 'cloud',
  CLOUDINARY_API_KEY: 'key',
  CLOUDINARY_API_SECRET: 'secret',
  STORIES_CRON_SECRET: 'cron',
  SUPABASE_SERVICE_ROLE_KEY: 'svc',
};
const sha1Hex = async (s: string) => createHash('sha1').update(s).digest('hex');
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const deps = (fetch: jest.Mock): Deps => ({
  fetch: fetch as unknown as typeof globalThis.fetch,
  uuid: () => '11111111-2222-3333-4444-555555555555',
  sha1Hex,
  now: () => new Date('2026-10-06T12:00:00Z'),
});
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://sb.test/functions/v1/stories-media/${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { Origin: 'https://fellasapp.pages.dev', 'Content-Type': 'application/json', ...headers },
  });
const MEDIA = `stories/${'1'.repeat(64)}`;

describe('POST /sign', () => {
  it('membro: devolve a assinatura do envio com nome aleatório e versão reduzida', async () => {
    const fetch = jest.fn(async (..._args: any[]) => json(true));
    const res = await handle(post('sign', { kind: 'video' }, { Authorization: 'Bearer tok' }), env, deps(fetch));
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(out.uploadUrl).toBe('https://api.cloudinary.com/v1_1/cloud/video/upload');
    expect(out.fields).toMatchObject({
      api_key: 'key',
      timestamp: String(Date.parse('2026-10-06T12:00:00Z') / 1000),
      public_id: `stories/${'11111111222233334444555555555555'.repeat(2)}`,
      eager: 'c_limit,w_1280,h_1280,q_auto,f_mp4',
      eager_async: 'true',
    });
    const { api_key, signature, ...signed } = out.fields;
    const expected = await sha1Hex(
      Object.keys(signed).sort().map((k) => `${k}=${signed[k]}`).join('&') + 'secret',
    );
    expect(signature).toBe(expected);
    expect(fetch.mock.calls[0][0]).toBe('https://sb.test/rest/v1/rpc/is_member');
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://fellasapp.pages.dev');
  });

  it('foto (post, comentário, perfil, banner): assina na pasta fotos/, sem versão eager (a entrega pede o tamanho)', async () => {
    const fetch = jest.fn(async (..._args: any[]) => json(true));
    const res = await handle(post('sign', { kind: 'foto' }, { Authorization: 'Bearer tok' }), env, deps(fetch));
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(out.uploadUrl).toBe('https://api.cloudinary.com/v1_1/cloud/image/upload');
    expect(out.fields.public_id).toBe(`fotos/${'11111111222233334444555555555555'.repeat(2)}`);
    expect(out.fields.eager).toBeUndefined();
    const { api_key, signature, ...signed } = out.fields;
    expect(api_key).toBe('key');
    const expected = await sha1Hex(Object.keys(signed).sort().map((k) => `${k}=${signed[k]}`).join('&') + 'secret');
    expect(signature).toBe(expected);
  });

  it('sem login 401, login inválido 401, não membro 403, kind errado 400', async () => {
    expect((await handle(post('sign', { kind: 'photo' }), env, deps(jest.fn()))).status).toBe(401);
    const bad = jest.fn(async () => json({}, 401));
    expect((await handle(post('sign', { kind: 'photo' }, { Authorization: 'Bearer t' }), env, deps(bad))).status).toBe(401);
    const no = jest.fn(async () => json(false));
    expect((await handle(post('sign', { kind: 'photo' }, { Authorization: 'Bearer t' }), env, deps(no))).status).toBe(403);
    const yes = jest.fn(async () => json(true));
    expect((await handle(post('sign', { kind: 'gif' }, { Authorization: 'Bearer t' }), env, deps(yes))).status).toBe(400);
  });

  it('is_member com erro 5xx do Supabase: 502, não 403', async () => {
    const down = jest.fn(async () => json({}, 500));
    const res = await handle(post('sign', { kind: 'photo' }, { Authorization: 'Bearer t' }), env, deps(down));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'is_member falhou' });
  });
});

describe('POST /delete', () => {
  const id = '9b2f6a1e-0000-4000-8000-000000000001';

  it('dono: apaga a linha (RLS) e o arquivo no Cloudinary', async () => {
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(json([{ id, kind: 'video', media_id: MEDIA }]))
      .mockResolvedValueOnce(json({ deleted: { [MEDIA]: 'deleted' } }));
    const res = await handle(post('delete', { storyId: id }, { Authorization: 'Bearer tok' }), env, deps(fetch));
    expect(res.status).toBe(200);
    expect(fetch.mock.calls[0][0]).toBe(`https://sb.test/rest/v1/stories?id=eq.${id}&select=id,kind,media_id`);
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: 'DELETE' });
    expect(fetch.mock.calls[0][1].headers).toMatchObject({ Authorization: 'Bearer tok', Prefer: 'return=representation' });
    expect(fetch.mock.calls[1][0]).toBe(
      `https://api.cloudinary.com/v1_1/cloud/resources/video/upload?public_ids%5B%5D=${encodeURIComponent(MEDIA)}&invalidate=true`,
    );
    expect(fetch.mock.calls[1][1]).toMatchObject({ method: 'DELETE', headers: { Authorization: `Basic ${btoa('key:secret')}` } });
  });

  it('story de outra pessoa: 403 e não mexe no Cloudinary', async () => {
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(json([])) // RLS não deixou apagar
      .mockResolvedValueOnce(json([{ id }])); // mas o story existe
    const res = await handle(post('delete', { storyId: id }, { Authorization: 'Bearer tok' }), env, deps(fetch));
    expect(res.status).toBe(403);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(String(fetch.mock.calls[1][0])).toContain('/rest/v1/stories?id=eq.');
  });

  it('não existe: 404; sem login: 401; id inválido: 400', async () => {
    const fetch = jest.fn().mockResolvedValueOnce(json([])).mockResolvedValueOnce(json([]));
    expect((await handle(post('delete', { storyId: id }, { Authorization: 'Bearer t' }), env, deps(fetch))).status).toBe(404);
    expect((await handle(post('delete', { storyId: id }), env, deps(jest.fn()))).status).toBe(401);
    expect((await handle(post('delete', { storyId: 'x' }, { Authorization: 'Bearer t' }), env, deps(jest.fn()))).status).toBe(400);
  });

  it('Cloudinary falhou: a linha já saiu, responde 200 (a limpeza pega o arquivo)', async () => {
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(json([{ id, kind: 'photo', media_id: MEDIA }]))
      .mockRejectedValueOnce(new TypeError('rede'));
    expect((await handle(post('delete', { storyId: id }, { Authorization: 'Bearer t' }), env, deps(fetch))).status).toBe(200);
  });
});

describe('POST /cleanup', () => {
  it('apaga das duas pastas só o que passou de 24 h, paginando', async () => {
    const old = '2026-10-05T10:00:00Z';
    const fresh = '2026-10-06T10:00:00Z';
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(json({ resources: [{ public_id: 'stories/a', created_at: old }], next_cursor: 'p2' }))
      .mockResolvedValueOnce(json({ resources: [{ public_id: 'stories/b', created_at: fresh }] }))
      .mockResolvedValueOnce(json({ deleted: {} })) // apaga imagens
      .mockResolvedValueOnce(json({ resources: [{ public_id: 'stories/v', created_at: old }] }))
      .mockResolvedValueOnce(json({ deleted: {} })); // apaga vídeos
    const res = await handle(post('cleanup', {}, { 'x-cron-secret': 'cron' }), env, deps(fetch));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: 2 });
    expect(fetch.mock.calls[1][0]).toContain('next_cursor=p2');
    expect(fetch.mock.calls[2][0]).toContain(`public_ids%5B%5D=${encodeURIComponent('stories/a')}`);
    expect(fetch.mock.calls[2][0]).not.toContain('stories%2Fb');
    expect(fetch.mock.calls[4][0]).toContain('/resources/video/upload?public_ids');
    expect(fetch.mock.calls[2][0]).toContain('invalidate=true');
  });

  it('segredo errado, ausente ou vazio na função: 401 sem chamar o Cloudinary', async () => {
    const fetch = jest.fn();
    expect((await handle(post('cleanup', {}, { 'x-cron-secret': 'outro' }), env, deps(fetch))).status).toBe(401);
    expect((await handle(post('cleanup', {}), env, deps(fetch))).status).toBe(401);
    const empty = { ...env, STORIES_CRON_SECRET: '' };
    expect((await handle(post('cleanup', {}, { 'x-cron-secret': '' }), empty, deps(fetch))).status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('POST /migrar-fotos (Storage -> Cloudinary, uma vez)', () => {
  it('leva um lote: baixa do Storage, sobe no Cloudinary com nome fixo, troca o endereço no banco e diz quantas faltam', async () => {
    const arquivo = new Response(new Blob(['jpg'], { type: 'image/jpeg' }), { status: 200 });
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(json([{ caminho: 'u1/1-0.jpg', uso: 'post' }, { caminho: 'u1/sumiu.gif', uso: 'perfil' }]))
      .mockResolvedValueOnce(arquivo) // baixa a 1ª
      .mockResolvedValueOnce(json({ public_id: 'ok' })) // sobe no Cloudinary
      .mockResolvedValueOnce(new Response(null, { status: 204 })) // foto_trocar
      .mockResolvedValueOnce(new Response('not found', { status: 404 })) // a 2ª não existe mais no Storage
      .mockResolvedValueOnce(json(1)); // fotos_pendentes_total
    const res = await handle(post('migrar-fotos', {}, { 'x-cron-secret': 'cron' }), env, deps(fetch));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ migradas: 1, falhas: ['u1/sumiu.gif'], restantes: 1 });
    const [lista, baixa, sobe, troca, , total] = fetch.mock.calls;
    expect(lista[0]).toBe('https://sb.test/rest/v1/rpc/fotos_pendentes');
    expect(JSON.parse(lista[1].body)).toEqual({ p_limite: 25 });
    expect(lista[1].headers.Authorization).toBe('Bearer svc');
    expect(lista[1].headers.apikey).toBe('svc');
    expect(baixa[0]).toBe('https://sb.test/storage/v1/object/post-images/u1/1-0.jpg');
    expect(baixa[1].headers.Authorization).toBe('Bearer svc');
    expect(sobe[0]).toBe('https://api.cloudinary.com/v1_1/cloud/image/upload');
    const form = sobe[1].body as FormData;
    const id = `fotos/m-${await sha1Hex('u1/1-0.jpg')}`;
    expect(form.get('public_id')).toBe(id);
    expect(form.get('api_key')).toBe('key');
    expect(form.get('signature')).toBe(await sha1Hex(`overwrite=true&public_id=${id}&timestamp=${Date.parse('2026-10-06T12:00:00Z') / 1000}secret`));
    expect(troca[0]).toBe('https://sb.test/rest/v1/rpc/foto_trocar');
    expect(JSON.parse(troca[1].body)).toEqual({
      p_caminho: 'u1/1-0.jpg',
      p_url: `https://res.cloudinary.com/cloud/image/upload/c_limit,w_1600,h_1600,q_auto,f_webp,fl_awebp/${id}`,
      p_uso: 'post',
    });
    expect(total[0]).toBe('https://sb.test/rest/v1/rpc/fotos_pendentes_total');
  });

  it('Cloudinary recusou: entra nas falhas e o banco não troca', async () => {
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(json([{ caminho: 'u1/a.jpg', uso: 'banner' }]))
      .mockResolvedValueOnce(new Response(new Blob(['x']), { status: 200 }))
      .mockResolvedValueOnce(json({ error: { message: 'Rate Limit' } }, 420))
      .mockResolvedValueOnce(json(1));
    const res = await handle(post('migrar-fotos', {}, { 'x-cron-secret': 'cron' }), env, deps(fetch));
    expect(await res.json()).toEqual({ migradas: 0, falhas: ['u1/a.jpg'], restantes: 1 });
    expect(fetch.mock.calls.some((c) => String(c[0]).endsWith('/rpc/foto_trocar'))).toBe(false);
  });

  it('segredo errado: 401 sem tocar em nada', async () => {
    const fetch = jest.fn();
    expect((await handle(post('migrar-fotos', {}, { 'x-cron-secret': 'outro' }), env, deps(fetch))).status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('rotas', () => {
  it('OPTIONS responde o CORS; caminho desconhecido 404', async () => {
    const opt = new Request('https://sb.test/functions/v1/stories-media/sign', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:8099' },
    });
    const res = await handle(opt, env, deps(jest.fn()));
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:8099');
    expect((await handle(post('outra', {}), env, deps(jest.fn()))).status).toBe(404);
  });
});
