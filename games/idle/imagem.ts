// Imagens como bytes RGBA, sem canvas: a montagem das cenas e a troca de cores são contas puras, testáveis no Node.
export type Imagem = { w: number; h: number; d: Uint8ClampedArray<ArrayBuffer> };

export const vazia = (w: number, h: number): Imagem => ({ w, h, d: new Uint8ClampedArray(w * h * 4) });

/** Pedaço w×h a partir de (x, y); o que cai fora da imagem fica transparente. */
export function recortar(img: Imagem, x: number, y: number, w: number, h: number): Imagem {
  const out = vazia(w, h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const sx = x + i;
      const sy = y + j;
      if (sx < 0 || sy < 0 || sx >= img.w || sy >= img.h) continue;
      const s = (sy * img.w + sx) * 4;
      out.d.set(img.d.subarray(s, s + 4), (j * w + i) * 4);
    }
  }
  return out;
}

/** Cola `src` em `dest` com o canto em (x, y): pixel transparente não pinta; o que sai de `dest` é cortado. */
export function colar(dest: Imagem, src: Imagem, x: number, y: number, espelhar = false): void {
  for (let j = 0; j < src.h; j++) {
    for (let i = 0; i < src.w; i++) {
      const s = (j * src.w + (espelhar ? src.w - 1 - i : i)) * 4;
      if (src.d[s + 3] === 0) continue;
      const dx = x + i;
      const dy = y + j;
      if (dx < 0 || dy < 0 || dx >= dest.w || dy >= dest.h) continue;
      const d = (dy * dest.w + dx) * 4;
      dest.d[d] = src.d[s];
      dest.d[d + 1] = src.d[s + 1];
      dest.d[d + 2] = src.d[s + 2];
      dest.d[d + 3] = 255;
    }
  }
}
