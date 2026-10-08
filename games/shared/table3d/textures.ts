// Tudo da mesa é desenhado em canvas: nenhum arquivo de imagem para baixar.
// Cores do mockup aprovado (.superpowers/brainstorm/.../fichas.html).
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['♠', '♥', '♦', '♣'];
const FONT = '"Golos Text", system-ui, sans-serif';
export const CARD_RED = '#C81E3A';
export const INK = '#121212';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

/** Face da carta: índice só no canto de cima à esquerda (o leque nunca o cobre) e o naipe grande embaixo. */
export function cardFace(c: number): HTMLCanvasElement {
  const [cv, g] = canvas(256, 358);
  const red = Math.floor(c / 13) === 1 || Math.floor(c / 13) === 2;
  const rank = RANKS[c % 13];
  const suit = SUITS[Math.floor(c / 13)];
  g.fillStyle = '#FFFFFF';
  roundRect(g, 0, 0, 256, 358, 18);
  g.fill();
  g.fillStyle = red ? CARD_RED : INK;
  g.textAlign = 'center';
  g.textBaseline = 'top';
  g.font = `700 ${rank === '10' ? 64 : 72}px ${FONT}`;
  g.fillText(rank, 50, 18);
  g.font = `400 56px ${FONT}`;
  g.fillText(suit, 50, 98);
  g.font = `400 132px ${FONT}`;
  g.textAlign = 'right';
  g.textBaseline = 'bottom';
  g.fillText(suit, 236, 346);
  return cv;
}

/** Verso: listras vinho com borda branca. */
export function cardBack(): HTMLCanvasElement {
  const [cv, g] = canvas(256, 358);
  g.fillStyle = '#FFFFFF';
  roundRect(g, 0, 0, 256, 358, 18);
  g.fill();
  g.save();
  roundRect(g, 14, 14, 228, 330, 10);
  g.clip();
  g.fillStyle = '#7a1522';
  g.fillRect(0, 0, 256, 358);
  g.strokeStyle = '#9b1c2c';
  g.lineWidth = 9;
  for (let i = -400; i < 400; i += 18) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 358, 358);
    g.stroke();
  }
  g.restore();
  return cv;
}

export const CHIP_COLORS: Record<number, { fill: string; edge: string; text: string }> = {
  5: { fill: '#1f9e8f', edge: '#FFFFFF', text: '#FFFFFF' },
  10: { fill: '#ECE9E2', edge: '#2b6cb0', text: INK },
  50: { fill: '#d6363b', edge: '#FFFFFF', text: '#FFFFFF' },
  100: { fill: '#161616', edge: '#F2D27A', text: '#F2D27A' },
  500: { fill: '#6a4fe0', edge: '#FFFFFF', text: '#FFFFFF' },
};

/** Topo da ficha: borda listrada, anel tracejado e o valor (vazio nas fichas de baixo da pilha). */
export function chipFace(value: number, label = true): HTMLCanvasElement {
  const { fill, edge, text } = CHIP_COLORS[value];
  const [cv, g] = canvas(256, 256);
  g.translate(128, 128);
  g.fillStyle = fill;
  g.beginPath();
  g.arc(0, 0, 126, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = edge;
  for (let i = 0; i < 8; i++) {
    g.beginPath();
    g.arc(0, 0, 126, (i * Math.PI) / 4, (i * Math.PI) / 4 + 0.28);
    g.arc(0, 0, 98, (i * Math.PI) / 4 + 0.28, (i * Math.PI) / 4, true);
    g.fill();
  }
  g.strokeStyle = edge;
  g.globalAlpha = 0.7;
  g.setLineDash([10, 8]);
  g.lineWidth = 5;
  g.beginPath();
  g.arc(0, 0, 80, 0, Math.PI * 2);
  g.stroke();
  g.globalAlpha = 1;
  if (label) {
    g.fillStyle = text;
    g.font = `800 64px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(value), 0, 4);
  }
  return cv;
}

/** Lateral da ficha: faixas da cor da borda. */
export function chipSide(value: number): HTMLCanvasElement {
  const { fill, edge } = CHIP_COLORS[value];
  const [cv, g] = canvas(256, 16);
  g.fillStyle = fill;
  g.fillRect(0, 0, 256, 16);
  g.fillStyle = edge;
  for (let x = 0; x < 256; x += 32) g.fillRect(x, 0, 12, 16);
  return cv;
}

/**
 * Feltro visto de cima, 1024×1024 cobrindo x de -5 a 5 e z de -5,5 (fundo, topo do canvas) a 4,5.
 * Leva o arco dourado com "BANCA PARA EM 17 · BLACKJACK PAGA 3:2" e o círculo da aposta.
 */
export function feltTexture(potZ: number): HTMLCanvasElement {
  const [cv, g] = canvas(1024, 1024);
  const px = (x: number) => ((x + 5) / 10) * 1024;
  const pz = (z: number) => ((z + 5.5) / 10) * 1024;
  const grad = g.createRadialGradient(512, pz(-1.5), 40, 512, pz(-1.5), 760);
  grad.addColorStop(0, '#1d8a58');
  grad.addColorStop(0.6, '#0e5a3a');
  grad.addColorStop(1, '#0a4029');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 1024);

  // arco dourado (só a parte de baixo, como no mockup) com o texto reto e pequeno dentro, entre banca e aposta
  const cx = 512;
  const cy = pz(-3.4);
  const r = pz(-0.95) - cy;
  g.strokeStyle = 'rgba(242,210,122,0.45)';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(cx, cy, r, Math.PI * 0.18, Math.PI * 0.82);
  g.stroke();
  g.fillStyle = 'rgba(242,210,122,0.78)';
  g.font = `600 17px ${FONT}`;
  (g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '3px';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('BANCA PARA EM 17 · BLACKJACK PAGA 3:2', cx, pz(-1.17));

  // círculo da aposta
  g.strokeStyle = 'rgba(242,210,122,0.45)';
  g.setLineDash([12, 10]);
  g.lineWidth = 4;
  g.beginPath();
  g.arc(px(0), pz(potZ), 62, 0, Math.PI * 2);
  g.stroke();
  return cv;
}
