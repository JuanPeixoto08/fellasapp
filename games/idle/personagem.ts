// Personagem da Fellas Inc.: as opções do editor, o visual padrão (o fundador) e a troca de cores. As peças do kit
// (assets/pessoas) vêm pintadas com 3 tons-marcador por canal; aqui eles viram os 3 tons da cor escolhida.
// As faixas são as mesmas dos `check` de idle_avatar (0038). Contrato de formato: plano da entrega 2.
import type { IdleVisual } from '../shared/types';
import type { Imagem } from './imagem';

export type Visual = IdleVisual;
export type Campo = keyof Visual;
/** sombra, meio, luz */
export type Tons = readonly [string, string, string];

export const FAIXAS: Record<Campo, number> = { pele: 6, cabelo: 6, cor_cabelo: 8, roupa: 4, cor_roupa: 10, acessorio: 6, cor_acessorio: 10 };
export const CAMPOS = Object.keys(FAIXAS) as Campo[];

/** Sem personagem salvo: o fundador das cenas (moletom preto, cabelo curto preto, fone roxo). */
export const PADRAO: Visual = { pele: 3, cabelo: 0, cor_cabelo: 0, roupa: 0, cor_roupa: 0, acessorio: 2, cor_acessorio: 8 };

/** Tons-marcador das peças do kit (RGB exato; nada mais na arte usa estas cores). */
export const MARCADORES: Record<'pele' | 'cabelo' | 'roupa' | 'acessorio', Tons> = {
  pele: ['#640000', '#A00000', '#DC0000'],
  cabelo: ['#006400', '#00A000', '#00DC00'],
  roupa: ['#000064', '#0000A0', '#0000DC'],
  acessorio: ['#640064', '#A000A0', '#DC00DC'],
};

export const PELES: readonly Tons[] = [
  ['#3B2418', '#5A3A2A', '#7A4E36'],
  ['#5A3A2A', '#7A4E36', '#8A5A48'],
  ['#6E4630', '#8A5A48', '#B98066'],
  ['#8A5A48', '#B98066', '#E0A27A'],
  ['#B98066', '#E0A27A', '#F2C4A0'],
  ['#D69A7A', '#F2C4A0', '#FBE0C8'],
];
/** Preto, castanho, loiro, ruivo, grisalho, roxo, azul, rosa. */
export const CORES_CABELO: readonly Tons[] = [
  ['#060608', '#0F0F13', '#262C3A'],
  ['#2E2019', '#4E3628', '#7A563D'],
  ['#B8913A', '#E0B85A', '#FFE9A8'],
  ['#8C4A1C', '#C46A28', '#E8954A'],
  ['#6B6874', '#8E8A96', '#B4B0BC'],
  ['#3A2A66', '#5B3FD9', '#7E66E8'],
  ['#1E3A66', '#2F6BB0', '#5EC8FF'],
  ['#8C2A5E', '#D94F9A', '#FF8CC6'],
];
/** Roupa e acessório: preto, branco, cinza, vermelho, laranja, amarelo, verde, azul, roxo, rosa. */
export const CORES: readonly Tons[] = [
  ['#1A1A21', '#2A2D38', '#7084A6'],
  ['#C9C4B8', '#E4E0D6', '#F4F1EA'],
  ['#3A3940', '#55535E', '#8E8A96'],
  ['#5E1A28', '#C23B53', '#FF5A6E'],
  ['#8C4A1C', '#E8954A', '#F6C08A'],
  ['#AC832F', '#C9962F', '#FFD25E'],
  ['#1F4A30', '#2F6B45', '#5ED18A'],
  ['#1E2A3F', '#2F4F80', '#5EC8FF'],
  ['#3A2A66', '#5B3FD9', '#B8A2FF'],
  ['#8C2A5E', '#D94F9A', '#FF8CC6'],
];

export const valido = (v: Visual): boolean => CAMPOS.every((c) => Number.isInteger(v[c]) && v[c] >= 0 && v[c] < FAIXAS[c]);

export function sortear(rand: () => number = Math.random): Visual {
  const v = {} as Visual;
  for (const c of CAMPOS) v[c] = Math.min(FAIXAS[c] - 1, Math.floor(rand() * FAIXAS[c]));
  return v;
}

/** Texto único por visual (chave de cache da montagem). */
export const chave = (v: Visual): string => CAMPOS.map((c) => v[c]).join('.');

const rgb = (h: string) => parseInt(h.slice(1), 16);

/** Troca os tons-marcador pelos tons das cores do visual; o resto (contorno, olhos) fica como está. */
export function trocarCores(img: Imagem, v: Visual): Imagem {
  const mapa = new Map<number, number>();
  const por = (m: Tons, c: Tons) => m.forEach((x, i) => mapa.set(rgb(x), rgb(c[i])));
  por(MARCADORES.pele, PELES[v.pele]);
  por(MARCADORES.cabelo, CORES_CABELO[v.cor_cabelo]);
  por(MARCADORES.roupa, CORES[v.cor_roupa]);
  por(MARCADORES.acessorio, CORES[v.cor_acessorio]);
  const d = new Uint8ClampedArray(img.d);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const novo = mapa.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    if (novo === undefined) continue;
    d[i] = novo >> 16;
    d[i + 1] = (novo >> 8) & 255;
    d[i + 2] = novo & 255;
  }
  return { w: img.w, h: img.h, d };
}
