// Um selo ao lado do F$ (dourados.ts selosBonus): span com caixinha (foco no teclado) ou, no Chamar, botão. As bolinhas
// do combo não são selo (só os pontos, sem caixa) e têm um nome pro leitor de tela ("Combo: 2 de 3").
import { button, el } from '../shared/hud/hud';
import type { Selo } from './dourados';

export const rotuloCombo = (texto: string) => `Combo: ${[...texto].filter((c) => c === '●').length} de ${[...texto].length}`;

export function desenharSelo(x: Selo, chamar: () => void): HTMLElement {
  // as bolinhas do combo não são selo (sem caixa): só os pontos, depois dos selos
  const cls = x.classe === 'combo-bolinhas' ? x.classe : `selo-bonus${x.ouro ? ' ouro' : ''}${x.classe ? ` ${x.classe}` : ''}`;
  if (x.acao === 'chamar') return button(x.texto, `${cls} selo-acao`, chamar);
  const e = el('span', cls, x.texto);
  if (x.classe === 'combo-bolinhas') e.setAttribute('aria-label', rotuloCombo(x.texto));
  if (x.dica) e.tabIndex = 0; // caixinha também no foco do teclado
  return e;
}
