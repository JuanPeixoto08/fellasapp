import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ativos } from './ativos';
import { CADEIRA, LINHAS_KIT, POSES, QUADROS_POSE, validarVagas, VAGAS_CONTRATADO, type Pose, type Vagas } from './montagem';
import { CENAS as RITMO, type NomeCena } from './palco';

const CENAS: NomeCena[] = ['cena-0-antes', 'cena-0-abrindo', 'cena-1', 'cena-2', 'cena-3', 'cena-4', 'cena-5', 'cena-6'];
const naoVazia = (x: unknown) => typeof x === 'string' && x.length > 0;
const pasta = resolve(__dirname, 'assets');
/** Largura e altura de um PNG (o cabeçalho IHDR). */
const dim = (arq: string) => {
  const b = readFileSync(resolve(pasta, arq));
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

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

describe('arte da entrega 2 (contrato de formato)', () => {
  it('toda cena em camadas: fundo e frente do tamanho da tira, vagas válidas com as contagens da spec', () => {
    for (const c of CENAS) {
      const q = RITMO[c].quadros;
      expect(dim(`cenas/${c}-fundo.png`), c).toEqual([q * 160, 96]);
      expect(dim(`cenas/${c}-frente.png`), c).toEqual([q * 160, 96]);
      const vagas = JSON.parse(readFileSync(resolve(pasta, `cenas/${c}-vagas.json`), 'utf8')) as Vagas;
      expect(validarVagas(vagas, q, VAGAS_CONTRATADO[c]), c).toEqual([]);
      expect(ativos.camadas(c).vagas, c).not.toBeNull();
    }
  });
  it('não sobrou tira antiga (sem camadas)', () => {
    expect(readdirSync(resolve(pasta, 'cenas')).filter((f) => /^cena-\d(-antes|-abrindo)?\.png$/.test(f))).toEqual([]);
  });
  it('kit: 6 folhas de 4 quadros × 16 linhas; estagiário em toda pose que uma vaga dele usa; cadeira', () => {
    for (const p of [1, 2, 3, 4, 5, 6] as Pose[]) {
      expect(dim(`pessoas/pose-${p}.png`), `pose ${p}`).toEqual([QUADROS_POSE * POSES[p].w, LINHAS_KIT * POSES[p].h]);
    }
    const poses = new Set<Pose>();
    for (const c of CENAS) {
      for (const g of ativos.camadas(c).vagas!.vagas) {
        if (g.freela !== 'estagiario') continue;
        poses.add(g.pose);
        for (const t of g.trilha ?? []) if (t?.pose) poses.add(t.pose);
      }
    }
    for (const p of poses) expect(dim(`pessoas/estagiario-pose-${p}.png`), `estagiário pose ${p}`).toEqual([QUADROS_POSE * POSES[p].w, POSES[p].h]);
    expect(dim('pessoas/cadeira.png')).toEqual([CADEIRA.w, CADEIRA.h]);
  });
  it('o estagiário oficial tem vaga nas cenas 2 e 3', () => {
    for (const c of ['cena-2', 'cena-3'] as const) {
      expect(ativos.camadas(c).vagas!.vagas.some((g) => g.freela === 'estagiario'), c).toBe(true);
    }
  });
});
