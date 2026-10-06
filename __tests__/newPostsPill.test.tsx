import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { NewPostsPill } from '../components/feed/NewPostsPill';

describe('NewPostsPill', () => {
  it('sem posts novos não aparece', async () => {
    await render(<NewPostsPill count={0} onPress={() => {}} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('singular, plural e toque', async () => {
    const onPress = jest.fn();
    const view = await render(<NewPostsPill count={1} onPress={onPress} />);
    await fireEvent.press(screen.getByLabelText('1 post novo'));
    expect(onPress).toHaveBeenCalled();
    await view.rerender(<NewPostsPill count={4} onPress={onPress} />);
    expect(screen.getByLabelText('4 posts novos')).toBeTruthy();
  });

  it('no fluxo (padrão): centralizada, sem flutuar', async () => {
    await render(<NewPostsPill count={2} onPress={() => {}} />);
    const box = StyleSheet.flatten(screen.getByTestId('new-posts-pill').props.style);
    expect(box.position).toBeUndefined();
    expect(StyleSheet.flatten(screen.getByTestId('new-posts-pill-center').props.style).alignSelf).toBe('center');
  });

  it('flutuando: por cima, no topo, centralizada', async () => {
    await render(<NewPostsPill count={2} onPress={() => {}} floating />);
    const box = StyleSheet.flatten(screen.getByTestId('new-posts-pill').props.style);
    expect(box).toMatchObject({ position: 'absolute', left: 0, right: 0 });
    expect(StyleSheet.flatten(screen.getByTestId('new-posts-pill-center').props.style).alignSelf).toBe('center');
  });
});
