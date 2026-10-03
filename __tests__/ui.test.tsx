import { fireEvent, render, screen } from '@testing-library/react-native';

import {
  Avatar,
  Button,
  Card,
  Divider,
  EmptyState,
  Heading,
  Screen,
  Text,
  TextField,
} from '../components/ui';
import { colors, getTheme } from '../lib/theme';

describe('theme', () => {
  it('has the same color keys in light and dark', () => {
    expect(Object.keys(colors.dark).sort()).toEqual(Object.keys(colors.light).sort());
    expect(getTheme('dark').colors.bg).not.toBe(getTheme('light').colors.bg);
  });
});

describe('components/ui', () => {
  it('renders Screen with children', async () => {
    await render(
      <Screen scroll>
        <Text>dentro da tela</Text>
      </Screen>,
    );
    expect(screen.getByText('dentro da tela')).toBeTruthy();
  });

  it('renders Text and Heading', async () => {
    await render(
      <>
        <Heading>Título</Heading>
        <Text tone="muted">Corpo</Text>
      </>,
    );
    expect(screen.getByRole('header')).toBeTruthy();
    expect(screen.getByText('Corpo')).toBeTruthy();
  });

  it('Button fires onPress and blocks while loading', async () => {
    const onPress = jest.fn();
    await render(<Button title="Postar" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Postar' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('Button does not fire when loading', async () => {
    const onPress = jest.fn();
    await render(<Button title="Entrar" loading onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('TextField shows label, value changes and error', async () => {
    const onChangeText = jest.fn();
    await render(<TextField label="Email" error="Email inválido" onChangeText={onChangeText} />);
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByText('Email inválido')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Email'), 'a@b.c');
    expect(onChangeText).toHaveBeenCalledWith('a@b.c');
  });

  it('Avatar shows initials without photo', async () => {
    await render(<Avatar name="Juan Peixoto" />);
    expect(screen.getByText('JP')).toBeTruthy();
  });

  it('Avatar renders photo when uri is given', async () => {
    await render(<Avatar name="Ana" uri="https://example.com/a.png" />);
    expect(screen.getByLabelText('Foto de Ana')).toBeTruthy();
  });

  it('renders Card and Divider', async () => {
    await render(
      <Card>
        <Text>conteúdo do card</Text>
        <Divider />
      </Card>,
    );
    expect(screen.getByText('conteúdo do card')).toBeTruthy();
  });

  it('EmptyState renders copy and action', async () => {
    const onAction = jest.fn();
    await render(
      <EmptyState title="Ninguém postou ainda" message="Quebra o gelo." actionLabel="Bora postar" onAction={onAction} />,
    );
    expect(screen.getByText('Ninguém postou ainda')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Bora postar' }));
    expect(onAction).toHaveBeenCalled();
  });
});
