import { canShareFiles, shareOrDownload, STORY_FILE_NAME } from '../lib/storyCard/share';

const blob = { size: 1, type: 'image/jpeg' } as unknown as Blob;
const g = globalThis as unknown as Record<string, unknown>;
const saved = { navigator: g.navigator, document: g.document, File: g.File };
let link: { href: string; download: string; click: jest.Mock; remove: jest.Mock };

function setNavigator(nav: unknown) {
  Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true, writable: true });
}

beforeEach(() => {
  g.File = class {
    constructor(public parts: unknown[], public name: string, public opts: unknown) {}
  };
  link = { href: '', download: '', click: jest.fn(), remove: jest.fn() };
  g.document = { createElement: () => link, body: { appendChild: jest.fn() } };
  URL.createObjectURL = jest.fn(() => 'blob:story');
  URL.revokeObjectURL = jest.fn();
});
afterAll(() => {
  setNavigator(saved.navigator);
  g.document = saved.document;
  g.File = saved.File;
});

describe('compartilhar a imagem', () => {
  it('com a planilha do celular: manda o arquivo jpg', async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    setNavigator({ canShare: () => true, share });
    expect(canShareFiles()).toBe(true);
    await expect(shareOrDownload(blob)).resolves.toBe('shared');
    const file = share.mock.calls[0][0].files[0];
    expect(file.name).toBe(STORY_FILE_NAME);
  });

  it('a planilha é chamada na hora, sem esperar nada antes (Safari exige dentro do toque)', () => {
    const share = jest.fn(() => new Promise(() => {}));
    setNavigator({ canShare: () => true, share });
    void shareOrDownload(blob);
    expect(share).toHaveBeenCalledTimes(1);
  });

  it('fechar a planilha sem escolher não é erro', async () => {
    setNavigator({ canShare: () => true, share: jest.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' })) });
    await expect(shareOrDownload(blob)).resolves.toBe('cancelled');
    expect(link.click).not.toHaveBeenCalled();
  });

  it('sem planilha de arquivos (computador): baixa', async () => {
    setNavigator({});
    expect(canShareFiles()).toBe(false);
    await expect(shareOrDownload(blob)).resolves.toBe('downloaded');
    expect(link.download).toBe(STORY_FILE_NAME);
    expect(link.click).toHaveBeenCalled();
  });

  it('planilha recusada pelo navegador (ex.: toque expirou): baixa', async () => {
    setNavigator({ canShare: () => true, share: jest.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'NotAllowedError' })) });
    await expect(shareOrDownload(blob)).resolves.toBe('downloaded');
  });
});
