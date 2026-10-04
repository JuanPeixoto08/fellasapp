import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockStatus: ((e: { status: string }) => void)[] = [];
const mockPlayer = {
  play: jest.fn(),
  pause: jest.fn(),
  muted: false,
  loop: false,
  playing: true,
  status: 'loading',
  addListener: (event: string, fn: (e: { status: string }) => void) => {
    if (event === 'statusChange') mockStatus.push(fn);
    return { remove: () => {} };
  },
};
jest.mock('expo-video', () => {
  const { View } = require('react-native');
  return {
    useVideoPlayer: () => mockPlayer,
    VideoView: (props: object) => <View testID="story-video" {...props} />,
  };
});
const mockMarkViewed = jest.fn().mockResolvedValue(undefined);
const mockViewers = jest.fn();
const mockDelete = jest.fn().mockResolvedValue(undefined);
const mockReact = jest.fn().mockResolvedValue(undefined);
jest.mock('../lib/api/stories', () => ({
  STORY_PHOTO_MS: 5000,
  markStoryViewed: (id: string) => mockMarkViewed(id),
  listStoryViewers: (id: string) => mockViewers(id),
  deleteStory: (id: string) => mockDelete(id),
  reactToStory: (id: string, e: string | null) => mockReact(id, e),
}));
jest.mock('../lib/auth/SessionProvider', () => ({ useSession: () => ({ session: { user: { id: 'me' } } }) }));

import { StoryViewerHost } from '../components/stories/StoryViewerHost';
import type { StoryGroup } from '../lib/api/stories';
import { closeStories, onStoriesChanged, openStories } from '../lib/storyViewerStore';

