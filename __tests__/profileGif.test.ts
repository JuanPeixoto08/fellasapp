import { GIF_MAX_BYTES, gifProblem, isGif } from '../lib/profileImage';

describe('GIF na foto de perfil', () => {
  it('reconhece GIF pelo tipo ou pelo nome', () => {
    expect(isGif({ uri: 'blob:x', mimeType: 'image/gif' })).toBe(true);
    expect(isGif({ uri: 'file://eu.GIF' })).toBe(true);
    expect(isGif({ uri: 'file://eu.jpg', fileName: 'dança.gif' })).toBe(true);
    expect(isGif({ uri: 'file://eu.jpg', mimeType: 'image/jpeg' })).toBe(false);
  });

  it('até 5 MB (limite do armazenamento); tamanho desconhecido passa', () => {
    expect(GIF_MAX_BYTES).toBe(5 * 1024 * 1024);
    expect(gifProblem({ uri: 'a.gif', fileSize: GIF_MAX_BYTES })).toBeNull();
    expect(gifProblem({ uri: 'a.gif', fileSize: GIF_MAX_BYTES + 1 })).toBe('Esse GIF passa de 5 MB. Escolhe um menor.');
    expect(gifProblem({ uri: 'a.gif' })).toBeNull();
  });
});
