import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Emoji } from '../components/ui';
import { placePopover } from '../lib/popover';
import { twemojiUrl } from '../lib/twemoji';

describe('twemojiUrl', () => {
  const base = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@16.0.1/assets/72x72/';
  it('código do emoji, sem o seletor de variação quando não é sequência', () => {
    expect(twemojiUrl('😂')).toBe(`${base}1f602.png`);
    expect(twemojiUrl('❤️')).toBe(`${base}2764.png`);
    expect(twemojiUrl('🇧🇷')).toBe(`${base}1f1e7-1f1f7.png`);
  });
  it('sequência com ZWJ mantém tudo', () => {
    expect(twemojiUrl('❤️‍🔥')).toBe(`${base}2764-fe0f-200d-1f525.png`);
    expect(twemojiUrl('👍🏽')).toBe(`${base}1f44d-1f3fd.png`);
  });
});

describe('placePopover', () => {
  const viewport = { width: 1000, height: 800 };
  const size = { width: 300, height: 52 };
  it('acima do botão, alinhada pela direita dele', () => {
    expect(placePopover({ x: 600, y: 400, width: 44, height: 44 }, size, viewport, 16, 4)).toEqual({ left: 344, top: 344 });
  });
  it('sem espaço em cima: abre embaixo', () => {
    expect(placePopover({ x: 600, y: 20, width: 44, height: 44 }, size, viewport, 16, 4)).toEqual({ left: 344, top: 68 });
  });
  it('nunca sai da tela pelos lados nem por baixo', () => {
    expect(placePopover({ x: 10, y: 400, width: 44, height: 44 }, size, viewport, 16, 4).left).toBe(16);
    expect(placePopover({ x: 990, y: 400, width: 44, height: 44 }, size, viewport, 16, 4).left).toBe(684);
    const tall = { width: 300, height: 700 };
    expect(placePopover({ x: 600, y: 300, width: 44, height: 44 }, tall, viewport, 16, 4).top).toBe(84);
  });
});

describe('Emoji', () => {
  it('desenho do próprio site, no tamanho do token', async () => {
    await render(<Emoji emoji="😂" size="lg" />);
    const img = screen.getByTestId('emoji-😂');
    expect(img.props.source).toEqual({ uri: 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@16.0.1/assets/72x72/1f602.png' });
    expect(StyleSheet.flatten(img.props.style)).toMatchObject({ width: 28, height: 28 });
  });

  it('se a imagem não carregar, usa o emoji do aparelho', async () => {
    await render(<Emoji emoji="🫨" size="sm" />);
    await fireEvent(screen.getByTestId('emoji-🫨'), 'error');
    expect(screen.getByText('🫨')).toBeTruthy();
  });
});
