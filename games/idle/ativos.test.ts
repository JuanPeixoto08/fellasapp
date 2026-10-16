import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ativos } from './ativos';
import { catalogo } from './catalogo';
import { DJS } from './copao';
import { CADEIRA, LINHAS_KIT, POSES, QUADROS_POSE, validarVagas, VAGAS_CONTRATADO, type Pose, type Vagas } from './montagem';
import { CENAS as RITMO, type NomeCena } from './palco';

const CENAS: NomeCena[] = ['cena-0-antes', 'cena-0-abrindo', 'cena-1', 'cena-2', 'cena-3', 'cena-4', 'cena-5', 'cena-6', 'cena-7'];
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
  it('resolve os 42 geradores (4 quadros de 32)', () => {
    for (let id = 1; id <= 42; id++) {
      expect(naoVazia(ativos.gerador(id)), `gerador ${id}`).toBe(true);
      if (id > 30) expect(dim(`geradores/gerador-${id}.png`)).toEqual([128, 32]);
    }
  });
  it('resolve as 8 oportunidades, cada uma com 4 quadros de 24 px', () => {
    for (let k = 0; k <= 7; k++) {
      expect(naoVazia(ativos.oportunidade(k)), `oportunidade ${k}`).toBe(true);
      expect(dim(`oportunidades/oportunidade-${k}.png`)).toEqual([96, 24]);
    }
  });
  it('resolve os ícones das 28 melhorias gerais', () => {
    for (let id = 1001; id <= 1028; id++) {
      expect(naoVazia(ativos.geral(id)), `geral ${id}`).toBe(true);
      if (id > 1020) expect(dim(`gerais/geral-${id}.png`)).toEqual([16, 16]);
    }
  });
  it('ícone de conquista ou de nó que não existe: null (a célula mostra só a moldura)', () => {
    expect(ativos.conquista(999)).toBeNull();
    expect(ativos.no(99)).toBeNull();
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
  it('peças das cenas 6 e 7 (eras 6–7): os ids da spec, tira com os quadros da cena, dentro da cena', () => {
    const esperado: [NomeCena, string[]][] = [
      ['cena-6', ['g31', 'g32', 'g33', 'g34', 'g35', 'g36']],
      ['cena-7', ['g37', 'g38', 'g39', 'g40', 'g41', 'g42', 'monolito']],
    ];
    for (const [c, ids] of esperado) {
      const k = ativos.camadas(c);
      expect(k.pecas.map((p) => p.id).sort(), c).toEqual([...ids].sort());
      const q = RITMO[c].quadros;
      for (const p of k.pecas) {
        const [w, h] = dim(`cenas/${c}-peca-${p.id}.png`);
        expect(w % q, `${c} ${p.id}: largura múltipla dos quadros`).toBe(0);
        expect(p.x + w / q, `${c} ${p.id}`).toBeLessThanOrEqual(160);
        expect(p.y + h, `${c} ${p.id}`).toBeLessThanOrEqual(96);
      }
    }
  });
  it('a cena da Lua tem você e até 3 contratados (como a da órbita)', () => {
    const v = ativos.camadas('cena-7').vagas!;
    expect(v.vagas.filter((g) => g.papel === 'dono')).toHaveLength(1);
    expect(v.vagas.filter((g) => g.papel === 'contratado')).toHaveLength(3);
  });
  it('o estagiário oficial tem vaga nas cenas 2 e 3', () => {
    for (const c of ['cena-2', 'cena-3'] as const) {
      expect(ativos.camadas(c).vagas!.vagas.some((g) => g.freela === 'estagiario'), c).toBe(true);
    }
  });
});

describe('arte da entrega 3 (ícones das conquistas e da árvore)', () => {
  const conquista = (id: number) => `conquista-${String(id).padStart(3, '0')}.png`;
  const no = (id: number) => `no-${String(id).padStart(2, '0')}.png`;
  it('toda conquista e todo nó do catálogo têm ícone 16x16', () => {
    for (const c of catalogo.conquistas) {
      expect(dim(`conquistas/${conquista(c.id)}`), conquista(c.id)).toEqual([16, 16]);
      expect(ativos.conquista(c.id), conquista(c.id)).not.toBeNull();
    }
    for (const n of catalogo.arvore) {
      expect(dim(`arvore/${no(n.id)}`), no(n.id)).toEqual([16, 16]);
      expect(ativos.no(n.id), no(n.id)).not.toBeNull();
    }
  });
  it('os 11 retratos dos convidados, 32x32', () => {
    for (let id = 1; id <= 11; id++) {
      expect(dim(`convidados/convidado-${String(id).padStart(2, '0')}.png`)).toEqual([32, 32]);
      expect(ativos.convidado(id)).not.toBeNull();
    }
  });
  it('os 10 retratos dos DJs do copão, 64x64, e nenhum sobrando', () => {
    for (const d of DJS) {
      expect(dim(`djs/dj-${String(d.id).padStart(2, '0')}.png`), d.nome).toEqual([64, 64]);
      expect(ativos.dj(d.id), d.nome).not.toBeNull();
    }
    expect(readdirSync(resolve(pasta, 'djs')).length).toBe(DJS.length);
    expect(ativos.dj(99)).toBeNull();
  });
  it('nenhum ícone sobrando (de id que não existe no catálogo)', () => {
    const conquistas = new Set(catalogo.conquistas.map((c) => conquista(c.id)));
    const nos = new Set(catalogo.arvore.map((n) => no(n.id)));
    expect(readdirSync(resolve(pasta, 'conquistas')).filter((f) => !conquistas.has(f))).toEqual([]);
    expect(readdirSync(resolve(pasta, 'arvore')).filter((f) => !nos.has(f))).toEqual([]);
  });
});
