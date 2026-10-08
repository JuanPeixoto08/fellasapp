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

describe('marca e fontes', () => {
  it('Logo FELLAS é uma imagem acessível com o nome do app', async () => {
    const { Logo } = require('../components/ui');
    await render(<Logo height={24} />);
    expect(screen.getByLabelText('fellas')).toBeTruthy();
  });

  it('Logo centered fica no meio do contêiner (tela de carregamento)', async () => {
    const { Logo } = require('../components/ui');
    await render(<Logo height={24} centered />);
    expect(screen.getByLabelText('fellas')).toHaveStyle({ alignSelf: 'center' });
  });

  it('todas as fontes do tema são Golos Text (Inter e Instrument Serif saíram)', () => {
    const { fonts } = require('../lib/theme');
    for (const family of Object.values(fonts) as string[]) expect(family).toMatch(/^GolosText_/);
  });
});

describe('Switch', () => {
  it('SwitchRow: chave com o rótulo como nome; mudar chama onChange', async () => {
    const { SwitchRow } = require('../components/ui');
    const onChange = jest.fn();
    await render(<SwitchRow label="Mostrar o que estou ouvindo" help="Aparece do lado do nome." value onChange={onChange} />);
    const toggle = screen.getByRole('switch', { name: 'Mostrar o que estou ouvindo' });
    expect(toggle.props.value).toBe(true);
    expect(screen.getByText('Aparece do lado do nome.')).toBeTruthy();
    await fireEvent(toggle, 'valueChange', false);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('SwitchRow desabilitado: chave desabilitada', async () => {
    const { SwitchRow } = require('../components/ui');
    await render(<SwitchRow label="Selo" value={false} onChange={jest.fn()} disabled />);
    expect(screen.getByRole('switch', { name: 'Selo' }).props.disabled).toBe(true);
  });
});

describe('ChoiceRow', () => {
  it('opção de escolha única: papel radio, marcada quando escolhida, tocar escolhe', async () => {
    const { ChoiceRow } = require('../components/ui');
    const onPress = jest.fn();
    await render(<ChoiceRow label="Verificado" selected={false} onPress={onPress} />);
    const row = screen.getByRole('radio', { name: 'Verificado' });
    expect(row.props.accessibilityState).toMatchObject({ checked: false });
    await fireEvent.press(row);
    expect(onPress).toHaveBeenCalled();
  });

  it('escolhida: marcada', async () => {
    const { ChoiceRow } = require('../components/ui');
    await render(<ChoiceRow label="Verificado" selected onPress={jest.fn()} />);
    expect(screen.getByRole('radio', { name: 'Verificado' }).props.accessibilityState).toMatchObject({ checked: true });
  });
});

describe('Select', () => {
  const options = [0, 1, 2].map((n) => ({ value: n, label: String(n) }));

  it('mostra o rótulo e o valor; tocar abre a lista e escolher fecha', async () => {
    const { Select } = require('../components/ui');
    const onChange = jest.fn();
    await render(<Select label="Dias" value={1} options={options} onChange={onChange} />);
    const field = screen.getByRole('button', { name: 'Dias: 1' });
    expect(screen.queryByRole('radio', { name: '2' })).toBeNull();
    await fireEvent.press(field);
    expect(screen.getByRole('radio', { name: '1' }).props.accessibilityState).toMatchObject({ checked: true });
    await fireEvent.press(screen.getByRole('radio', { name: '2' }));
    expect(onChange).toHaveBeenCalledWith(2);
    expect(screen.queryByRole('radio', { name: '2' })).toBeNull();
  });

  it('tocar fora fecha sem mudar', async () => {
    const { Select } = require('../components/ui');
    const onChange = jest.fn();
    await render(<Select label="Horas" value={0} options={options} onChange={onChange} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Horas: 0' }));
    // o painel é modal para o leitor de tela (fecha pelo voltar/Esc); o toque fora continua valendo
    await fireEvent.press(screen.getByLabelText('Fechar lista', { includeHiddenElements: true }));
    expect(screen.queryByRole('radio', { name: '1' })).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('desabilitado não abre', async () => {
    const { Select } = require('../components/ui');
    await render(<Select label="Minutos" value={0} options={options} onChange={jest.fn()} disabled />);
    await fireEvent.press(screen.getByRole('button', { name: 'Minutos: 0' }));
    expect(screen.queryByRole('radio', { name: '1' })).toBeNull();
  });
});
