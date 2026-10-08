import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), navigate: jest.fn() }), router: { push: jest.fn() } }));
jest.mock('../lib/supabase', () => ({ supabase: {} }));
jest.mock('../lib/auth/SessionProvider', () => ({ useSession: () => ({ session: { user: { id: 'me' } } }) }));
jest.mock('../lib/layout', () => ({ ...jest.requireActual('../lib/layout'), useLayoutTier: () => 'expanded' }));
jest.mock('../components/stories/StoriesBar', () => ({ StoriesBar: () => null }));
jest.mock('../components/feed/Composer', () => {
  const { Text } = require('react-native');
  return { Composer: () => <Text>compositor</Text> };
});
const mockShowNewPosts = jest.fn();
const mockRefresh = jest.fn();
jest.mock('../lib/usePostList', () => ({
  removePost: jest.fn(),
  usePostList: () => ({
    posts: [
      {
        id: 'p1',
        body: 'oi',
        images: [],
        imageUrl: null,
        createdAt: '2026-10-06T12:00:00Z',
        author: { id: 'u2', username: 'bia', display_name: 'Bia', avatar_url: null },
        likeCount: 0,
        commentCount: 0,
        likedByMe: false,
        reactions: [],
        myReaction: null,
      },
    ],
    newPosts: 2,
    showNewPosts: mockShowNewPosts,
    loading: false,
    refreshing: false,
    error: null,
    refresh: mockRefresh,
    reload: jest.fn(),
    loadMore: jest.fn(),
    like: jest.fn(),
    react: jest.fn(),
  }),
}));

import FeedScreen from '../app/(tabs)/feed';
import { emitFeedTop } from '../lib/postEvents';

const metrics = { frame: { x: 0, y: 0, width: 1200, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const pillStyle = () => StyleSheet.flatten(screen.getByTestId('new-posts-pill').props.style);
const scrollTo = (y: number) =>
  fireEvent.scroll(screen.getByTestId('feed-list'), {
    nativeEvent: { contentOffset: { x: 0, y }, contentSize: { width: 600, height: 3000 }, layoutMeasurement: { width: 600, height: 800 } },
  });

describe('Feed: aviso de posts novos', () => {
  it('no topo fica entre o compositor e os posts; rolou pra baixo, flutua; voltou, volta pro lugar', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <FeedScreen />
      </SafeAreaProvider>,
    );
    expect(pillStyle().position).toBeUndefined();
    await fireEvent(screen.getByTestId('feed-header'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 600, height: 180 } } });
    await scrollTo(400);
    expect(pillStyle().position).toBe('absolute');
    expect(screen.getAllByLabelText('2 posts novos')).toHaveLength(1);
    await scrollTo(0);
    expect(pillStyle().position).toBeUndefined();
    await fireEvent.press(screen.getByLabelText('2 posts novos'));
    expect(mockShowNewPosts).toHaveBeenCalled();
  });
});

describe('Feed: tocar em Feed estando nele', () => {
  it('recarrega (aba, lateral ou logo avisam por emitFeedTop)', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <FeedScreen />
      </SafeAreaProvider>,
    );
    mockRefresh.mockClear();
    emitFeedTop();
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });
});
