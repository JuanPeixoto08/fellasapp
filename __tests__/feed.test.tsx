import { render, screen } from '@testing-library/react-native';

import FeedScreen from '../app/(tabs)/feed';

describe('FeedScreen', () => {
  it('renders the feed placeholder', async () => {
    await render(<FeedScreen />);
    expect(screen.getByText('Feed')).toBeTruthy();
  });
});
