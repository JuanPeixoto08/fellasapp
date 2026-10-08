import { describe, expect, it } from 'vitest';

import { createLoop } from './loop';

// requestAnimationFrame falso: os quadros só rodam quando o teste manda
function fakeFrames() {
  const queue: FrameRequestCallback[] = [];
  return {
    raf: (cb: FrameRequestCallback) => queue.push(cb),
    flush() {
      let n = 0;
      while (queue.length && n < 100) {
        queue.shift()!(0);
        n++;
      }
      return n;
    },
  };
}
const doc = () => {
  const listeners: (() => void)[] = [];
  return {
    hidden: false,
    addEventListener: (_: string, fn: () => void) => listeners.push(fn),
    show() {
      this.hidden = false;
      listeners.forEach((fn) => fn());
    },
  };
};

describe('createLoop', () => {
  it('parado não desenha; invalidate desenha um quadro só', () => {
    const f = fakeFrames();
    let renders = 0;
    const loop = createLoop(() => renders++, f.raf, doc());
    expect(f.flush()).toBe(0);
    loop.invalidate();
    loop.invalidate();
    loop.invalidate();
    f.flush();
    expect(renders).toBe(1);
    expect(loop.frames()).toBe(1);
  });

  it('desenha enquanto há animação e para quando ela acaba', () => {
    const f = fakeFrames();
    let k = 0;
    const loop = createLoop(() => k++, f.raf, doc());
    loop.track(() => k < 3);
    f.flush();
    expect(loop.frames()).toBe(3);
    expect(f.flush()).toBe(0);
  });

  it('aba escondida não desenha; ao voltar, desenha', () => {
    const f = fakeFrames();
    const d = doc();
    d.hidden = true;
    const loop = createLoop(() => {}, f.raf, d);
    loop.invalidate();
    expect(f.flush()).toBe(0);
    d.show();
    expect(f.flush()).toBe(1);
  });
});
