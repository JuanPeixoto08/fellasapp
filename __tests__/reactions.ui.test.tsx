import { fireEvent, render, screen } from '@testing-library/react-native';

import { ReactButton, ReactionBar, ReactionPicker } from '../components/reactions';

describe('ReactionPicker', () => {
  it('calls onSelect with the emoji', async () => {
    const onSelect = jest.fn();
    await render(<ReactionPicker visible selected={null} onSelect={onSelect} onClose={() => {}} />);
    await fireEvent.press(screen.getByLabelText('Reagir com 😂'));
    expect(onSelect).toHaveBeenCalledWith('😂');
  });

  it('marks the selected emoji', async () => {
    await render(<ReactionPicker visible selected="❤️" onSelect={() => {}} onClose={() => {}} />);
    expect(screen.getByLabelText('Reagir com ❤️').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByLabelText('Reagir com 👍').props.accessibilityState).toMatchObject({ selected: false });
  });

  it('closes when tapping outside', async () => {
    const onClose = jest.fn();
    await render(<ReactionPicker visible selected={null} onSelect={() => {}} onClose={onClose} />);
    await fireEvent.press(screen.getByLabelText('Fechar reações'));
    expect(onClose).toHaveBeenCalled();
  });

  it('does not nest button-role elements (invalid <button> in <button> on web)', async () => {
    await render(<ReactionPicker visible selected={null} onSelect={() => {}} onClose={() => {}} />);
    const isButton = (props: Record<string, unknown>) =>
      props.accessibilityRole === 'button' || props.role === 'button';
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(1);
    for (const button of buttons) {
      let ancestor = button.parent;
      while (ancestor) {
        expect(isButton(ancestor.props)).toBe(false);
        ancestor = ancestor.parent;
      }
    }
  });
});

describe('ReactionBar', () => {
  const reactions = [
    { emoji: '❤️', count: 3 },
    { emoji: '😂', count: 1 },
  ];

  it('shows counts and highlights myReaction', async () => {
    const onPressChip = jest.fn();
    await render(<ReactionBar reactions={reactions} myReaction="😂" onPressChip={onPressChip} />);
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByLabelText('😂 1 reação').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByLabelText('❤️ 3 reações').props.accessibilityState).toMatchObject({ selected: false });
    await fireEvent.press(screen.getByLabelText('❤️ 3 reações'));
    expect(onPressChip).toHaveBeenCalledWith('❤️');
  });

  it('renders nothing when empty', async () => {
    await render(<ReactionBar reactions={[]} myReaction={null} />);
    expect(screen.toJSON()).toBeNull();
  });
});

describe('ReactButton', () => {
  it('is labelled Reagir', async () => {
    const onPress = jest.fn();
    await render(<ReactButton onPress={onPress} />);
    await fireEvent.press(screen.getByLabelText('Reagir'));
    expect(onPress).toHaveBeenCalled();
  });
});
