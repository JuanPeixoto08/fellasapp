// Ícones de traço desenhados (não glifo).

/** X de fechar, traço de 2px. */
export function iconeFechar() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', 'M5 5l10 10M15 5L5 15');
  p.setAttribute('stroke', 'currentColor');
  p.setAttribute('stroke-width', '2');
  p.setAttribute('stroke-linecap', 'round');
  svg.append(p);
  return svg;
}

/** Engrenagem de pixel (10 × 10, ampliada por inteiro), no tom do texto. */
export function iconeEngrenagem() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 10 10');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('shape-rendering', 'crispEdges');
  const linhas = ['....##....', '.#.####.#.', '..######..', '.###..###.', '####..####', '####..####', '.###..###.', '..######..', '.#.####.#.', '....##....'];
  let d = '';
  linhas.forEach((l, y) => [...l].forEach((c, x) => { if (c === '#') d += `M${x} ${y}h1v1h-1z`; }));
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', d);
  p.setAttribute('fill', 'currentColor');
  svg.append(p);
  return svg;
}
