import { fireEvent, render, screen } from '@testing-library/react-native';

import { Slider } from '../components/ui';

const setup = async (value = 0.4) => {
  const onChange = jest.fn();
  await render(<Slider value={value} onChange={onChange} accessibilityLabel="Volume" />);
  const track = screen.getByLabelText('Volume');
  await fireEvent(track, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 100, height: 44 } } });
  return { onChange, track };
};

describe('Slider', () => {
  it('é ajustável e diz o valor em %', async () => {
    const { track } = await setup(0.4);
    expect(track.props.accessibilityRole).toBe('adjustable');
    // aria-* (e não accessibilityValue): o react-native-web 0.21 só repassa estes para o <div>
    expect(track.props['aria-valuemin']).toBe(0);
    expect(track.props['aria-valuemax']).toBe(100);
    expect(track.props['aria-valuenow']).toBe(40);
    expect(track.props['aria-valuetext']).toBe('40%');
  });

  it('tocar no trilho pula para o ponto; arrastar acompanha, até fora do trilho', async () => {
    const { onChange, track } = await setup();
    expect(track.props.onStartShouldSetResponder()).toBe(true);
    // só começa com clique/toque: no site o mouse passando por cima não pode mexer no valor
    expect(track.props.onMoveShouldSetResponder).toBeUndefined();
    await fireEvent(track, 'responderGrant', { nativeEvent: { locationX: 25, pageX: 525 } });
    expect(onChange).toHaveBeenLastCalledWith(0.25);
    await fireEvent(track, 'responderMove', { nativeEvent: { locationX: 0, pageX: 590 } });
    expect(onChange).toHaveBeenLastCalledWith(0.9);
    await fireEvent(track, 'responderMove', { nativeEvent: { locationX: 0, pageX: 700 } });
    expect(onChange).toHaveBeenLastCalledWith(1);
    await fireEvent(track, 'responderMove', { nativeEvent: { locationX: 0, pageX: 300 } });
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it('leitor de tela: aumentar/diminuir anda 10%, sem passar dos limites', async () => {
    const { onChange, track } = await setup(0.95);
    await fireEvent(track, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onChange).toHaveBeenLastCalledWith(1);
    await fireEvent(track, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(onChange).toHaveBeenLastCalledWith(0.85);
  });

  it('no site, as setas do teclado andam 10%', async () => {
    const { onChange, track } = await setup(0.4);
    expect(track.props.focusable).toBe(true);
    const preventDefault = jest.fn();
    await fireEvent(track, 'keyDown', { nativeEvent: { key: 'ArrowRight' }, preventDefault });
    expect(onChange).toHaveBeenLastCalledWith(0.5);
    await fireEvent(track, 'keyDown', { nativeEvent: { key: 'ArrowDown' }, preventDefault });
    expect(onChange).toHaveBeenLastCalledWith(0.3);
    expect(preventDefault).toHaveBeenCalledTimes(2);
    await fireEvent(track, 'keyDown', { nativeEvent: { key: 'Tab' }, preventDefault });
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
