import type { StoryKind } from './api/stories';

/** Conta do Cloudinary dos stories (não é segredo: aparece em todo endereço de entrega). */
export const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || 'slxposvw';

/** Mesma transformação que a função pede no envio (eager): a entrega acha a versão pronta. */
export const STORY_TRANSFORMATIONS: Record<StoryKind, string> = {
  video: 'c_limit,w_1280,h_1280,q_auto,f_mp4',
  photo: 'c_limit,w_1920,h_1920,q_auto,f_webp,fl_awebp',
};

const base = (kind: StoryKind) =>
  `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/${kind === 'video' ? 'video' : 'image'}/upload`;

/** Versão reduzida (a que o app mostra). */
export const storyMediaUrl = (mediaId: string, kind: StoryKind) => `${base(kind)}/${STORY_TRANSFORMATIONS[kind]}/${mediaId}`;
/** Miniatura dos cartões do carrossel (vídeo: o primeiro quadro), pequena e em JPG. */
const THUMB = 'c_fill,w_360,h_640,q_auto,f_jpg';
export const storyThumbUrl = (mediaId: string, kind: StoryKind) =>
  `${base(kind)}/${kind === 'video' ? `so_0,${THUMB}` : THUMB}/${mediaId}`;
/** O arquivo como foi enviado (vídeo: enquanto a reduzida ainda processa). */
export const storyOriginalUrl = (mediaId: string, kind: StoryKind) => `${base(kind)}/${mediaId}`;
