// Fila das animações da mesa 3D: os passos tocam em ordem; cancel() descarta o que ainda não começou (aba
// escondida ou recarga: ao voltar, a mesa é redesenhada inteira em vez de reprisar mãos velhas).
export type Player<T> = { push(steps: T): void; cancel(): void; idle(): Promise<void> };

export function createPlayer<T>(play: (steps: T) => Promise<void>): Player<T> {
  let gen = 0;
  let tail: Promise<void> = Promise.resolve();
  return {
    push(steps) {
      const g = gen;
      tail = tail.then(() => (g === gen ? play(steps) : undefined)).catch(() => {});
    },
    cancel() {
      gen++;
    },
    idle: () => tail,
  };
}
