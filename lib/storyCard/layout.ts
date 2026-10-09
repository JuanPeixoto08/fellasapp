import { fonts, storyCard as S } from '../theme';
import type { CardSource, Segment, TicketSource } from './source';

/** Largura de um texto numa fonte: no app, o `measureText` do canvas; nos testes, uma conta. */
export type Measure = (text: string, font: string) => number;
export type FontWeight = 'regular' | 'semibold' | 'bold';

/** Fonte no formato do canvas, com as famílias registradas pelo expo-font: `54px "GolosText_400Regular"`. */
export function font(weight: FontWeight, size: number): string {
  const family = weight === 'bold' ? fonts.bodyBold : weight === 'semibold' ? fonts.displaySemiBold : fonts.body;
  return `${size}px "${family}"`;
}

export type Run = { text: string; highlight: boolean };
export type Line = Run[];
export type Box = { x: number; y: number; width: number; height: number };
export type Label = { x: number; y: number; text: string };
export type PollRow = Box & { label: string; percent: number; winner: boolean };

/** Tudo no lugar, em px da imagem (`y` = topo). O recorte vem reto: o desenho gira em volta do centro dele. */
export type CardLayout = {
  clip: Box;
  avatar: Box;
  name: Label;
  meta: Label;
  location: Label | null;
  text: { x: number; y: number; size: number; lineHeight: number; lines: Line[] } | null;
  poll: { rows: PollRow[]; footer: Label } | null;
  ticket: { thumb: Box; x: number; titleY: number; title: string[]; metaY: number; meta: string[] } | null;
  photo: (Box & { extra: number }) | null;
};

const runFont = (r: { highlight: boolean }, size: number) => font(r.highlight ? 'semibold' : 'regular', size);
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const lineOf = (size: number) => Math.round(size * S.text.lineHeight);

function trimEnd(line: Line): void {
  const last = line[line.length - 1];
  if (!last) return;
  last.text = last.text.replace(/ +$/, '');
  if (!last.text) line.pop();
}

/** Corta com "…" até caber (letra a letra, sem partir emoji). */
export function ellipsize(text: string, maxWidth: number, f: string, measure: Measure): string {
  if (measure(text, f) <= maxWidth) return text;
  const chars = Array.from(text);
  while (chars.length && measure(`${chars.join('').trimEnd()}…`, f) > maxWidth) chars.pop();
  return `${chars.join('').trimEnd()}…`;
}

/**
 * Quebra os trechos (os destacados usam a fonte semibold) em linhas que cabem em `maxWidth`. Respeita as
 * quebras de linha do post; palavra maior que a linha quebra por letra.
 */
export function wrapSegments(segments: Segment[], maxWidth: number, size: number, measure: Measure): Line[] {
  const lines: Line[] = [];
  let line: Line = [];
  let width = 0;
  const push = (text: string, highlight: boolean) => {
    const last = line[line.length - 1];
    if (last && last.highlight === highlight) last.text += text;
    else line.push({ text, highlight });
  };
  const breakLine = () => {
    trimEnd(line);
    lines.push(line);
    line = [];
    width = 0;
  };
  for (const seg of segments) {
    const f = runFont(seg, size);
    for (const tok of seg.text.split(/(\n| +)/)) {
      if (!tok) continue;
      if (tok === '\n') {
        breakLine();
        continue;
      }
      const w = measure(tok, f);
      if (/^ +$/.test(tok)) {
        // espaço no começo da linha some
        if (line.length) {
          push(tok, seg.highlight);
          width += w;
        }
        continue;
      }
      if (width + w <= maxWidth) {
        push(tok, seg.highlight);
        width += w;
        continue;
      }
      if (line.length) breakLine();
      if (w <= maxWidth) {
        push(tok, seg.highlight);
        width = w;
        continue;
      }
      let chunk = '';
      for (const ch of Array.from(tok)) {
        if (chunk && measure(chunk + ch, f) > maxWidth) {
          push(chunk, seg.highlight);
          breakLine();
          chunk = '';
        }
        chunk += ch;
      }
      push(chunk, seg.highlight);
      width = measure(chunk, f);
    }
  }
  if (line.length) {
    trimEnd(line);
    lines.push(line);
  }
  return lines;
}

/** Fica com `max` linhas; a última termina em "…" (tira letras do fim até caber). */
function truncate(lines: Line[], max: number, maxWidth: number, size: number, measure: Measure): Line[] {
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max).map((l) => l.map((r) => ({ ...r })));
  const last = kept[max - 1];
  const widthOf = (l: Line) => l.reduce((w, r) => w + measure(r.text, runFont(r, size)), 0);
  const dots = measure('…', font('regular', size));
  while (last.length && widthOf(last) + dots > maxWidth) {
    const r = last[last.length - 1];
    r.text = Array.from(r.text).slice(0, -1).join('');
    if (!r.text) last.pop();
  }
  trimEnd(last);
  last.push({ text: '…', highlight: false });
  return kept;
}

/** Quebra simples por palavra, até `maxLines`; o que sobra vira "…" na última. */
function wrapPlain(text: string, maxWidth: number, f: string, measure: Measure, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (!cur || measure(next, f) <= maxWidth) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = ellipsize(`${kept[maxLines - 1]} ${lines[maxLines]}`, maxWidth, f, measure);
    return kept;
  }
  return lines.map((l) => ellipsize(l, maxWidth, f, measure));
}

function ticketBlock(t: TicketSource, inner: number, measure: Measure) {
  const T = S.ticket;
  const w = inner - T.thumb - T.gap;
  const thumbH = t.kind === 'review' ? T.thumb * T.posterRatio : T.thumb;
  const title = wrapPlain(t.title, w, font('bold', T.title), measure, 2);
  const meta = t.lines.map((l) => ellipsize(l, w, font('regular', T.meta), measure));
  return { thumbH, title, meta, height: Math.max(thumbH, title.length * T.titleLine + meta.length * T.metaLine) };
}

