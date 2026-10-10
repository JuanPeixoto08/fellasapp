import { describe, expect, it } from 'vitest';

import { vazia, type Imagem } from './imagem';
import { VISUAL_NOMES } from './nomes';
import { CAMPOS, chave, CORES, CORES_CABELO, FAIXAS, MARCADORES, PADRAO, PELES, sortear, trocarCores, valido } from './personagem';

const rgba = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
const pinta = (img: Imagem, x: number, y: number, h: string) => img.d.set(rgba(h), (y * img.w + x) * 4);
const px = (img: Imagem, x: number, y: number) => [...img.d.slice((y * img.w + x) * 4, (y * img.w + x) * 4 + 4)];

describe('personagem', () => {
  it('padrão é o fundador: moletom preto, cabelo preto, fone roxo', () => {
    expect(valido(PADRAO)).toBe(true);
    expect(VISUAL_NOMES.roupa[PADRAO.roupa]).toBe('Moletom');
    expect(VISUAL_NOMES.cor_roupa[PADRAO.cor_roupa]).toBe('Preto');
    expect(VISUAL_NOMES.cor_cabelo[PADRAO.cor_cabelo]).toBe('Preto');
    expect(VISUAL_NOMES.acessorio[PADRAO.acessorio]).toBe('Fone');
    expect(VISUAL_NOMES.cor_acessorio[PADRAO.cor_acessorio]).toBe('Roxo');
  });
  it('cada campo tem um nome por opção e cada cor tem 3 tons', () => {
    for (const c of CAMPOS) expect(VISUAL_NOMES[c], c).toHaveLength(FAIXAS[c]);
    expect(PELES).toHaveLength(FAIXAS.pele);
    expect(CORES_CABELO).toHaveLength(FAIXAS.cor_cabelo);
    expect(CORES).toHaveLength(FAIXAS.cor_roupa);
    expect(CORES).toHaveLength(FAIXAS.cor_acessorio);
    for (const t of [...PELES, ...CORES_CABELO, ...CORES]) for (const h of t) expect(h).toMatch(/^#[0-9A-F]{6}$/);
  });
  it('valido recusa fora da faixa, negativo e quebrado', () => {
    expect(valido({ ...PADRAO, pele: 6 })).toBe(false);
    expect(valido({ ...PADRAO, cor_cabelo: -1 })).toBe(false);
    expect(valido({ ...PADRAO, roupa: 1.5 })).toBe(false);
  });
  it('sortear sempre dá um visual válido (até com o sorteio no limite)', () => {
    for (const r of [0, 0.5, 0.999999, 1]) expect(valido(sortear(() => r))).toBe(true);
  });
  it('chave muda quando qualquer campo muda', () => {
    const ks = new Set(CAMPOS.map((c) => chave({ ...PADRAO, [c]: (PADRAO[c] + 1) % FAIXAS[c] })));
    ks.add(chave(PADRAO));
    expect(ks.size).toBe(CAMPOS.length + 1);
  });
  it('marcadores não colidem com nenhuma cor de verdade', () => {
    const marcas = Object.values(MARCADORES).flat();
    const cores = [...PELES, ...CORES_CABELO, ...CORES].flat();
    expect(new Set(marcas).size).toBe(12);
    for (const m of marcas) expect(cores).not.toContain(m);
  });
  it('trocarCores: cada tom-marcador vira o tom da cor escolhida; contorno e transparente ficam; a original não muda', () => {
    const img = vazia(6, 2);
    MARCADORES.pele.forEach((m, i) => pinta(img, i, 0, m));
    pinta(img, 3, 0, MARCADORES.cabelo[2]);
    pinta(img, 4, 0, MARCADORES.roupa[0]);
    pinta(img, 5, 0, MARCADORES.acessorio[1]);
    pinta(img, 0, 1, '#0B0A0E');
    const out = trocarCores(img, { ...PADRAO, pele: 4, cor_cabelo: 2, cor_roupa: 3, cor_acessorio: 6 });
    PELES[4].forEach((c, i) => expect(px(out, i, 0)).toEqual(rgba(c)));
    expect(px(out, 3, 0)).toEqual(rgba(CORES_CABELO[2][2]));
    expect(px(out, 4, 0)).toEqual(rgba(CORES[3][0]));
    expect(px(out, 5, 0)).toEqual(rgba(CORES[6][1]));
    expect(px(out, 0, 1)).toEqual(rgba('#0B0A0E'));
    expect(px(out, 1, 1)).toEqual([0, 0, 0, 0]);
    expect(px(img, 0, 0)).toEqual(rgba(MARCADORES.pele[0]));
  });
});
