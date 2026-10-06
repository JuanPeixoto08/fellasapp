declare const require: (id: string) => { readFileSync: (path: string, encoding: string) => string };
declare const __dirname: string;

const { readFileSync } = require('fs');
const sql = readFileSync(`${__dirname}/../supabase/migrations/0022_comment_images.sql`, 'utf8');

describe('0022_comment_images.sql', () => {
  it('coluna de imagens, no máximo 4', () => {
    expect(sql).toMatch(/add column if not exists images text\[\] not null default '\{\}'/);
    expect(sql).toMatch(/cardinality\(images\) <= 4/);
  });

  it('texto até 1000, ou imagem, ou os dois (comentário vazio continua proibido)', () => {
    expect(sql).toContain('char_length(body) <= 1000 and (char_length(body) >= 1 or cardinality(images) >= 1)');
    expect(sql).toMatch(/drop constraint if exists comments_body_check/);
  });
});
