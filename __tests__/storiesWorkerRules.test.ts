import { allowedOrigin, KEY_RE, mediaType, parseRange, randomKey, tooBig } from '../workers/stories/src/rules';

describe('regras do Worker de stories', () => {
  it('tipos aceitos, ignorando parâmetros', () => {
    expect(mediaType('image/jpeg')).toEqual({ kind: 'photo', ext: 'jpg' });
    expect(mediaType('video/mp4; codecs=avc1')).toEqual({ kind: 'video', ext: 'mp4' });
    expect(mediaType('video/quicktime')).toEqual({ kind: 'video', ext: 'mov' });
    expect(mediaType('application/pdf')).toBeNull();
    expect(mediaType(null)).toBeNull();
  });

  it('limites: foto 5 MB, vídeo 50 MB', () => {
    expect(tooBig('photo', 5 * 1024 * 1024)).toBe(false);
    expect(tooBig('photo', 5 * 1024 * 1024 + 1)).toBe(true);
    expect(tooBig('video', 50 * 1024 * 1024 + 1)).toBe(true);
  });

  it('nome aleatório de 64 hexas + extensão', () => {
    let n = 0;
    const key = randomKey('mp4', () => `0000000${n++}-0000-0000-0000-000000000000`);
    expect(key).toMatch(KEY_RE);
    expect(KEY_RE.test('../../etc/passwd')).toBe(false);
  });

  it('Range', () => {
    expect(parseRange('bytes=0-1023')).toEqual({ offset: 0, length: 1024 });
    expect(parseRange('bytes=100-')).toEqual({ offset: 100 });
    expect(parseRange('bytes=-500')).toEqual({ suffix: 500 });
    expect(parseRange('bytes=5-2')).toBeNull();
    expect(parseRange('items=0-1')).toBeNull();
    expect(parseRange(null)).toBeNull();
  });

  it('CORS só para o site e localhost', () => {
    expect(allowedOrigin('https://fellasapp.pages.dev')).toBe('https://fellasapp.pages.dev');
    expect(allowedOrigin('http://localhost:8090')).toBe('http://localhost:8090');
    expect(allowedOrigin('https://malvado.com')).toBeNull();
    expect(allowedOrigin(null)).toBeNull();
  });
});
