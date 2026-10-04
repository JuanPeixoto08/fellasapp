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

  it('desktop preso ao botão: painel de altura fixa perto dele, sem vazar o conteúdo', async () => {
    mockTier = 'expanded';
    await render(
      <SafeAreaProvider
        initialMetrics={{ frame: { x: 0, y: 0, width: 750, height: 1334 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}
      >
        <EmojiPicker visible selected={null} onSelect={() => {}} onClose={() => {}} anchor={{ x: 600, y: 900, width: 44, height: 44 }} />
      </SafeAreaProvider>,
    );
    const style = StyleSheet.flatten(screen.getByTestId('emoji-sheet').props.style);
    expect(style).toMatchObject({ position: 'absolute', width: 400, height: 420, overflow: 'hidden' });
    expect(style.top + 420).toBeLessThanOrEqual(900);
    expect(style.left + 400).toBe(644);
  });

  it('títulos e emojis não ficam colados na borda do painel', async () => {
    mockTier = 'expanded';
    await renderPicker();
    const title = await screen.findByText('Sorrisos e emoção');
    type Node = { props: { style?: { paddingHorizontal?: number } }; parent: Node | null };
    let node = title.parent as unknown as Node | null;
    let padded = false;
    for (let i = 0; i < 4 && node; i++, node = node.parent) {
      if (StyleSheet.flatten(node.props.style)?.paddingHorizontal === 16) padded = true;
    }
    expect(padded).toBe(true);
  });
});
