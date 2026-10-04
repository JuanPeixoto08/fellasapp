import { render, screen } from '@testing-library/react-native';

import { Badge } from '../components/ui';

describe('Badge', () => {
  it('mostra o número', async () => {
    await render(<Badge count={3} />);
    expect(screen.getByText('3', { includeHiddenElements: true })).toBeTruthy();
  });

  it('acima de 9 vira 9+', async () => {
    await render(<Badge count={12} />);
    expect(screen.getByText('9+', { includeHiddenElements: true })).toBeTruthy();
  });

  it('zero não renderiza nada', async () => {
    await render(<Badge count={0} />);
    expect(screen.queryByTestId('badge', { includeHiddenElements: true })).toBeNull();
  });
});
