import { addPasted, imagesFromPaste } from '../lib/pasteImages';

type Item = { kind: string; type: string; getAsFile: () => unknown };
const file = (type: string) => ({ name: 'x', type });
const pasteEvent = (items: Item[]) => {
  const preventDefault = jest.fn();
  return { event: { clipboardData: { items }, preventDefault } as never, preventDefault };
};
const item = (kind: string, type: string): Item => ({ kind, type, getAsFile: () => file(type) });

describe('imagesFromPaste', () => {
  it('imagem colada: devolve os arquivos e impede o navegador de colar como texto', () => {
    const { event, preventDefault } = pasteEvent([item('file', 'image/png'), item('file', 'image/jpeg')]);
    expect(imagesFromPaste(event)).toEqual([file('image/png'), file('image/jpeg')]);
    expect(preventDefault).toHaveBeenCalled();
  });

  it('texto do Word/Excel (vem com imagem junto) cola como texto', () => {
    const { event, preventDefault } = pasteEvent([item('string', 'text/plain'), item('file', 'image/png')]);
    expect(imagesFromPaste(event)).toEqual([]);
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('texto colado segue normal', () => {
    const { event, preventDefault } = pasteEvent([item('string', 'text/plain')]);
    expect(imagesFromPaste(event)).toEqual([]);
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('ignora arquivo que não é imagem e evento sem área de transferência', () => {
    const { event } = pasteEvent([item('file', 'application/pdf')]);
    expect(imagesFromPaste(event)).toEqual([]);
    expect(imagesFromPaste({ clipboardData: null, preventDefault: () => {} } as never)).toEqual([]);
  });
});

describe('addPasted', () => {
  it('junta até o limite e avisa quando sobra', () => {
    expect(addPasted(['a'], ['b', 'c'], 4)).toEqual({ uris: ['a', 'b', 'c'], overflow: false });
    expect(addPasted(['a', 'b', 'c'], ['d', 'e'], 4)).toEqual({ uris: ['a', 'b', 'c', 'd'], overflow: true });
  });
});
