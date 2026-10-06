import { fireEvent, render, screen } from '@testing-library/react-native';

const mockOpen = jest.fn();
jest.mock('../lib/storyViewerStore', () => ({ openStories: (...a: unknown[]) => mockOpen(...a), onStoriesChanged: () => () => {} }));
let mockGroups: unknown[] = [];
jest.mock('../lib/useStories', () => ({ useStories: () => ({ groups: mockGroups, loading: false, reload: jest.fn() }) }));
jest.mock('../lib/useMyAvatar', () => ({ useMyAvatar: () => ({ name: 'Juan', uri: null }) }));
jest.mock('../lib/auth/SessionProvider', () => ({ useSession: () => ({ session: { user: { id: 'me' } } }) }));
jest.mock('../components/stories/StoryComposer', () => {
  const { Text } = require('react-native');
  return { StoryComposer: ({ visible }: { visible: boolean }) => (visible ? <Text>composer-aberto</Text> : null) };
});

import { StoriesBar } from '../components/stories/StoriesBar';

const grp = (id: string, hasUnseen: boolean) => ({ author: { id, name: id.toUpperCase(), username: id, avatarUrl: null }, stories: [{ id: `${id}1` }], hasUnseen, latestAt: '' });

beforeEach(() => jest.clearAllMocks());

describe('StoriesBar', () => {
  it('sem stories: só "Seu story", que abre o composer', async () => {
    mockGroups = [];
    await render(<StoriesBar />);
    await fireEvent.press(screen.getByLabelText('Postar story'));
    expect(screen.getByText('composer-aberto')).toBeTruthy();
  });

  it('bolinhas dos fellas com anel de não visto / visto; tocar abre o viewer', async () => {
    mockGroups = [grp('ana', true), grp('bia', false)];
    await render(<StoriesBar />);
    expect(screen.getByLabelText('Stories de ANA, tem novidade')).toBeTruthy();
    expect(screen.getByLabelText('Stories de BIA')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Stories de ANA, tem novidade'));
    expect(mockOpen).toHaveBeenCalledWith(mockGroups, 'ana');
  });

  it('com story meu: tocar na minha bolinha abre o meu; o "+" posta outro', async () => {
    mockGroups = [grp('me', false), grp('ana', true)];
    await render(<StoriesBar />);
    await fireEvent.press(screen.getByLabelText('Ver meu story'));
    expect(mockOpen).toHaveBeenCalledWith(mockGroups, 'me');
    await fireEvent.press(screen.getByLabelText('Postar story'));
    expect(screen.getByText('composer-aberto')).toBeTruthy();
  });
});
