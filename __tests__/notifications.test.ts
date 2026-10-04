import {
  describeNotification,
  notificationsLabel,
  notificationText,
  snippet,
  type AppNotification,
} from '../lib/notifications';

const p = (name: string) => ({ id: name.toLowerCase(), name, avatarUrl: null });
const base: AppNotification = {
  key: 'k',
  kind: 'like',
  postId: 'p1',
  commentId: null,
  storyId: null,
  actors: [p('Ana')],
  actorCount: 1,
  emojis: [],
  body: null,
  latestAt: '2026-10-04T12:00:00Z',
  unread: false,
  thumbUrl: null,
};
const n = (over: Partial<AppNotification>): AppNotification => ({ ...base, ...over });

describe('describeNotification', () => {
  it('curtida: 1, 2, 3 e 4+ pessoas, singular/plural', () => {
    expect(notificationText(n({}))).toBe('Ana curtiu seu post');
    expect(notificationText(n({ actors: [p('Ana'), p('Pedro')], actorCount: 2 }))).toBe('Ana e Pedro curtiram seu post');
    expect(notificationText(n({ actors: [p('Ana'), p('Pedro'), p('Bia')], actorCount: 3 }))).toBe(
      'Ana, Pedro e Bia curtiram seu post',
    );
    expect(notificationText(n({ actors: [p('Ana'), p('Pedro'), p('Bia')], actorCount: 5 }))).toBe(
      'Ana, Pedro e mais 3 curtiram seu post',
    );
  });

  it('nomes em negrito, o resto normal', () => {
    expect(describeNotification(n({ actors: [p('Ana'), p('Pedro')], actorCount: 2 }))).toEqual([
      { text: 'Ana', bold: true },
      { text: ' e ' },
      { text: 'Pedro', bold: true },
      { text: ' curtiram seu post' },
    ]);
  });

  it('reações em post e comentário mostram os emojis', () => {
    expect(notificationText(n({ kind: 'post_reaction', emojis: ['😂'] }))).toBe('Ana reagiu 😂 ao seu post');
    expect(
      notificationText(n({ kind: 'post_reaction', actors: [p('Ana'), p('Pedro')], actorCount: 2, emojis: ['😂', '🙏'] })),
    ).toBe('Ana e Pedro reagiram 😂 🙏 ao seu post');
    expect(notificationText(n({ kind: 'comment_reaction', commentId: 'c1', emojis: ['👍'] }))).toBe(
      'Ana reagiu 👍 ao seu comentário',
    );
  });

  it('comentário e resposta na conversa trazem o trecho', () => {
    expect(notificationText(n({ kind: 'comment', commentId: 'c1', body: 'haha que isso' }))).toBe(
      'Ana comentou: “haha que isso”',
    );
    expect(notificationText(n({ kind: 'thread_reply', commentId: 'c2', body: 'kkk' }))).toBe(
      'Ana também comentou num post que você comentou: “kkk”',
    );
  });

  it('reação no meu story', () => {
    expect(notificationText(n({ kind: 'story_reaction', postId: null, emojis: ['😂'] }))).toBe('Ana reagiu 😂 ao seu story');
    expect(
      notificationText(n({ kind: 'story_reaction', postId: null, actors: [p('Ana'), p('Pedro')], actorCount: 2, emojis: ['😂', '🔥'] })),
    ).toBe('Ana e Pedro reagiram 😂 🔥 ao seu story');
  });

  it('marcação em post e em comentário', () => {
    expect(notificationText(n({ kind: 'mention', body: '@juan parabéns' }))).toBe('Ana te marcou num post: “@juan parabéns”');
    expect(notificationText(n({ kind: 'mention', commentId: 'c1', body: 'olha isso @juan' }))).toBe(
      'Ana te marcou num comentário: “olha isso @juan”',
    );
  });

  it('aniversário e fella novo', () => {
    expect(notificationText(n({ kind: 'birthday', postId: null, actors: [p('Juan')] }))).toBe(
      'Hoje é aniversário de Juan',
    );
    expect(notificationText(n({ kind: 'new_member', postId: null, actors: [p('Pedro')] }))).toBe('Pedro entrou no fellas');
  });

  it('sem perfil do ator vira "Alguém"', () => {
    expect(notificationText(n({ actors: [] }))).toBe('Alguém curtiu seu post');
    expect(notificationText(n({ actors: [], actorCount: 3 }))).toBe('Alguém e mais 2 curtiram seu post');
  });
});

describe('snippet', () => {
  it('corta em 80 com reticências e junta espaços', () => {
    expect(snippet('  oi\n  fellas ')).toBe('oi fellas');
    const long = 'a'.repeat(100);
    expect(snippet(long)).toHaveLength(80);
    expect(snippet(long).endsWith('…')).toBe(true);
    expect(snippet(null)).toBe('');
  });
});

describe('notificationsLabel', () => {
  it('diz quantas são novas', () => {
    expect(notificationsLabel(0)).toBe('Notificações');
    expect(notificationsLabel(1)).toBe('Notificações, 1 nova');
    expect(notificationsLabel(3)).toBe('Notificações, 3 novas');
    expect(notificationsLabel(15)).toBe('Notificações, mais de 9 novas');
  });
});
