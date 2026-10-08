// Desenho sob demanda: a cena só é redesenhada enquanto algo se mexe (ou depois de invalidate()).
// Parada, a mesa não gasta bateria; com a aba escondida, não desenha nada.
type Doc = { hidden: boolean; addEventListener(type: 'visibilitychange', fn: () => void): void };

export type Loop = { invalidate(): void; track(isBusy: () => boolean): void; frames(): number };

export function createLoop(
  render: () => void,
  raf: (cb: FrameRequestCallback) => number = (cb) => requestAnimationFrame(cb),
  doc: Doc = document,
): Loop {
  let queued = false;
  let count = 0;
  const busy: (() => boolean)[] = [];

  const schedule = () => {
    if (queued || doc.hidden) return;
    queued = true;
    raf(frame);
  };
  function frame() {
    queued = false;
    count++;
    render();
    for (let i = busy.length - 1; i >= 0; i--) if (!busy[i]()) busy.splice(i, 1);
    if (busy.length) schedule();
  }
  doc.addEventListener('visibilitychange', () => {
    if (!doc.hidden) schedule();
  });

  return {
    invalidate: schedule,
    track(isBusy) {
      busy.push(isBusy);
      schedule();
    },
    frames: () => count,
  };
}
