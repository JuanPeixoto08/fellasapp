/**
 * Regras puras da função `letterboxd-reviews`: endereço do feed, leitura do RSS público do Letterboxd e o
 * formato do anexo de review (o mesmo de `lib/postMedia.ts` e do check `post_media_ok`, 0026).
 */

export type Review = {
  kind: 'review';
  title: string;
  year: number | null;
  rating: number | null;
  liked: boolean;
  rewatch: boolean;
  watched: string | null;
  poster: string | null;
  url: string;
  text: string;
  spoiler: boolean;
};

export const MAX_REVIEWS = 50;
export const MAX_TEXT = 6000;
const MAX_TITLE = 200;
/** Usuário do Letterboxd (mesmo check de profiles.letterboxd_user). */
const USER = /^[A-Za-z0-9_]{2,15}$/;
const POSTER = /^https:\/\/a\.ltrbxd\.com\//i;
const REVIEW_URL = /^https:\/\/letterboxd\.com\/[A-Za-z0-9_]+\/film\//i;
const SPOILER_LINE = /^\s*<em>\s*This review may contain spoilers\.?\s*<\/em>\s*$/i;

/** Feed do próprio usuário, host fixo; usuário fora do formato → null (nada é buscado). */
export function rssUrl(user: string): string | null {
  return USER.test(user) ? `https://letterboxd.com/${user}/rss/` : null;
}

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : whole;
    }
    const named = NAMED[code.toLowerCase()];
    if (named) return named;
    // letras acentuadas em HTML (á, ç, ã...) que o Letterboxd às vezes manda nomeadas
    const accented = /^([a-z])(acute|grave|circ|tilde|uml|cedil)$/i.exec(code);
    if (!accented) return whole;
    const mark = { acute: '́', grave: '̀', circ: '̂', tilde: '̃', uml: '̈', cedil: '̧' }[
      accented[2].toLowerCase() as 'acute'
    ];
    return (accented[1] + mark).normalize('NFC');
  });
}

const tag = (xml: string, name: string): string | null => {
  // a tag pode ter atributos (<guid isPermaLink="false">)
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(xml);
  return m ? m[1].trim() : null;
};

/** Texto de um parágrafo do HTML da review: quebra de linha no <br>, sem tags, entidades decodificadas. */
function plain(html: string): string {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function cut(text: string): string {
  if (text.length <= MAX_TEXT) return text;
  const head = text.slice(0, MAX_TEXT - 1);
  const space = head.lastIndexOf(' ');
  return `${(space > MAX_TEXT - 200 ? head.slice(0, space) : head).trimEnd()}…`;
}

function review(item: string): Review | null {
  const guid = tag(item, 'guid') ?? '';
  if (!/letterboxd-review-/.test(guid)) return null;
  const url = tag(item, 'link') ?? '';
  const title = decodeEntities(tag(item, 'letterboxd:filmTitle') ?? '').trim();
  if (!REVIEW_URL.test(url) || !title || title.length > MAX_TITLE) return null;

  const year = Number(tag(item, 'letterboxd:filmYear'));
  const rating = Number(tag(item, 'letterboxd:memberRating'));
  const watched = tag(item, 'letterboxd:watchedDate');
  const description = (tag(item, 'description') ?? '').replace(/^<!\[CDATA\[|\]\]>$/g, '');
  const paragraphs = [...description.matchAll(/<p>([\s\S]*?)<\/p>/gi)].map((m) => m[1]);
  const poster = /<img[^>]+src="([^"]+)"/i.exec(description)?.[1] ?? null;
  const spoilerLine = paragraphs.some((p) => SPOILER_LINE.test(p));
  const text = paragraphs
    .filter((p) => !/<img/i.test(p) && !SPOILER_LINE.test(p))
    .map(plain)
    .filter(Boolean)
    .join('\n\n');

  return {
    kind: 'review',
    title,
    year: Number.isInteger(year) && year >= 1870 && year <= 2100 ? year : null,
    rating: rating >= 0.5 && rating <= 5 && Number.isInteger(rating * 2) ? rating : null,
    liked: tag(item, 'letterboxd:memberLike') === 'Yes',
    rewatch: tag(item, 'letterboxd:rewatch') === 'Yes',
    watched: watched && /^\d{4}-\d{2}-\d{2}$/.test(watched) ? watched : null,
    poster: poster && POSTER.test(poster) ? decodeEntities(poster) : null,
    url,
    text: cut(text),
    spoiler: spoilerLine || /\(contains spoilers\)\s*$/i.test(tag(item, 'title') ?? ''),
  };
}

/** Só as reviews do feed (diário sem review e listas ficam de fora), as mais novas primeiro, até 50. */
export function parseReviews(xml: string): Review[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  return items
    .map(review)
    .filter((r): r is Review => r !== null)
    .slice(0, MAX_REVIEWS);
}

/** CORS só para o site e para o app rodando localmente (mesma regra da `stories-media`). */
export function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  if (origin === 'https://fellasapp.pages.dev') return origin;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ? origin : null;
}
