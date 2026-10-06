import { scrollableAncestor, wheelPixels, type ScrollBox } from '../components/shell/wheelForward';

type Node = ScrollBox & { scrolls: boolean };
const node = (over: Partial<Node> = {}, parent: Node | null = null): Node => ({
  scrolls: false,
  scrollTop: 0,
  scrollHeight: 100,
  clientHeight: 100,
  parentElement: parent,
  ...over,
});
const isScrollable = (el: ScrollBox) => (el as Node).scrolls;

describe('scrollableAncestor', () => {
  it('acha o mais próximo que rola e ainda tem pra onde ir', () => {
    const outer = node({ scrolls: true, scrollHeight: 1000, clientHeight: 500 });
    const inner = node({ scrolls: true, scrollHeight: 800, clientHeight: 400 }, outer);
    const leaf = node({}, inner);
    expect(scrollableAncestor(leaf, 40, isScrollable)).toBe(inner);
  });

  it('o de dentro já chegou no fim: passa pro de fora', () => {
    const outer = node({ scrolls: true, scrollHeight: 1000, clientHeight: 500 });
    const inner = node({ scrolls: true, scrollHeight: 800, clientHeight: 400, scrollTop: 400 }, outer);
    expect(scrollableAncestor(node({}, inner), 40, isScrollable)).toBe(outer);
  });

  it('subindo no topo: nada pra rolar', () => {
    const list = node({ scrolls: true, scrollHeight: 1000, clientHeight: 500, scrollTop: 0 });
    expect(scrollableAncestor(node({}, list), -40, isScrollable)).toBeNull();
  });

  it('nada rola na cadeia (ex.: a lateral)', () => {
    const root = node();
    expect(scrollableAncestor(node({}, node({}, root)), 40, isScrollable)).toBeNull();
  });

  it('conteúdo cabe inteiro: não conta como rolável', () => {
    const rail = node({ scrolls: true, scrollHeight: 300, clientHeight: 300 });
    expect(scrollableAncestor(node({}, rail), 40, isScrollable)).toBeNull();
  });
});

describe('wheelPixels', () => {
  it('pixels, linhas (Firefox) e páginas', () => {
    expect(wheelPixels(53, 0, 800)).toBe(53);
    expect(wheelPixels(3, 1, 800)).toBe(48);
    expect(wheelPixels(-1, 2, 800)).toBe(-800);
  });
});
