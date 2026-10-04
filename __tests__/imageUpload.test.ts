const mockResize = jest.fn();
const mockSave = jest.fn();
let mockSize = { width: 4032, height: 3024 };
let mockFail = false;

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
  ImageManipulator: {
    manipulate: (uri: string) => {
      if (mockFail) throw new Error('formato não suportado');
      const ctx = {
        resize: (size: unknown) => {
          mockResize(uri, size);
          return ctx;
        },
        renderAsync: async () => ({
          width: mockSize.width,
          height: mockSize.height,
          saveAsync: async (opts: unknown) => {
            mockSave(opts);
            return { uri: `${uri}#reduzida`, width: 0, height: 0 };
          },
        }),
      };
      return ctx;
    },
  },
}));

import { UPLOAD_IMAGE, resizeTarget, shrinkForUpload } from '../lib/imageUpload';

beforeEach(() => {
  jest.clearAllMocks();
  mockSize = { width: 4032, height: 3024 };
  mockFail = false;
});

describe('resizeTarget', () => {
  it('limita o lado maior a 2048 mantendo a proporção', () => {
    expect(UPLOAD_IMAGE).toEqual({ maxSide: 2048, quality: 0.8 });
    expect(resizeTarget(4032, 3024)).toEqual({ width: 2048 }); // foto deitada
    expect(resizeTarget(1170, 2532)).toEqual({ height: 2048 }); // print em pé
    expect(resizeTarget(3000, 3000)).toEqual({ width: 2048 });
  });

  it('foto que já cabe não é redimensionada', () => {
    expect(resizeTarget(2048, 1536)).toBeNull();
    expect(resizeTarget(800, 600)).toBeNull();
  });
});

describe('shrinkForUpload', () => {
  it('reduz foto grande e salva em JPEG 0.8', async () => {
    await expect(shrinkForUpload('file://grande.jpg')).resolves.toBe('file://grande.jpg#reduzida');
    expect(mockResize).toHaveBeenCalledWith('file://grande.jpg', { width: 2048 });
    expect(mockSave).toHaveBeenCalledWith({ compress: 0.8, format: 'jpeg' });
  });

  it('foto pequena só é recomprimida, sem redimensionar', async () => {
    mockSize = { width: 1080, height: 1350 };
    await expect(shrinkForUpload('file://pequena.png')).resolves.toBe('file://pequena.png#reduzida');
    expect(mockResize).not.toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalledWith({ compress: 0.8, format: 'jpeg' });
  });

  it('se não conseguir reduzir, manda a original (não trava o post)', async () => {
    mockFail = true;
    await expect(shrinkForUpload('file://estranha.heic')).resolves.toBe('file://estranha.heic');
  });
});
