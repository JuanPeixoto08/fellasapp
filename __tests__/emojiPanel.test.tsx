import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { EmojiPicker } from '../components/reactions/EmojiPicker';

let mockTier = 'compact';
jest.mock('../lib/layout', () => ({ useLayoutTier: () => mockTier }));

const renderPicker = () =>
  render(
    <SafeAreaProvider
      initialMetrics={{ frame: { x: 0, y: 0, width: 750, height: 1334 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}
    >
      <EmojiPicker visible selected={null} onSelect={() => {}} onClose={() => {}} />
    </SafeAreaProvider>,
  );

describe('EmojiPicker por faixa', () => {
  it('celular: folha de baixo na largura da tela, só cantos de cima arredondados', async () => {
    mockTier = 'compact';
    await renderPicker();
    const style = StyleSheet.flatten(screen.getByTestId('emoji-sheet').props.style);
    expect(style).toMatchObject({ width: '100%', borderTopLeftRadius: 12, borderTopRightRadius: 12 });
    expect(style.borderRadius).toBeUndefined();
  });

  it('desktop: painel centralizado de 400 com os quatro cantos arredondados', async () => {
    mockTier = 'expanded';
    await renderPicker();
    const style = StyleSheet.flatten(screen.getByTestId('emoji-sheet').props.style);
    expect(style).toMatchObject({ width: 400, borderRadius: 12 });
  });
});
