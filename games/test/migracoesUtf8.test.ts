import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = resolve(__dirname, '../../supabase/migrations');
const arquivos = readdirSync(DIR).filter((f) => f.endsWith('.sql'));

describe('migrações em UTF-8', () => {
  it('há migrações para conferir', () => {
    expect(arquivos.length).toBeGreaterThan(0);
  });
  it.each(arquivos)('%s é UTF-8 válido', (arquivo) => {
    const buf = readFileSync(resolve(DIR, arquivo));
    expect(() => new TextDecoder('utf-8', { fatal: true }).decode(buf)).not.toThrow();
  });
});
