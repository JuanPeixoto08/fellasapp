/**
 * @jest-environment node
 */
import { handle, type Env } from '../workers/stories/src/index';

const put = jest.fn();
const objects = new Map<string, { bytes: Uint8Array; type: string }>();
const env: Env = {
  SUPABASE_URL: 'https://sb.test',
  SUPABASE_ANON_KEY: 'anon',
  BUCKET: {
    put: async (key, value, opts) => {
      put(key, opts);
      objects.set(key, { bytes: new Uint8Array(value as ArrayBuffer), type: opts.httpMetadata.contentType });
    },
    get: async (key, opts) => {
      const o = objects.get(key);
      if (!o) return null;
      const r = opts?.range;
      let slice = o.bytes;
      if (r && 'suffix' in r) slice = o.bytes.slice(o.bytes.length - r.suffix);
      else if (r) slice = o.bytes.slice(r.offset, r.length === undefined ? undefined : r.offset + r.length);
      return { body: new Blob([new Uint8Array(slice)]).stream(), size: o.bytes.length, httpMetadata: { contentType: o.type }, range: r };
    },
  },
};
const member = (ok: boolean, status = 200) =>
  jest.fn(async () => new Response(JSON.stringify(ok), { status })) as unknown as typeof fetch;
const upload = (body: BodyInit, headers: Record<string, string>) =>
  new Request('https://w.test/upload', { method: 'POST', body, headers: { Origin: 'https://fellasapp.pages.dev', ...headers } });

beforeEach(() => {
  put.mockClear();
  objects.clear();
});

describe('POST /upload', () => {
  it('membro envia foto: guarda com nome aleatório e devolve o endereço', async () => {
    const fetch = member(true);
    const res = await handle(upload(new Uint8Array([1, 2, 3]), { Authorization: 'Bearer tok', 'Content-Type': 'image/jpeg', 'Content-Length': '3' }), env, { fetch, uuid: () => '11111111-2222-3333-4444-555555555555' });
    expect(res.status).toBe(200);
    const { url } = await res.json();
    expect(url).toMatch(/^https:\/\/w\.test\/m\/[0-9a-f]{64}\.jpg$/);
    expect((fetch as jest.Mock).mock.calls[0][0]).toBe('https://sb.test/rest/v1/rpc/is_member');
    expect((fetch as jest.Mock).mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://fellasapp.pages.dev');
  });

  it('sem login 401, não membro 403, tipo errado 415, grande demais 413', async () => {
    expect((await handle(upload('x', { 'Content-Type': 'image/jpeg', 'Content-Length': '1' }), env, { fetch: member(true), uuid: () => 'a' })).status).toBe(401);
    expect((await handle(upload('x', { Authorization: 'Bearer t', 'Content-Type': 'image/jpeg', 'Content-Length': '1' }), env, { fetch: member(false), uuid: () => 'a' })).status).toBe(403);
    expect((await handle(upload('x', { Authorization: 'Bearer t', 'Content-Type': 'image/jpeg', 'Content-Length': '1' }), env, { fetch: member(false, 401), uuid: () => 'a' })).status).toBe(401);
    expect((await handle(upload('x', { Authorization: 'Bearer t', 'Content-Type': 'text/plain', 'Content-Length': '1' }), env, { fetch: member(true), uuid: () => 'a' })).status).toBe(415);
    expect((await handle(upload('x', { Authorization: 'Bearer t', 'Content-Type': 'image/png', 'Content-Length': String(6 * 1024 * 1024) }), env, { fetch: member(true), uuid: () => 'a' })).status).toBe(413);
    expect(put).not.toHaveBeenCalled();
  });
});

describe('GET /m/<key>', () => {
  const key = `${'a'.repeat(64)}.mp4`;
  beforeEach(() => objects.set(key, { bytes: new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), type: 'video/mp4' }));

  it('inteiro com cache e tipo', async () => {
    const res = await handle(new Request(`https://w.test/m/${key}`), env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('video/mp4');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=86400');
    expect(res.headers.get('Accept-Ranges')).toBe('bytes');
    expect(new Uint8Array(await res.arrayBuffer())).toHaveLength(10);
  });

  it('pedaço com Range (Safari)', async () => {
    const res = await handle(new Request(`https://w.test/m/${key}`, { headers: { Range: 'bytes=2-5' } }), env);
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe('bytes 2-5/10');
    expect(Array.from(new Uint8Array(await res.arrayBuffer()))).toEqual([2, 3, 4, 5]);
  });

  it('nome inválido ou inexistente: 404', async () => {
    expect((await handle(new Request('https://w.test/m/..%2Fsegredo'), env)).status).toBe(404);
    expect((await handle(new Request(`https://w.test/m/${'b'.repeat(64)}.jpg`), env)).status).toBe(404);
  });
});

it('OPTIONS responde CORS', async () => {
  const res = await handle(new Request('https://w.test/upload', { method: 'OPTIONS', headers: { Origin: 'http://localhost:8090' } }), env);
  expect(res.status).toBe(204);
  expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:8090');
  expect(res.headers.get('Access-Control-Allow-Headers')).toContain('authorization');
});
