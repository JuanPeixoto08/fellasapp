import { fireEvent, render, screen } from '@testing-library/react-native';

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
});
