import { font, layoutCard, type Line, type Measure } from '../lib/storyCard/layout';
import type { CardSource } from '../lib/storyCard/source';
import { storyCard as S } from '../lib/theme';

const sizeOf = (f: string) => Number(/^(\d+)px/.exec(f)![1]);
/** Largura falsa: meia letra por caractere (um emoji conta como 1). */
const measure: Measure = (text, f) => Array.from(text).length * sizeOf(f) * 0.5;
const widthOf = (line: Line, size: number) =>
  line.reduce((w, r) => w + measure(r.text, font(r.highlight ? 'semibold' : 'regular', size)), 0);

const INNER = S.width - 2 * S.clip.margin - 2 * S.clip.padding;
const MAX_BOTTOM = S.height - S.mark.bottom - S.mark.height - S.mark.gap;
const HEAD_W = INNER - S.header.avatar - S.header.gap;

const base: CardSource = {
  name: 'Caio Ramos', username: 'caio', avatarUrl: null, time: 'há 2 h', location: null,
  segments: [], bodyLength: 0, photoUrl: null, extraPhotos: 0, poll: null, ticket: null,
};
const withText = (text: string, extra: Partial<CardSource> = {}): CardSource => ({
  ...base, segments: [{ text, highlight: false }], bodyLength: Array.from(text).length, ...extra,
});
const noPhoto = { photoAspect: null };
const joined = (lines: Line[]) => lines.map((l) => l.map((r) => r.text).join(''));

