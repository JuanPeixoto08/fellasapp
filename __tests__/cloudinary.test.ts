import { STORY_TRANSFORMATIONS, storyMediaUrl, storyOriginalUrl } from '../lib/cloudinary';
import { TRANSFORMATIONS } from '../supabase/functions/stories-media/rules';

const ID = `stories/${'a'.repeat(64)}`;

describe('endereços do Cloudinary', () => {
  it('versão reduzida e original por tipo', () => {
    expect(storyMediaUrl(ID, 'video')).toBe(`https://res.cloudinary.com/slxposvw/video/upload/c_limit,w_1280,h_1280,q_auto,f_mp4/${ID}`);
    expect(storyMediaUrl(ID, 'photo')).toBe(`https://res.cloudinary.com/slxposvw/image/upload/c_limit,w_1920,h_1920,q_auto,f_jpg/${ID}`);
    expect(storyOriginalUrl(ID, 'video')).toBe(`https://res.cloudinary.com/slxposvw/video/upload/${ID}`);
  });

  it('a entrega pede a mesma transformação que o envio gerou (senão gasta crédito à toa)', () => {
    expect(STORY_TRANSFORMATIONS).toEqual(TRANSFORMATIONS);
  });
});
