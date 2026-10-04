export type Rect = { x: number; y: number; width: number; height: number };
type Size = { width: number; height: number };

/**
 * Onde abrir um balão preso a um botão (barra de reações, painel de emojis): logo acima dele, alinhado
 * pela direita do botão; sem espaço em cima, embaixo. Nunca sai da tela (margem `margin`).
 */
export function placePopover(anchor: Rect, size: Size, viewport: Size, margin: number, gap: number): { left: number; top: number } {
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, Math.max(min, max)));
  const left = clamp(anchor.x + anchor.width - size.width, margin, viewport.width - size.width - margin);
  const above = anchor.y - size.height - gap;
  const top = above >= margin ? above : anchor.y + anchor.height + gap;
  return { left, top: clamp(top, margin, viewport.height - size.height - margin) };
}
