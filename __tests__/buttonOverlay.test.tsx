import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Button } from '../components/ui';
import { getTheme } from '../lib/theme';

const t = getTheme('light');
const colorOf = (text: string) => StyleSheet.flatten(screen.getByText(text).props.style).color;

describe('Button no palco escuro', () => {
  it('overlay: preenchido claro, texto escuro', async () => {
    await render(<Button title="Story do Fellas" variant="overlay" icon="add-circle-outline" />);
    expect(colorOf('Story do Fellas')).toBe(t.colors.viewerBg);
  });

  it('overlayOutline: só o fio, texto claro', async () => {
    await render(<Button title="Instagram" variant="overlayOutline" icon="logo-instagram" />);
    expect(colorOf('Instagram')).toBe(t.colors.onOverlay);
  });
});
