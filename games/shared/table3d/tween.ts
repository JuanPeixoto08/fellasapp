// Animação simples por tempo: step(k) com k de 0 a 1 já suavizado. Curva de saída exponencial (DESIGN.md).
export const easeOut = (k: number) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k));

export type Tween = { done: Promise<void>; busy(): boolean };

export function tween(ms: number, step: (k: number) => void, ease: (k: number) => number = easeOut): Tween {
  const start = performance.now();
  let finished = false;
  let resolve!: () => void;
  const done = new Promise<void>((r) => (resolve = r));
  if (ms <= 0) {
    step(1);
    finished = true;
    resolve();
  }
  return {
    done,
    // chamado a cada quadro pelo loop: avança e diz se ainda está rodando
    busy() {
      if (finished) return false;
      const k = Math.min(1, (performance.now() - start) / ms);
      step(ease(k));
      if (k >= 1) {
        finished = true;
        resolve();
      }
      return !finished;
    },
  };
}