/**
 * Monta o recorte: cabeçalho, texto, enquete, ingresso e foto (a ordem do post). Enquete e ingresso têm
 * tamanho fixo; a foto encolhe até sobrar uma linha de texto; o texto desce de tamanho e, no mínimo, corta.
 */
export function layoutCard(src: CardSource, assets: { photoAspect: number | null }, measure: Measure): CardLayout {
  const { clip: C, header: H, poll: P, ticket: T } = S;
  const clipW = S.width - 2 * C.margin;
  const inner = clipW - 2 * C.padding;
  const x0 = C.margin + C.padding;
  const maxBottom = S.height - S.mark.bottom - S.mark.height - S.mark.gap;
  const maxClip = maxBottom - S.safeTop;

  // cabeçalho: avatar e, ao lado, nome, "@usuario · horário" e o local
  const headX = x0 + H.avatar + H.gap;
  const headW = inner - H.avatar - H.gap;
  const headTextH = H.nameLine + H.metaLine + (src.location ? H.metaLine : 0);
  const headerH = Math.max(H.avatar, headTextH);

  const pollH = src.poll ? src.poll.options.length * (P.row + P.gap) + P.footerLine : 0;
  const ticket = src.ticket ? ticketBlock(src.ticket, inner, measure) : null;
  const ticketH = ticket ? ticket.height : 0;
  const hasText = src.segments.length > 0;
  const photoAspect = src.photoUrl && assets.photoAspect && assets.photoAspect > 0 ? assets.photoAspect : null;
  const blocks = [hasText, !!src.poll, !!ticket, photoAspect !== null].filter(Boolean).length;
  const fixed = 2 * C.padding + headerH + blocks * C.gap + pollH + ticketH;

  const naturalPhoto = photoAspect
    ? Math.min(S.photo.maxHeight, inner / clamp(photoAspect, S.photo.minAspect, S.photo.maxAspect))
    : 0;
  const photoH = photoAspect
    ? Math.round(clamp(maxClip - fixed - (hasText ? lineOf(S.text.min) : 0), S.photo.minHeight, naturalPhoto))
    : 0;

  // texto: cartaz quando é curto e está sozinho; senão normal, descendo até caber
  let size: number = hasText && blocks === 1 && src.bodyLength <= S.text.bigMaxChars ? S.text.big : S.text.normal;
  let lines: Line[] = [];
  if (hasText) {
    const room = maxClip - fixed - photoH;
    lines = wrapSegments(src.segments, inner, size, measure);
    while (lines.length * lineOf(size) > room && size > S.text.min) {
      size = Math.max(S.text.min, size - S.text.step);
      lines = wrapSegments(src.segments, inner, size, measure);
    }
    lines = truncate(lines, Math.max(1, Math.floor(room / lineOf(size))), inner, size, measure);
  }
  const lineHeight = lineOf(size);
  const textH = lines.length * lineHeight;

  const clipH = fixed + photoH + textH;
  const clipY = clamp(Math.round((S.height - clipH) / 2 - C.lift * clipH), S.safeTop, Math.max(S.safeTop, maxBottom - clipH));

  let y = clipY + C.padding;
  const headY = y + (headerH - headTextH) / 2;
  const avatar = { x: x0, y: y + (headerH - H.avatar) / 2, width: H.avatar, height: H.avatar };
  const name = { x: headX, y: headY, text: ellipsize(src.name, headW, font('bold', H.name), measure) };
  const meta = { x: headX, y: headY + H.nameLine, text: ellipsize(`@${src.username} · ${src.time}`, headW, font('regular', H.meta), measure) };
  const location = src.location
    ? { x: headX, y: headY + H.nameLine + H.metaLine, text: ellipsize(src.location, headW, font('regular', H.meta), measure) }
    : null;
  y += headerH;

  let text: CardLayout['text'] = null;
  if (hasText) {
    y += C.gap;
    text = { x: x0, y, size, lineHeight, lines };
    y += textH;
  }

  let poll: CardLayout['poll'] = null;
  if (src.poll) {
    const p = src.poll;
    y += C.gap;
    const percentW = measure('100%', font('bold', P.label));
    const rows = p.options.map((option, i) => {
      const winner = p.winners.includes(i);
      return {
        x: x0,
        y: y + i * (P.row + P.gap),
        width: inner,
        height: P.row,
        label: ellipsize(option, inner - 3 * P.padX - percentW, font(winner ? 'bold' : 'regular', P.label), measure),
        percent: p.percents[i] ?? 0,
        winner,
      };
    });
    poll = { rows, footer: { x: x0, y: y + p.options.length * (P.row + P.gap), text: p.footer } };
    y += pollH;
  }

  let ticketOut: CardLayout['ticket'] = null;
  if (ticket) {
    y += C.gap;
    ticketOut = {
      thumb: { x: x0, y, width: T.thumb, height: ticket.thumbH },
      x: x0 + T.thumb + T.gap,
      titleY: y,
      title: ticket.title,
      metaY: y + ticket.title.length * T.titleLine,
      meta: ticket.meta,
    };
    y += ticketH;
  }

  let photo: CardLayout['photo'] = null;
  if (photoAspect) {
    y += C.gap;
    photo = { x: x0, y, width: inner, height: photoH, extra: src.extraPhotos };
  }

  return { clip: { x: C.margin, y: clipY, width: clipW, height: clipH }, avatar, name, meta, location, text, poll, ticket: ticketOut, photo };
}
