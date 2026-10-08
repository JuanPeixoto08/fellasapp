import { isVerticalSwipe, swipeDismiss, viewerKeyAction } from '../components/feed/PhotoViewer';

describe('viewerKeyAction', () => {
  it('setas trocam de foto dentro dos limites', () => {
    expect(viewerKeyAction('ArrowRight', 0, 3)).toEqual({ type: 'go', to: 1 });
    expect(viewerKeyAction('ArrowLeft', 2, 3)).toEqual({ type: 'go', to: 1 });
    expect(viewerKeyAction('ArrowRight', 2, 3)).toBeNull();
    expect(viewerKeyAction('ArrowLeft', 0, 3)).toBeNull();
  });
  it('Esc fecha; outras teclas não fazem nada', () => {
    expect(viewerKeyAction('Escape', 1, 3)).toEqual({ type: 'close' });
    expect(viewerKeyAction('a', 1, 3)).toBeNull();
  });
});

describe('deslizar para fechar', () => {
  it('arrasto vertical longo fecha, para cima ou para baixo', () => {
    expect(swipeDismiss(200, 0, 800)).toBe('close');
    expect(swipeDismiss(-200, 0, 800)).toBe('close');
  });
  it('arrasto curto e lento volta a foto ao lugar', () => {
    expect(swipeDismiss(60, 0.2, 800)).toBe('stay');
  });
  it('jogar a foto rápido fecha mesmo com arrasto curto, se for no mesmo sentido', () => {
    expect(swipeDismiss(40, 1.2, 800)).toBe('close');
    expect(swipeDismiss(-40, -1.2, 800)).toBe('close');
    expect(swipeDismiss(40, -1.2, 800)).toBe('stay');
  });
  it('só gesto vertical vira fechar; o horizontal fica para trocar de foto', () => {
    expect(isVerticalSwipe(2, 30)).toBe(true);
    expect(isVerticalSwipe(30, 10)).toBe(false);
    expect(isVerticalSwipe(20, 25)).toBe(false);
    expect(isVerticalSwipe(0, 5)).toBe(false);
  });
});
