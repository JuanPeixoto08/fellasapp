import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

jest.mock('../components/feed/Composer', () => {
  const { Text } = require('react-native');
  return { Composer: () => <Text>compositor</Text> };
});

import { ComposeDialog } from '../components/shell/ComposeDialog';

describe('ComposeDialog', () => {
  it('compacta: sem altura fixa, cresce até um teto e fica perto do topo (não pula ao crescer)', async () => {
    await render(<ComposeDialog visible onClose={() => {}} />);
    const box = StyleSheet.flatten(screen.getByTestId('compose-dialog').props.style);
    expect(box.height).toBeUndefined();
    expect(box.maxHeight).toBeGreaterThan(0);
    const backdrop = StyleSheet.flatten(screen.getByTestId('compose-backdrop').props.style);
    expect(backdrop.justifyContent).toBe('flex-start');
  });
});
