// Os desenhos das plantas (hortaArte.json, 12 × 12) em SVG, com o contorno escuro automático (o mesmo do gerador dos
// ícones das conquistas). A fase muda o desenho: muda = broto genérico; crescendo = a planta menor e mais clara;
// madura = inteira com brilho; murchando = puxada pro marrom.
import arte from './hortaArte.json';
import type { FaseHorta } from './horta';

const NS = 'http://www.w3.org/2000/svg';
const paleta = arte.paleta as Record<string, string>;
const plantas = arte.plantas as Record<string, string[]>;

/** Os caminhos (um por cor) do desenho, deslocado 2 px pra caber o contorno num 16 × 16. */
function caminhos(id: number): Map<string, string> {
  const g = plantas[String(id)];
  const cheio = new Set<string>();
  const porCor = new Map<string, string>();
  g.forEach((linha, y) => [...linha].forEach((c, x) => {
    if (c === '.') return;
    cheio.add(`${x + 2},${y + 2}`);
    porCor.set(paleta[c], `${porCor.get(paleta[c]) ?? ''}M${x + 2} ${y + 2}h1v1h-1z`);
  }));
  let contorno = '';
  for (const k of cheio) {
    const [x, y] = k.split(',').map(Number);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const v = `${x + dx},${y + dy}`;
      if (!cheio.has(v) && !contorno.includes(`M${x + dx} ${y + dy}h`)) contorno += `M${x + dx} ${y + dy}h1v1h-1z`;
    }
  }
  return new Map([[arte.contorno, contorno], ...porCor]);
}

/** O ícone da planta na fase (muda usa o broto genérico). */
export function iconePlanta(especie: number, fase: FaseHorta = 'madura'): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('class', `planta planta-${fase}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('aria-hidden', 'true');
  for (const [cor, d] of caminhos(fase === 'muda' ? 0 : especie)) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', cor);
    svg.append(p);
  }
  return svg;
}