const s = (id: string, kind: 'photo' | 'video' = 'photo') => ({ id, authorId: '', kind, mediaUrl: `https://w/m/${id}`, durationMs: 5000, createdAt: '2026-10-04T10:00:00Z', seen: false, myReaction: null });
const g = (id: string, ...stories: ReturnType<typeof s>[]): StoryGroup => ({ author: { id, name: id.toUpperCase(), username: id, avatarUrl: null }, stories, hasUnseen: true, latestAt: '' });
const metrics = { frame: { x: 0, y: 0, width: 400, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

async function open(groups: StoryGroup[], author: string) {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <StoryViewerHost />
    </SafeAreaProvider>,
  );
  await act(async () => openStories(groups, author));
}

beforeEach(() => {
  // o React desenha a tela com timers reais: só o relógio do story (setInterval) fica simulado
  jest.useFakeTimers({
    doNotFake: ['setImmediate', 'setTimeout', 'clearTimeout', 'queueMicrotask', 'nextTick', 'performance', 'Date', 'requestAnimationFrame', 'cancelAnimationFrame'],
  });
  jest.clearAllMocks();
  closeStories(); // nada montado ainda: sem act (um act síncrono aqui trava o render seguinte no RNTL 14)
});
afterEach(() => jest.useRealTimers());

/** A foto do story terminou de carregar (o relógio só anda depois disso). */
const loaded = () => act(async () => {
  fireEvent(screen.getByTestId('story-photo'), 'load');
});
const videoReady = () => act(async () => {
  mockStatus.forEach((fn) => fn({ status: 'readyToPlay' }));
});

describe('StoryViewer', () => {
  it('mostra o story, marca como visto e passa sozinho depois de 5 s', async () => {
    await open([g('ana', s('a1'), s('a2'))], 'ana');
    expect(screen.getByLabelText('Story 1 de 2 de ANA')).toBeTruthy();
    expect(mockMarkViewed).toHaveBeenCalledWith('a1');
    // a foto ainda não carregou: o tempo não corre
    await act(async () => {
      jest.advanceTimersByTime(6000);
    });
    expect(screen.getByLabelText('Story 1 de 2 de ANA')).toBeTruthy();
    await loaded();
    await act(async () => {
      jest.advanceTimersByTime(5100);
    });
    expect(screen.getByLabelText('Story 2 de 2 de ANA')).toBeTruthy();
  });

  it('acabou a pessoa: vai para a próxima; no fim, fecha', async () => {
    await open([g('ana', s('a1')), g('bia', s('b1'))], 'ana');
    await fireEvent.press(screen.getByLabelText('Próximo'));
    expect(screen.getByLabelText('Story 1 de 1 de BIA')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Próximo'));
    expect(screen.queryByLabelText(/Story \d de/)).toBeNull();
  });

  it('segurar pausa (o tempo não corre)', async () => {
    await open([g('ana', s('a1'), s('a2'))], 'ana');
    await loaded();
    await fireEvent(screen.getByLabelText('Próximo'), 'longPress');
    await act(async () => {
      jest.advanceTimersByTime(8000);
    });
    expect(screen.getByLabelText('Story 1 de 2 de ANA')).toBeTruthy();
    await fireEvent(screen.getByLabelText('Próximo'), 'pressOut');
    await act(async () => {
      jest.advanceTimersByTime(5100);
    });
    expect(screen.getByLabelText('Story 2 de 2 de ANA')).toBeTruthy();
  });

  it('vídeo usa o player', async () => {
    await open([g('ana', s('v1', 'video'))], 'ana');
    expect(screen.getByTestId('story-video')).toBeTruthy();
  });

  it('story dos outros: reagir; sem "Visto por"', async () => {
    await open([g('ana', s('a1'))], 'ana');
    expect(screen.queryByLabelText(/Visto por/)).toBeNull();
    await fireEvent.press(screen.getByLabelText('Reagir'));
    await fireEvent.press(screen.getByLabelText('Reagir com 😂'));
    expect(mockReact).toHaveBeenCalledWith('a1', '😂');
  });

  it('meu story: "Visto por" abre a lista; apagar pede confirmação', async () => {
    mockViewers.mockResolvedValue([{ person: { id: 'ana', name: 'Ana', username: 'ana', avatarUrl: null }, viewedAt: '2026-10-04T10:05:00Z', emoji: '🔥' }]);
    await open([g('me', s('m1'))], 'me');
    await act(async () => {});
    await fireEvent.press(screen.getByLabelText('Visto por 1'));
    expect(screen.getByText('Ana')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Apagar story'));
    await fireEvent.press(screen.getByLabelText('Apagar'));
    expect(mockDelete).toHaveBeenCalledWith('m1');
  });
});

describe('StoryViewer: revisão', () => {
  beforeEach(() => {
    mockStatus.length = 0;
    mockPlayer.playing = true;
    mockPlayer.muted = false;
  });

  it('vídeo: o relógio espera o vídeo ficar pronto; toca dentro da tela (playsInline)', async () => {
    await open([g('ana', s('v1', 'video'), s('v2', 'video'))], 'ana');
    expect(screen.getByTestId('story-video').props.playsInline).toBe(true);
    await act(async () => {
      jest.advanceTimersByTime(6000);
    });
    expect(screen.getByLabelText('Story 1 de 2 de ANA')).toBeTruthy();
    await videoReady();
    await act(async () => {
      jest.advanceTimersByTime(5100);
    });
    expect(screen.getByLabelText('Story 2 de 2 de ANA')).toBeTruthy();
  });

  it('no site, se o navegador bloquear o som, começa mudo (com botão para ligar)', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    mockPlayer.playing = false;
    await open([g('ana', s('v1', 'video'))], 'ana');
    await videoReady();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 900));
    });
    expect(screen.getByLabelText('Ligar som')).toBeTruthy();
    jest.restoreAllMocks();
  });

  it('fechar avisa a faixa (anel fica cinza na hora)', async () => {
    const listener = jest.fn();
    const off = onStoriesChanged(listener);
    await open([g('ana', s('a1'))], 'ana');
    await fireEvent.press(screen.getByLabelText('Fechar'));
    expect(listener).toHaveBeenCalled();
    off();
  });

  it('dentro do story só os emojis rápidos (sem o "+", que travaria no iPhone)', async () => {
    await open([g('ana', s('a1'))], 'ana');
    await fireEvent.press(screen.getByLabelText('Reagir'));
    expect(screen.getByLabelText('Reagir com 😂')).toBeTruthy();
    expect(screen.queryByLabelText('Mais emojis')).toBeNull();
  });
});
