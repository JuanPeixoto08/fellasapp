import { viewerKeyAction } from '../components/feed/PhotoViewer';

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
