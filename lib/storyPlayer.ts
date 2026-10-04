import type { StoryGroup } from './api/stories';

export type Cursor = { group: number; story: number };

/** Faixa e ordem de exibição: eu primeiro; depois quem tem story não visto (mais recente primeiro); depois o resto. */
export function orderGroups(groups: StoryGroup[], myId: string): StoryGroup[] {
  return [...groups].sort((a, b) => {
    if (a.author.id === myId) return -1;
    if (b.author.id === myId) return 1;
    if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
    return b.latestAt.localeCompare(a.latestAt);
  });
}

/** Onde abrir: o story pedido, ou o primeiro não visto da pessoa, ou o primeiro dela. */
export function startAt(groups: StoryGroup[], authorId: string, storyId?: string): Cursor | null {
  const group = groups.findIndex((g) => g.author.id === authorId);
  if (group < 0) return null;
  const stories = groups[group].stories;
  const wanted = storyId ? stories.findIndex((s) => s.id === storyId) : -1;
  if (wanted >= 0) return { group, story: wanted };
  const unseen = stories.findIndex((s) => !s.seen);
  return { group, story: unseen >= 0 ? unseen : 0 };
}

export function nextCursor(groups: StoryGroup[], c: Cursor): Cursor | null {
  if (c.story + 1 < groups[c.group].stories.length) return { group: c.group, story: c.story + 1 };
  if (c.group + 1 < groups.length) return { group: c.group + 1, story: 0 };
  return null;
}

export function prevCursor(groups: StoryGroup[], c: Cursor): Cursor {
  if (c.story > 0) return { group: c.group, story: c.story - 1 };
  if (c.group > 0) return { group: c.group - 1, story: groups[c.group - 1].stories.length - 1 };
  return c;
}
