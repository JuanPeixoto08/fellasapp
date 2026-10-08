// Rascunho para ver a cena (Tarefa 8); a Tarefa 9 troca pela tela de verdade.
import { createTable } from '../shared/table3d/scene';

// só no dev: ?shot faz a página se achar visível (o Chrome da automação marca a aba como escondida e pausa o rAF)
if (import.meta.env.DEV && new URLSearchParams(location.search).has('shot')) {
  Object.defineProperty(document, 'hidden', { get: () => false });
  // MessageChannel não sofre o freio de timers das abas escondidas
  const ch = new MessageChannel();
  const queue: FrameRequestCallback[] = [];
  ch.port1.onmessage = () => queue.splice(0).forEach((cb) => cb(performance.now()));
  window.requestAnimationFrame = (cb) => (queue.push(cb), ch.port2.postMessage(0), 0);
}

const canvas = document.getElementById('table') as HTMLCanvasElement;
const table = createTable(canvas);
const fit = () => table?.resize(canvas.clientWidth, canvas.clientHeight);
addEventListener('resize', fit);
document.fonts.ready.then(async () => {
  fit();
  if (!table) return;
  (window as unknown as { table: typeof table }).table = table;
  table.setPot(150);
  await table.dealCard('player', 0, 1, 0, 21);
  await table.dealCard('dealer', 0, 1, 0, 12);
  await table.dealCard('player', 0, 1, 1, 46);
  await table.dealCard('dealer', 0, 1, 1, null);
});
