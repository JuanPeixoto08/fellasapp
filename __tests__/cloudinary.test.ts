import { STORY_TRANSFORMATIONS, storyMediaUrl, storyOriginalUrl, storyThumbUrl } from '../lib/cloudinary';
import { TRANSFORMATIONS } from '../supabase/functions/stories-media/rules';

const ID = `stories/${'a'.repeat(64)}`;

describe('endereços do Cloudinary', () => {
  it('versão reduzida e original por tipo', () => {
    expect(storyMediaUrl(ID, 'video')).toBe(`https://res.cloudinary.com/slxposvw/video/upload/c_limit,w_1280,h_1280,q_auto,f_mp4/${ID}`);
    // WebP animado (fl_awebp): GIF continua animado; foto comum vira WebP parado
    expect(storyMediaUrl(ID, 'photo')).toBe(`https://res.cloudinary.com/slxposvw/image/upload/c_limit,w_1920,h_1920,q_auto,f_webp,fl_awebp/${ID}`);
    expect(storyOriginalUrl(ID, 'video')).toBe(`https://res.cloudinary.com/slxposvw/video/upload/${ID}`);
  });

  it('miniatura pequena em JPG (do vídeo, o primeiro quadro) para os cartões do carrossel', () => {
    expect(storyThumbUrl(ID, 'photo')).toBe(`https://res.cloudinary.com/slxposvw/image/upload/c_fill,w_360,h_640,q_auto,f_jpg/${ID}`);
    expect(storyThumbUrl(ID, 'video')).toBe(`https://res.cloudinary.com/slxposvw/video/upload/so_0,c_fill,w_360,h_640,q_auto,f_jpg/${ID}`);
  });

  it('a entrega pede a mesma transformação que o envio gerou (senão gasta crédito à toa)', () => {
    expect(STORY_TRANSFORMATIONS).toEqual(TRANSFORMATIONS);
  });
});
