// Pixel art desenhada como SVG (sai nítida em qualquer tela). Cada letra é uma cor; '.' é transparente.
export type Pixels = { linhas: readonly string[]; cores: Readonly<Record<string, string>> };

export const UNICORNIO: Pixels = {
  cores: { a: '#0B0A0E', b: '#FFE9A8', c: '#C9962F', d: '#F4F1EA', e: '#FFD25E', f: '#B8A2FF', g: '#7E66E8', h: '#C9C4B8' },
  linhas: [
    '............aba.', '.......a...abca.', '...aaaada.aeca..', '..affaddaabca...',
    '.afffafdaeca....', 'afffaffddaa.....', 'affgadddddda....', 'fffaddddaddda...',
    'affaddddddddda..', 'ffgadddddddddda.', 'affahdddddddhda.', 'affahhdddahddda.',
    '.afahhdddaahha..', '.afahhdda..aa...', '..aahhdda.......', '...aaaaa........',
  ],
};

export const FELLAS_INC: Pixels = {
  cores: { a: '#0B0A0E', b: '#DDD2FF', c: '#5B3FD9', d: '#B8A2FF', e: '#3A2A66', f: '#7E66E8', g: '#424066', h: '#323150', i: '#211F29', j: '#1B1A22', k: '#B8913A', l: '#FFD25E', m: '#6B6874', n: '#C9962F' },
  linhas: [
    '..........aba...........', '........a.aca.a.........', '.....a.abaacaaba.a......', '....abaacadcdacaaba.....',
    '....acddcdcccdcddca.....', '....accccccccccccca.....', '....addddddddddddda.....', '....aebebebebebebea.....',
    '....afffffffffffffa.....', '.....aaaaaaaaaaaaaa.....', '.....aghhhhhhhhiija.....', '.....aghbbdddhhikja.....',
    '.....aghdhhhhhhiija.....', '.....aghdhhlhghikja.....', '.....aghddddhhhiija.....', '.....aghdhhhhhhikja.....',
    '.....aghdhhlhlhiija.....', '.....aghdhhhhhhikja.....', '.....aghdhlghlhiija.....', '.....aghmmmmmmhiija.....',
    '.....aghhnllnhhiija.....', '.....aghhnllnhhiija.....', '.....aghhnllnhhiija.....', '......aaaaaaaaaaaa......',
  ],
};
