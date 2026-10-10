import { describe, expect, it } from 'vitest';

import { ativos } from './ativos';
import type { NomeCena } from './palco';

const CENAS: NomeCena[] = ['cena-0-antes', 'cena-0-abrindo', 'cena-1', 'cena-2', 'cena-3', 'cena-4', 'cena-5', 'cena-6'];
const naoVazia = (x: unknown) => typeof x === 'string' && x.length > 0;

describe('ativos da Fellas Inc.', () => {
  it('toda cena tem fundo (camadas novas ou a tira antiga); cena com vagas tem frente', () => {
    for (const c of CENAS) {
      const k = ativos.camadas(c);
      expect(naoVazia(k.fundo), c).toBe(true);
      if (k.vagas) expect(naoVazia(k.frente), c).toBe(true);
    }
  });
  it('resolve os 30 geradores', () => {
    for (let id = 1; id <= 30; id++) expect(naoVazia(ativos.gerador(id)), `gerador ${id}`).toBe(true);
  });
  it('resolve as 3 oportunidades', () => {
    for (const k of [0, 1, 2] as const) expect(naoVazia(ativos.oportunidade(k)), `oportunidade ${k}`).toBe(true);
  });
  it('resolve os ícones das 20 melhorias gerais', () => {
    for (let id = 1001; id <= 1020; id++) expect(naoVazia(ativos.geral(id)), `geral ${id}`).toBe(true);
  });
});
