declare const require: (id: string) => { readFileSync: (path: string, encoding: string) => string };
declare const __dirname: string;

const { readFileSync } = require('fs');
const sql = readFileSync(`${__dirname}/../supabase/migrations/0026_post_media.sql`, 'utf8');
const app = readFileSync(`${__dirname}/../lib/postMedia.ts`, 'utf8');

describe('0026_post_media.sql', () => {
  it('só hosts do Last.fm e do Letterboxd (os mesmos do app)', () => {
    expect(sql).toContain("~* '^https://lastfm-img\\.freetls\\.fastly\\.net/'");
    expect(sql).toContain("~* '^https://a\\.ltrbxd\\.com/'");
    expect(sql).toContain("~* '^https://(www\\.)?last\\.fm/'");
    expect(sql).toContain("~* '^https://letterboxd\\.com/[A-Za-z0-9_]+/film/'");
    expect(app).toContain('lastfm-img\\.freetls\\.fastly\\.net');
    expect(app).toContain('a\\.ltrbxd\\.com');
  });

  it('chaves fixas por tipo (nada de campo a mais)', () => {
    expect(sql).toContain("= array['album', 'artist', 'image', 'kind', 'live', 'title', 'url']");
    expect(sql).toContain(
      "= array['kind', 'liked', 'poster', 'rating', 'rewatch', 'spoiler', 'text', 'title', 'url', 'watched', 'year']",
    );
  });

  it('tamanhos: texto até 6000, anexo até 8 KB', () => {
    expect(sql).toContain("char_length(m->>'text') <= 6000");
    expect(sql).toContain('pg_column_size(m) > 8192');
  });

  it('trava depois de postar e não junta com enquete', () => {
    expect(sql).toMatch(/raise exception 'media_locked'/);
    expect(sql).toContain('check (poll_options is null or media is null)');
  });

  it('post só com o ingresso vale', () => {
    expect(sql).toContain('or media is not null);');
  });

  it('usuário do Letterboxd editável só pelo dono (grant por coluna) e no formato certo', () => {
    expect(sql).toContain('grant update (letterboxd_user) on public.profiles to authenticated;');
    expect(sql).toContain("letterboxd_user ~ '^[A-Za-z0-9_]{2,15}$'");
  });
});
