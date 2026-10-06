import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockOps: { op: string; arg?: unknown }[] = [];
let mockOpenFails = false;

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
  ImageManipulator: {
    manipulate: (uri: string) => {
      const ctx = {
        crop: (arg: unknown) => {
          mockOps.push({ op: 'crop', arg });
          return ctx;
        },
        resize: (arg: unknown) => {
          mockOps.push({ op: 'resize', arg });
          return ctx;
        },
        renderAsync: async () => {
          if (mockOpenFails) throw new Error('não abriu');
          return {
            width: 4000,
            height: 3000,
            saveAsync: async (arg: unknown) => {
              mockOps.push({ op: 'save', arg });
              return { uri: `${uri}#recortada`, width: 512, height: 512 };
            },
          };
        },
      };
      return ctx;
    },
  },
}));

import { AvatarCropper } from '../components/profile/AvatarCropper';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const onConfirm = jest.fn();
const onCancel = jest.fn();

async function open(uri: string | null = 'file://eu.jpg') {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AvatarCropper uri={uri} onConfirm={onConfirm} onCancel={onCancel} />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOps.length = 0;
  mockOpenFails = false;
});

describe('AvatarCropper', () => {
  it('fechado quando não tem foto', async () => {
    await open(null);
    expect(screen.queryByText('Ajustar foto')).toBeNull();
  });

  it('"Usar foto" sem mexer recorta o quadrado do meio e salva 512 em JPEG', async () => {
    await open();
    expect(screen.getByText('Ajustar foto')).toBeTruthy();
    await fireEvent.press(await screen.findByLabelText('Usar foto'));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('file://eu.jpg#recortada'));
    expect(mockOps).toEqual([
      { op: 'crop', arg: { originX: 500, originY: 0, width: 3000, height: 3000 } },
      { op: 'resize', arg: { width: 512, height: 512 } },
      { op: 'save', arg: { compress: 0.8, format: 'jpeg' } },
    ]);
  });

  it('botões de zoom: em 1x não afasta; 2 toques no + dão 2x', async () => {
    await open();
    const zoomOut = await screen.findByLabelText('Diminuir zoom');
    expect(zoomOut.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByLabelText('Aumentar zoom'));
    await fireEvent.press(screen.getByLabelText('Aumentar zoom'));
    await fireEvent.press(screen.getByLabelText('Usar foto'));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(mockOps[0]).toEqual({ op: 'crop', arg: { originX: 1250, originY: 750, width: 1500, height: 1500 } });
  });

  it('Cancelar não recorta nada', async () => {
    await open();
    await fireEvent.press(await screen.findByLabelText('Cancelar'));
    expect(onCancel).toHaveBeenCalled();
    expect(mockOps).toEqual([]);
  });

  it('foto que não abre avisa e deixa só cancelar', async () => {
    mockOpenFails = true;
    await open();
    expect(await screen.findByText('Não consegui abrir essa foto. Tenta outra.')).toBeTruthy();
    expect(screen.queryByLabelText('Usar foto')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Cancelar'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('banner: retângulo 3:1, recorta a faixa do meio e salva 1500x500', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <AvatarCropper uri="file://praia.jpg" shape="banner" onConfirm={onConfirm} onCancel={onCancel} />
      </SafeAreaProvider>,
    );
    expect(screen.getByText('Ajustar banner')).toBeTruthy();
    await fireEvent.press(await screen.findByLabelText('Usar foto'));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('file://praia.jpg#recortada'));
    const crop = mockOps[0].arg as { originX: number; originY: number; width: number; height: number };
    // foto 4000x3000: a largura inteira, um terço da altura, centralizado
    expect(crop.width).toBe(4000);
    expect(crop.width / crop.height).toBeCloseTo(3, 1);
    expect(crop.originX).toBe(0);
    expect(Math.abs(crop.originY - (3000 - crop.height) / 2)).toBeLessThanOrEqual(1);
    expect(mockOps.slice(1)).toEqual([
      { op: 'resize', arg: { width: 1500, height: 500 } },
      { op: 'save', arg: { compress: 0.8, format: 'jpeg' } },
    ]);
  });
});
