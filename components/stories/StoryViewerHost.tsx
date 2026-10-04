import { closeStories, useStoriesRequest } from '../../lib/storyViewerStore';
import { StoryViewer } from './StoryViewer';

/** Desenha o viewer de stories pedido de qualquer tela (montado uma vez, na raiz). */
export function StoryViewerHost() {
  const request = useStoriesRequest();
  if (!request) return null;
  return <StoryViewer key={`${request.authorId}:${request.storyId ?? ''}`} {...request} onClose={closeStories} />;
}
