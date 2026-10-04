import { AVATAR_CROP, clampOffset, clampZoom, cropRect, pinchZoom, stepZoom } from '../lib/avatarCrop';

const landscape = { width: 4000, height: 3000 };
const portrait = { width: 1170, height: 2532 };
const V = 300; // diâmetro do círculo na tela

describe('zoom', () => {
  it('fica entre 1x e 4x', () => {
    expect(AVATAR_CROP).toMatchObject({ minZoom: 1, maxZoom: 4, output: 512, quality: 0.8 });
    expect(clampZoom(0.5)).toBe(1);
    expect(clampZoom(2.5)).toBe(2.5);
    expect(clampZoom(9)).toBe(4);
  });

  it('botões andam em passos e param nos limites', () => {
    expect(stepZoom(1, 1)).toBe(1.5);
    expect(stepZoom(1.5, -1)).toBe(1);
    expect(stepZoom(1, -1)).toBe(1);
    expect(stepZoom(3.8, 1)).toBe(4);
  });

  it('pinça: zoom proporcional à distância entre os dedos', () => {
    expect(pinchZoom(1, 100, 200)).toBe(2);
    expect(pinchZoom(2, 200, 100)).toBe(1);
    expect(pinchZoom(2, 100, 1000)).toBe(4);
    expect(pinchZoom(2, 0, 100)).toBe(2); // distância inicial inválida não muda nada
  });
});

describe('clampOffset', () => {
  it('em 1x a foto deitada só anda na horizontal, até não deixar buraco', () => {
    // 1x: altura = 300 (cobre o círculo), largura = 400 → sobra 50 de cada lado
    expect(clampOffset(landscape, V, 1, { x: 500, y: 500 })).toEqual({ x: 50, y: 0 });
    expect(clampOffset(landscape, V, 1, { x: -20, y: -9 })).toEqual({ x: -20, y: 0 });
  });

  it('foto em pé só anda na vertical em 1x', () => {
    const maxY = (2532 * (V / 1170) - V) / 2;
    expect(clampOffset(portrait, V, 1, { x: 80, y: -9999 })).toEqual({ x: 0, y: -maxY });
  });

  it('com zoom sobra mais espaço para arrastar', () => {
    // 2x: 800 x 600 → sobra 250 / 150
    expect(clampOffset(landscape, V, 2, { x: 999, y: -999 })).toEqual({ x: 250, y: -150 });
  });
});

describe('cropRect', () => {
  it('1x centralizado pega o quadrado do meio pelo lado menor', () => {
    expect(cropRect(landscape, V, 1, { x: 0, y: 0 })).toEqual({ originX: 500, originY: 0, width: 3000, height: 3000 });
  });

  it('arrastar a foto pra direita mostra o lado esquerdo dela', () => {
    expect(cropRect(landscape, V, 1, { x: 50, y: 0 })).toEqual({ originX: 0, originY: 0, width: 3000, height: 3000 });
  });

  it('2x pega um quadrado com metade do tamanho', () => {
    expect(cropRect(landscape, V, 2, { x: 0, y: 0 })).toEqual({ originX: 1250, originY: 750, width: 1500, height: 1500 });
  });

  it('foto em pé arrastada pra cima pega a parte de baixo', () => {
    const maxY = (2532 * (V / 1170) - V) / 2;
    expect(cropRect(portrait, V, 1, { x: 0, y: -maxY })).toEqual({ originX: 0, originY: 2532 - 1170, width: 1170, height: 1170 });
  });

  it('nunca sai da foto, mesmo com arredondamento', () => {
    const r = cropRect({ width: 1001, height: 777 }, 287, 3.3, { x: 9999, y: -9999 });
    expect(r.originX).toBeGreaterThanOrEqual(0);
    expect(r.originY).toBeGreaterThanOrEqual(0);
    expect(r.originX + r.width).toBeLessThanOrEqual(1001);
    expect(r.originY + r.height).toBeLessThanOrEqual(777);
    expect(r.width).toBe(r.height);
  });
});
