import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { FlatList } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ReactionPicker } from '../components/reactions';
import { EmojiPickerHost } from '../components/reactions/EmojiPickerHost';
import { isValidReactionEmoji } from '../lib/api/reactions';
import { getRecentEmojis, loadEmojiGroups, normalize, pushRecentEmoji, searchEmojis } from '../lib/emoji';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('emoji data', () => {
  it('carrega as categorias sem "componentes" e com Bandeiras traduzido', async () => {
    const groups = await loadEmojiGroups();
    expect(groups.map((g) => g.title)).toEqual([
      'Sorrisos e emoção',
      'Pessoas e corpo',
      'Animais e natureza',
      'Comida e bebida',
      'Viagens e lugares',
      'Atividades',
      'Objetos',
      'Símbolos',
      'Bandeiras',
    ]);
    expect(groups.reduce((n, g) => n + g.emojis.length, 0)).toBeGreaterThan(1800);
    expect(groups[0].emojis[0].emoji).toBe('😀');
  });

  it('busca em português pelos apelidos, sem depender de acento', async () => {
    const groups = await loadEmojiGroups();
    expect(searchEmojis(groups, 'kkk').map((e) => e.emoji)).toContain('😂');
    expect(searchEmojis(groups, 'coracao').map((e) => e.emoji)).toContain('❤️');
    expect(searchEmojis(groups, '   ')).toEqual([]);
  });

  it('normaliza maiúsculas e acentos', () => {
    expect(normalize('Coração Gargalhada')).toBe('coracao gargalhada');
  });
});

describe('recentes', () => {
  it('guarda o mais recente primeiro, sem repetir', async () => {
    await pushRecentEmoji('😂');
    await pushRecentEmoji('🔥');
    await pushRecentEmoji('😂');
    expect(await getRecentEmojis()).toEqual(['😂', '🔥']);
  });

  it('limita a 24', async () => {
    for (let i = 0; i < 30; i++) await pushRecentEmoji(String.fromCodePoint(0x1f600 + i));
    expect(await getRecentEmojis()).toHaveLength(24);
  });
});

describe('isValidReactionEmoji', () => {
  it.each(['😂', '👨‍👩‍👧‍👦', '🇧🇷', '1️⃣', '👍🏽'])('aceita %s', (e) => {
    expect(isValidReactionEmoji(e)).toBe(true);
  });
  it.each(['', 'oi tudo bem', 'a'.repeat(17)])('rejeita %p', (e) => {
    expect(isValidReactionEmoji(e)).toBe(false);
  });
});

function renderPicker(props: Partial<Parameters<typeof ReactionPicker>[0]> = {}) {
  return render(
    <SafeAreaProvider
      initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}
    >
      {/* como no app: a barra mora num post dentro da lista do feed; o painel completo, na raiz */}
      <FlatList
        data={[1]}
        keyExtractor={String}
        renderItem={() => <ReactionPicker visible selected={null} onSelect={() => {}} onClose={() => {}} {...props} />}
      />
      <EmojiPickerHost />
    </SafeAreaProvider>,
  );
}

describe('ReactionPicker + seletor completo', () => {
  it('o "+" abre todos os emojis e escolher um reage e vira recente', async () => {
    const onSelect = jest.fn();
    await renderPicker({ onSelect });
    await fireEvent.press(screen.getByLabelText('Mais emojis'));
    await fireEvent.changeText(await screen.findByLabelText('Buscar emoji'), 'kkk');
    await fireEvent.press(await screen.findByLabelText('rosto chorando de rir'));
    expect(onSelect).toHaveBeenCalledWith('😂');
    expect(await getRecentEmojis()).toEqual(['😂']);
    expect(screen.queryByLabelText('Buscar emoji')).toBeNull(); // o painel fecha
  });

  it('o painel rola de verdade mesmo aberto de um post do feed', async () => {
    await renderPicker();
    await fireEvent.press(screen.getByLabelText('Mais emojis'));
    await screen.findByText('Sorrisos e emoção');
    expect(screen.getByTestId('emoji-list').type).toBe('RCTScrollView');
  });

  it('busca sem resultado avisa', async () => {
    await renderPicker();
    await fireEvent.press(screen.getByLabelText('Mais emojis'));
    await fireEvent.changeText(await screen.findByLabelText('Buscar emoji'), 'xyzqwe');
    expect(await screen.findByText(/Nada com “xyzqwe”/)).toBeTruthy();
  });

  it('minha reação fora dos 6 rápidos aparece primeiro na barra (para remover)', async () => {
    await renderPicker({ selected: '🔥' });
    expect(screen.getByLabelText('Reagir com 🔥').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.queryByLabelText('Reagir com 🙏')).toBeNull();
  });
});