describe('layoutCard', () => {
  it('texto curto sem anexo vira cartaz (72) e cada linha cabe', () => {
    const L = layoutCard(withText('o padeiro pediu bis e a gente deu'), noPhoto, measure);
    expect(L.text!.size).toBe(S.text.big);
    for (const line of L.text!.lines) expect(widthOf(line, 72)).toBeLessThanOrEqual(INNER);
  });

  it('recorte centrado um pouco acima do meio, dentro das faixas', () => {
    const L = layoutCard(withText('oi'), noPhoto, measure);
    expect(L.clip.y + L.clip.height / 2).toBeLessThan(S.height / 2);
    expect(L.clip.y).toBeGreaterThanOrEqual(S.safeTop);
    expect(L.clip.x).toBe(S.clip.margin);
    expect(L.clip.width).toBe(S.width - 2 * S.clip.margin);
  });

  it('com foto, texto no normal (54) e a foto com +N na largura do recorte', () => {
    const L = layoutCard(withText('o padeiro pediu bis', { photoUrl: 'https://x/a.jpg', extraPhotos: 2 }), { photoAspect: 4 / 3 }, measure);
    expect(L.text!.size).toBe(S.text.normal);
    expect(L.photo).toMatchObject({ width: INNER, height: Math.round(INNER / (4 / 3)), extra: 2 });
  });

  it('foto em pé fica no máximo 4:5 e 600 de altura', () => {
    const L = layoutCard(withText('oi', { photoUrl: 'https://x/a.jpg' }), { photoAspect: 0.5 }, measure);
    expect(L.photo!.height).toBe(S.photo.maxHeight);
  });

  it('foto que não carregou não entra', () => {
    expect(layoutCard(withText('oi', { photoUrl: 'https://x/a.jpg' }), noPhoto, measure).photo).toBeNull();
  });

  it('post só com foto: cabeçalho + foto, sem bloco de texto', () => {
    const L = layoutCard({ ...base, photoUrl: 'https://x/a.jpg' }, { photoAspect: 1 }, measure);
    expect(L.text).toBeNull();
    expect(L.photo!.y).toBe(L.clip.y + S.clip.padding + S.header.avatar + S.clip.gap);
  });

  it('texto longo desce até 40, corta com … e o recorte não invade a marca', () => {
    const L = layoutCard(withText('palavra '.repeat(400)), noPhoto, measure);
    expect(L.text!.size).toBe(S.text.min);
    const last = L.text!.lines[L.text!.lines.length - 1];
    expect(last[last.length - 1].text.endsWith('…')).toBe(true);
    expect(L.clip.y).toBeGreaterThanOrEqual(S.safeTop);
    expect(L.clip.y + L.clip.height).toBeLessThanOrEqual(MAX_BOTTOM);
    for (const line of L.text!.lines) expect(widthOf(line, S.text.min)).toBeLessThanOrEqual(INNER);
  });

  it('palavra maior que a linha quebra por letra', () => {
    const L = layoutCard(withText('a'.repeat(100)), noPhoto, measure);
    // 100 > 80 caracteres: 54 px, 27 px por letra, 27 letras por linha
    expect(joined(L.text!.lines)).toEqual(['a'.repeat(27), 'a'.repeat(27), 'a'.repeat(27), 'a'.repeat(19)]);
  });

  it('quebra de linha do post vira linha nova', () => {
    expect(joined(layoutCard(withText('oi\ntudo bem'), noPhoto, measure).text!.lines)).toEqual(['oi', 'tudo bem']);
  });

  it('menção continua destacada depois de quebrar', () => {
    const src = { ...base, segments: [{ text: 'bora ', highlight: false }, { text: '@juan', highlight: true }, { text: ' hoje', highlight: false }], bodyLength: 15 };
    const runs = layoutCard(src, noPhoto, measure).text!.lines.flat();
    expect(runs.filter((r) => r.highlight).map((r) => r.text)).toEqual(['@juan']);
  });

  it('o corte nunca parte um emoji', () => {
    const L = layoutCard(withText('😂'.repeat(3000)), noPhoto, measure);
    const all = joined(L.text!.lines).join('');
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(all)).toBe(false);
    expect(all.endsWith('…')).toBe(true);
  });

  it('nome e @usuario compridos são cortados na largura do cabeçalho', () => {
    const L = layoutCard({ ...withText('oi'), name: 'x'.repeat(200), username: 'y'.repeat(30) }, noPhoto, measure);
    expect(L.name.text.endsWith('…')).toBe(true);
    expect(measure(L.name.text, font('bold', S.header.name))).toBeLessThanOrEqual(HEAD_W);
    expect(measure(L.meta.text, font('regular', S.header.meta))).toBeLessThanOrEqual(HEAD_W);
  });

  it('local entra numa linha a mais do cabeçalho', () => {
    const L = layoutCard(withText('oi', { location: 'Padaria do Zé' }), noPhoto, measure);
    expect(L.location).toMatchObject({ text: 'Padaria do Zé', y: L.meta.y + S.header.metaLine });
  });

  it('enquete: uma linha por opção, mais votada marcada e rodapé', () => {
    const L = layoutCard(withText('qual?', { poll: { options: ['sim', 'não', 'talvez'], percents: [50, 25, 25], winners: [0], footer: '4 votos' } }), noPhoto, measure);
    expect(L.poll!.rows.map((r) => [r.label, r.percent, r.winner])).toEqual([['sim', 50, true], ['não', 25, false], ['talvez', 25, false]]);
    expect(L.poll!.rows[1].y - L.poll!.rows[0].y).toBe(S.poll.row + S.poll.gap);
    expect(L.poll!.footer.text).toBe('4 votos');
    expect(L.text!.size).toBe(S.text.normal);
  });

  it('ingresso: pôster 2:3 no filme, capa quadrada na música, título em até 2 linhas', () => {
    const review = layoutCard(withText('vi', { ticket: { kind: 'review', image: null, title: 'um título bem comprido '.repeat(6), lines: ['2024 · ★★★★'] } }), noPhoto, measure);
    expect(review.ticket!.thumb.height).toBe(S.ticket.thumb * S.ticket.posterRatio);
    expect(review.ticket!.title.length).toBe(2);
    expect(review.ticket!.title[1].endsWith('…')).toBe(true);
    const track = layoutCard(withText('ouvi', { ticket: { kind: 'track', image: null, title: 'Tempo Perdido', lines: ['Legião Urbana'] } }), noPhoto, measure);
    expect(track.ticket!.thumb.height).toBe(S.ticket.thumb);
    expect(track.ticket!.meta).toEqual(['Legião Urbana']);
  });
});
