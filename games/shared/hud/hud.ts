// Peças do HUD em DOM puro (sem framework). Texto de usuário sempre por textContent.
export const fmt = (n: number) => n.toLocaleString('pt-BR');

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Ícones de traço dos botões moeda (mesmos desenhos do mockup). */
const ICON_PATHS = {
  hit: ['M5 3h11a0 0 0 0 1 0 0v15H5z', 'M19 13v6M16 16h6'],
  stand: [
    'M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4.5a1.5 1.5 0 0 1 3 0V11M14 10.5V6a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6.5 7-2.5 0-4-1.2-5.5-3.5L3.6 14a1.5 1.5 0 0 1 2.4-1.7L8 14',
  ],
  split: ['M12 21v-7M12 14 6 8M12 14l6-6M6 8V4h4M18 8V4h-4'],
} as const;

function icon(name: keyof typeof ICON_PATHS): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '26');
  svg.setAttribute('height', '26');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of ICON_PATHS[name]) {
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', '#fff');
    p.setAttribute('stroke-width', '1.8');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    svg.append(p);
  }
  return svg;
}

export type CoinKind = 'hit' | 'stand' | 'double' | 'split';
const COINS: Record<CoinKind, { label: string; aria: string; key: string }> = {
  hit: { label: 'PEDIR', aria: 'Pedir carta', key: '1' },
  stand: { label: 'PARAR', aria: 'Parar', key: '2' },
  double: { label: 'DOBRAR', aria: 'Dobrar a aposta', key: '3' },
  split: { label: 'DIVIDIR', aria: 'Dividir o par', key: '4' },
};

/** Botão redondo com aro dourado, ícone no meio e plaquinha com o nome embaixo. */
export function coinButton(kind: CoinKind, onPress: () => void): HTMLButtonElement {
  const c = COINS[kind];
  const b = el('button', `coin ${kind}`);
  b.type = 'button';
  b.setAttribute('aria-label', c.aria);
  b.setAttribute('aria-keyshortcuts', c.key);
  const face = el('span', 'b');
  if (kind === 'double') face.append(el('span', undefined, '2×'));
  else face.append(icon(kind));
  b.append(el('kbd', undefined, c.key), face, el('span', 'l', c.label));
  b.addEventListener('click', onPress);
  return b;
}

/** Ficha de cassino de aposta (aria-disabled em vez de disabled: continua focável e explica por que não). */
export function chipButton(value: number, onPress: () => void): HTMLButtonElement {
  const b = el('button', `k k${value}`);
  b.type = 'button';
  b.setAttribute('aria-label', `Ficha de ${value}`);
  b.append(el('span', undefined, String(value)));
  b.addEventListener('click', () => {
    if (b.getAttribute('aria-disabled') !== 'true') onPress();
  });
  return b;
}

export function button(text: string, cls: string, onPress: () => void): HTMLButtonElement {
  const b = el('button', cls, text);
  b.type = 'button';
  b.addEventListener('click', onPress);
  return b;
}

/** Conta o saldo do valor antigo até o novo (sem animação com "reduzir movimento"). */
export function countUp(node: HTMLElement, from: number, to: number, ms: number, reduced: boolean, prefix = '● ') {
  if (reduced || from === to || typeof requestAnimationFrame === 'undefined') {
    node.textContent = prefix + fmt(to);
    return;
  }
  const start = performance.now();
  const step = () => {
    const k = Math.min(1, (performance.now() - start) / ms);
    node.textContent = prefix + fmt(Math.round(from + (to - from) * (1 - Math.pow(2, -10 * k))));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
