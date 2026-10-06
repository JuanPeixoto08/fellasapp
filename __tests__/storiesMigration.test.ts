declare const require: (id: string) => { readFileSync: (path: string, encoding: string) => string };
declare const __dirname: string;

const { readFileSync } = require('fs');
const sql = readFileSync(`${__dirname}/../supabase/migrations/0021_stories.sql`, 'utf8');

describe('0021_stories.sql', () => {
  it('guarda o nome do arquivo no Cloudinary, não um endereço', () => {
    expect(sql).toContain("media_id    text not null check (media_id ~ '^stories/[0-9a-f]{64}$')");
    expect(sql).not.toMatch(/media_url/);
    expect(sql).not.toMatch(/R2|Worker/);
  });

  it('cada arquivo pertence a um story só (ninguém aponta para o arquivo de outro)', () => {
    expect(sql).toContain('create unique index if not exists stories_media_id_key on public.stories (media_id);');
  });

  it('duas limpezas de hora em hora: linhas e arquivos (pela função)', () => {
    expect(sql).toMatch(/cron\.schedule\('fellas-stories-limpeza'/);
    expect(sql).toMatch(/cron\.schedule\('fellas-stories-arquivos'/);
    expect(sql).toContain('https://xygtrrdliqhwibxalvap.supabase.co/functions/v1/stories-media/cleanup');
    expect(sql).toMatch(/create extension if not exists pg_net/);
  });

  it('a chamada da limpeza espera até 30 s (o padrão do pg_net é ~5 s)', () => {
    expect(sql).toContain('timeout_milliseconds := 30000');
  });

  it('o segredo do cron vem do Vault, nunca escrito na migração', () => {
    expect(sql).toContain("from vault.decrypted_secrets where name = 'stories_cron_secret'");
    expect(sql).not.toMatch(/x-cron-secret',\s*'[^']/);
  });
});
