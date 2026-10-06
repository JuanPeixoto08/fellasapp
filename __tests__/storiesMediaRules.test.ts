import {
  allowedOrigin,
  basicAuth,
  deleteUrl,
  isExpired,
  listUrl,
  MEDIA_ID_RE,
  randomMediaId,
  resourceType,
  stringToSign,
  TRANSFORMATIONS,
  uploadUrl,
} from '../supabase/functions/stories-media/rules';

describe('regras dos stories (Cloudinary)', () => {
  it('nome aleatório: stories/ + 64 hex', () => {
    const id = randomMediaId(() => '11111111-2222-3333-4444-555555555555');
    expect(id).toBe(`stories/${'11111111222233334444555555555555'.repeat(2)}`);
    expect(MEDIA_ID_RE.test(id)).toBe(true);
    expect(MEDIA_ID_RE.test('stories/abc')).toBe(false);
    expect(MEDIA_ID_RE.test(`outra/${'a'.repeat(64)}`)).toBe(false);
  });

  it('texto assinado igual ao exemplo da documentação do Cloudinary (ordem alfabética, sem api_key/file)', () => {
    const params = {
      timestamp: '1315060510',
      public_id: 'sample_image',
      eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop',
      api_key: '123',
      file: 'x',
    };
    expect(stringToSign(params)).toBe('eager=w_400,h_300,c_pad|w_260,h_200,c_crop&public_id=sample_image&timestamp=1315060510');
  });

  it('transformações e tipo por kind', () => {
    expect(TRANSFORMATIONS.video).toBe('c_limit,w_1280,h_1280,q_auto,f_mp4');
    expect(TRANSFORMATIONS.photo).toBe('c_limit,w_1920,h_1920,q_auto,f_jpg');
    expect(resourceType('video')).toBe('video');
    expect(resourceType('photo')).toBe('image');
  });

  it('passou de 24 h', () => {
    const now = new Date('2026-10-06T12:00:00Z');
    expect(isExpired('2026-10-05T11:59:00Z', now)).toBe(true);
    expect(isExpired('2026-10-05T12:01:00Z', now)).toBe(false);
  });

  it('endereços da API', () => {
    expect(uploadUrl('slxposvw', 'video')).toBe('https://api.cloudinary.com/v1_1/slxposvw/video/upload');
    expect(uploadUrl('slxposvw', 'photo')).toBe('https://api.cloudinary.com/v1_1/slxposvw/image/upload');
    expect(listUrl('c', 'image')).toBe('https://api.cloudinary.com/v1_1/c/resources/image/upload?prefix=stories%2F&max_results=500');
    expect(listUrl('c', 'video', 'abc=')).toBe(
      'https://api.cloudinary.com/v1_1/c/resources/video/upload?prefix=stories%2F&max_results=500&next_cursor=abc%3D',
    );
    expect(deleteUrl('c', 'image', ['stories/a', 'stories/b'])).toBe(
      'https://api.cloudinary.com/v1_1/c/resources/image/upload?public_ids%5B%5D=stories%2Fa&public_ids%5B%5D=stories%2Fb&invalidate=true',
    );
    expect(basicAuth('k', 's')).toBe(`Basic ${btoa('k:s')}`);
  });

  it('CORS: o site e o localhost', () => {
    expect(allowedOrigin('https://fellasapp.pages.dev')).toBe('https://fellasapp.pages.dev');
    expect(allowedOrigin('http://localhost:8099')).toBe('http://localhost:8099');
    expect(allowedOrigin('https://outro.site')).toBeNull();
    expect(allowedOrigin(null)).toBeNull();
  });
});
