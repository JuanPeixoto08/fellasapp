import { useEffect, useState, type RefObject } from 'react';
import { Platform, type View } from 'react-native';

import { centerScroller, scrollableAncestor, scrollsY } from './wheelForward';

/** Quanto o mouse anda a partir do ícone antes de começar a rolar (e antes de contar como "arrastou"). */
export const AUTOSCROLL_DEAD_ZONE = 15;
/** A cada tantos pixels de distância do ícone, 1 pixel por quadro de velocidade. */
const SPEED_DIVISOR = 8;

/** Pixels por quadro: parado perto do ícone; abaixo desce, acima sobe, mais longe mais rápido. */
export function autoScrollSpeed(offsetY: number): number {
  const beyond = Math.abs(offsetY) - AUTOSCROLL_DEAD_ZONE;
  return beyond > 0 ? (Math.sign(offsetY) * beyond) / SPEED_DIVISOR : 0;
}

/** Mexeu o mouse com o botão do meio apertado: soltar o botão para a rolagem (modo arrastar). */
export function movedPastDeadZone(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) > AUTOSCROLL_DEAD_ZONE;
}

export type AutoScrollOrigin = { x: number; y: number };

/**
 * Computador: o clique na rodinha (botão do meio) fora da coluna do meio liga a rolagem automática do
 * meio, como o navegador faz sobre o que rola: aparece o ícone onde clicou e o meio rola conforme o mouse
 * se afasta dele. Para com qualquer clique, Esc, roda ou, se arrastou com o botão apertado, ao soltar.
 * Sobre o meio (ou sobre algo do lado que rola sozinho) quem cuida é o navegador. Devolve onde desenhar
 * o ícone, ou null.
 */
export function useMiddleClickScroll(centerRef: RefObject<View | null>, enabled: boolean): AutoScrollOrigin | null {
  const [origin, setOrigin] = useState<AutoScrollOrigin | null>(null);

  useEffect(() => {
    if (!enabled || Platform.OS !== 'web' || typeof window === 'undefined') return;
    let active: {
      x: number;
      y: number;
      pointerY: number;
      scroller: Element;
      held: boolean;
      moved: boolean;
      frame: number;
    } | null = null;

    const stop = () => {
      if (!active) return;
      cancelAnimationFrame(active.frame);
      active = null;
      document.body.style.cursor = '';
      setOrigin(null);
    };
    const tick = () => {
      if (!active) return;
      const speed = autoScrollSpeed(active.pointerY - active.y);
      if (speed) active.scroller.scrollBy({ top: speed });
      active.frame = requestAnimationFrame(tick);
    };
    // o clique que para a rolagem não aperta o que estiver embaixo
    const swallow = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const onDown = (e: MouseEvent) => {
      if (active) {
        swallow(e);
        window.addEventListener(e.button === 1 ? 'auxclick' : 'click', swallow, { capture: true, once: true });
        stop();
        return;
      }
      if (e.button !== 1) return;
      const center = centerRef.current as unknown as HTMLElement | null;
      const target = e.target instanceof Element ? e.target : null;
      // link: o botão do meio abre em outra aba; janela aberta: nada rola por trás
      if (!center || !target || center.contains(target) || target.closest('a, [aria-modal="true"]')) return;
      if (scrollableAncestor<Element>(target, 1, scrollsY) || scrollableAncestor<Element>(target, -1, scrollsY)) return;
      const scroller = centerScroller(center, e.clientY, 1) ?? centerScroller(center, e.clientY, -1);
      if (!scroller) return;
      e.preventDefault();
      active = {
        x: e.clientX,
        y: e.clientY,
        pointerY: e.clientY,
        scroller,
        held: true,
        moved: false,
        frame: requestAnimationFrame(tick),
      };
      document.body.style.cursor = 'ns-resize';
      setOrigin({ x: e.clientX, y: e.clientY });
    };
    const onMove = (e: MouseEvent) => {
      if (!active) return;
      active.pointerY = e.clientY;
      if (active.held && movedPastDeadZone(e.clientX - active.x, e.clientY - active.y)) active.moved = true;
    };
    const onUp = (e: MouseEvent) => {
      if (!active || e.button !== 1) return;
      active.held = false;
      if (active.moved) stop();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') stop();
    };

    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('mouseup', onUp, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('wheel', stop, true);
    window.addEventListener('blur', stop);
    return () => {
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('mouseup', onUp, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('wheel', stop, true);
      window.removeEventListener('blur', stop);
      stop();
    };
  }, [centerRef, enabled]);

  return origin;
}
