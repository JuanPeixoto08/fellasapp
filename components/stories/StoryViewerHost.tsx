import { closeStories, emitStoriesChanged, useStoriesRequest } from '../../lib/storyViewerStore';
import { StoryViewer } from './StoryViewer';

/** Desenha o viewer de stories pedido de qualquer tela (montado uma vez, na raiz). */
export function StoryViewerHost() {
  const request = useStoriesRequest();
  if (!request) return null;
  // fechou: a faixa recarrega para os anéis do que acabei de ver ficarem cinza
  const close = () => {
    closeStories();
    emitStoriesChanged();
  };
  return <StoryViewer key={`${request.authorId}:${request.storyId ?? ''}`} {...request} onClose={close} />;
}
