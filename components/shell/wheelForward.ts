import { useEffect, type RefObject } from 'react';
import { Platform, type View } from 'react-native';

/** O pouco do elemento do DOM que a regra usa (dá pra testar sem navegador). */
export type ScrollBox = {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  parentElement: ScrollBox | null;
};

/** Altura de uma "linha" da roda (Firefox manda em linhas, não em pixels). */
const LINE_PX = 16;

/** A roda em pixels, seja qual for a unidade que o navegador mandou. */
export function wheelPixels(deltaY: number, deltaMode: number, pageHeight: number): number {
  if (deltaMode === 1) return deltaY * LINE_PX;
  if (deltaMode === 2) return deltaY * pageHeight;
  return deltaY;
}

/** O mais próximo, subindo a partir de `start`, que rola e ainda tem pra onde ir nessa direção. */
export function scrollableAncestor<T extends ScrollBox>(
  start: T,
  deltaY: number,
  isScrollable: (el: T) => boolean,
): T | null {
  for (let el: T | null = start; el; el = el.parentElement as T | null) {
    if (!isScrollable(el)) continue;
    const room = deltaY > 0 ? el.scrollHeight - el.clientHeight - el.scrollTop : el.scrollTop;
    if (room > 0) return el;
  }
  return null;
}

export const scrollsY = (el: Element) => {
  const overflow = getComputedStyle(el).overflowY;
  return overflow === 'auto' || overflow === 'scroll';
};

/** O que rola no meio na altura `clientY`, como se o mouse estivesse no centro da coluna. */
export function centerScroller(center: HTMLElement, clientY: number, deltaY: number): Element | null {
  const box = center.getBoundingClientRect();
  const y = Math.min(Math.max(clientY, box.top + 1), box.bottom - 1);
  const under = document.elementFromPoint(box.left + box.width / 2, y);
  return under && center.contains(under) ? scrollableAncestor<Element>(under, deltaY, scrollsY) : null;
}

/**
 * Computador: cada tela do meio rola sozinha, e o navegador só rola o que está embaixo do mouse.
 * Com a roda em cima da lateral, da coluna direita ou do fundo, rola o meio como se o mouse estivesse
 * lá (mesma altura). Não se mete quando o mouse já está no meio, quando o que está embaixo rola por
 * conta própria (coluna direita com "Ver todos", painel de emojis) ou com uma janela aberta.
 */
export function useForwardWheel(centerRef: RefObject<View | null>, enabled: boolean) {
  useEffect(() => {
    if (!enabled || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onWheel = (e: WheelEvent) => {
      const center = centerRef.current as unknown as HTMLElement | null;
      const target = e.target instanceof Element ? e.target : null;
      // zoom (Ctrl+roda) e rolagem de lado ficam com o navegador
      if (!center || !target || e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (center.contains(target) || target.closest('[aria-modal="true"]')) return;
      const dy = wheelPixels(e.deltaY, e.deltaMode, window.innerHeight);
      if (scrollableAncestor<Element>(target, dy, scrollsY)) return;
      const scroller = centerScroller(center, e.clientY, dy);
      if (!scroller) return;
      e.preventDefault();
      scroller.scrollBy({ top: dy });
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [centerRef, enabled]);
}
