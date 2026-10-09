import { avatarColor, initials, INITIALS_SCALE } from '../avatarLook';
import { LOGO_PATH, LOGO_VIEWBOX } from '../logoPath';
import { avatarInk, fonts, storyCard as S } from '../theme';
import { paletteFor, type CardPalette, type StoryBackground } from './contrast';
import { font, layoutCard, type CardLayout, type Label } from './layout';
import type { CardSource } from './source';

type Ctx = CanvasRenderingContext2D;

/** Recorte pronto para desenhar em qualquer fundo: layout calculado e imagens carregadas (ou null). */
export type PreparedCard = {
  source: CardSource;
  layout: CardLayout;
  hasPhoto: boolean;
  avatar: HTMLImageElement | null;
  photo: HTMLImageElement | null;
  ticket: HTMLImageElement | null;
};

/** Carrega com CORS (sem ele o canvas não exporta); falhou ou não tem CORS → null. */
function loadImage(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img.naturalWidth ? img : null);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function loadFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.all(
    [fonts.body, fonts.displaySemiBold, fonts.bodyBold].map((f) => document.fonts.load(`40px "${f}"`).catch(() => [])),
  );
}

/** Espera fontes e imagens e calcula o layout com a medida de verdade do canvas. */
export async function prepareCard(source: CardSource): Promise<PreparedCard> {
  const [, avatar, photo, ticket] = await Promise.all([
    loadFonts(),
    loadImage(source.avatarUrl),
    loadImage(source.photoUrl),
    loadImage(source.ticket?.image ?? null),
  ]);
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) throw new Error('canvas indisponível');
  const measure = (text: string, f: string) => {
    ctx.font = f;
    return ctx.measureText(text).width;
  };
  const layout = layoutCard(source, { photoAspect: photo ? photo.naturalWidth / photo.naturalHeight : null }, measure);
  return { source, layout, hasPhoto: !!photo, avatar, photo, ticket };
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Preenche a caixa com a imagem, cortando o que sobra no centro (como `cover`). */
function drawCover(ctx: Ctx, img: HTMLImageElement, x: number, y: number, w: number, h: number): void {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const s = Math.max(w / iw, h / ih);
  const sw = w / s;
  const sh = h / s;
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
}

function drawBackground(ctx: Ctx, card: PreparedCard, bg: StoryBackground, pal: CardPalette): void {
  if (bg === 'photo' && card.photo) {
    // reduz e estica de volta: desfoque que funciona até no Safari (que não tem ctx.filter)
    const small = document.createElement('canvas');
    small.width = Math.round(S.width / S.photoBlurScale);
    small.height = Math.round(S.height / S.photoBlurScale);
    const sctx = small.getContext('2d');
    if (sctx) drawCover(sctx, card.photo, 0, 0, small.width, small.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(small, 0, 0, S.width, S.height);
    ctx.fillStyle = S.photoDim;
    ctx.fillRect(0, 0, S.width, S.height);
    return;
  }
  ctx.fillStyle = pal.bg ?? S.backgrounds.violeta;
  ctx.fillRect(0, 0, S.width, S.height);
}

function drawLabel(ctx: Ctx, l: Label, f: string, color: string, line: number, size: number): void {
  ctx.font = f;
  ctx.fillStyle = color;
  ctx.fillText(l.text, l.x, l.y + (line - size) / 2);
}

function drawAvatar(ctx: Ctx, card: PreparedCard): void {
  const a = card.layout.avatar;
  const r = a.width / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(a.x + r, a.y + r, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (card.avatar) drawCover(ctx, card.avatar, a.x, a.y, a.width, a.height);
  else {
    ctx.fillStyle = avatarColor(card.source.name);
    ctx.fillRect(a.x, a.y, a.width, a.height);
    ctx.font = font('bold', Math.round(a.width * INITIALS_SCALE));
    ctx.fillStyle = avatarInk;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials(card.source.name), a.x + r, a.y + r);
  }
  ctx.restore();
}

function drawText(ctx: Ctx, text: NonNullable<CardLayout['text']>): void {
  text.lines.forEach((line, i) => {
    let x = text.x;
    const y = text.y + i * text.lineHeight + (text.lineHeight - text.size) / 2;
    for (const run of line) {
      ctx.font = font(run.highlight ? 'semibold' : 'regular', text.size);
      ctx.fillStyle = run.highlight ? S.brand : S.ink;
      ctx.fillText(run.text, x, y);
      x += ctx.measureText(run.text).width;
    }
  });
}

function drawPoll(ctx: Ctx, poll: NonNullable<CardLayout['poll']>): void {
  const P = S.poll;
  for (const r of poll.rows) {
    roundRect(ctx, r.x, r.y, r.width, r.height, P.radius);
    ctx.strokeStyle = S.sunken;
    ctx.lineWidth = P.stroke;
    ctx.stroke();
    const w = (r.width * r.percent) / 100;
    if (w > 0) {
      roundRect(ctx, r.x, r.y, Math.max(w, 2 * P.radius), r.height, P.radius);
      ctx.fillStyle = r.winner ? S.brandSoft : S.sunken;
      ctx.fill();
    }
    const ty = r.y + (r.height - P.label) / 2;
    ctx.font = font(r.winner ? 'bold' : 'regular', P.label);
    ctx.fillStyle = S.ink;
    ctx.textAlign = 'left';
    ctx.fillText(r.label, r.x + P.padX, ty);
    ctx.textAlign = 'right';
    ctx.fillText(`${r.percent}%`, r.x + r.width - P.padX, ty);
    ctx.textAlign = 'left';
  }
  drawLabel(ctx, poll.footer, font('regular', P.footer), S.inkMuted, P.footerLine, P.footer);
}

function drawTicket(ctx: Ctx, t: NonNullable<CardLayout['ticket']>, img: HTMLImageElement | null): void {
  const T = S.ticket;
  const b = t.thumb;
  ctx.save();
  roundRect(ctx, b.x, b.y, b.width, b.height, T.radius);
  ctx.clip();
  if (img) drawCover(ctx, img, b.x, b.y, b.width, b.height);
  else {
    ctx.fillStyle = S.sunken;
    ctx.fillRect(b.x, b.y, b.width, b.height);
  }
  ctx.restore();
  ctx.font = font('bold', T.title);
  ctx.fillStyle = S.ink;
  t.title.forEach((line, i) => ctx.fillText(line, t.x, t.titleY + i * T.titleLine + (T.titleLine - T.title) / 2));
  ctx.font = font('regular', T.meta);
  t.meta.forEach((line, i) => {
    const y = t.metaY + i * T.metaLine + (T.metaLine - T.meta) / 2;
    const heart = line.endsWith('♥');
    const rest = heart ? line.slice(0, -1) : line;
    ctx.fillStyle = S.inkMuted;
    ctx.fillText(rest, t.x, y);
    if (heart) {
      ctx.fillStyle = S.like;
      ctx.fillText('♥', t.x + ctx.measureText(rest).width, y);
    }
  });
}

function drawPhoto(ctx: Ctx, box: NonNullable<CardLayout['photo']>, img: HTMLImageElement): void {
  ctx.save();
  roundRect(ctx, box.x, box.y, box.width, box.height, S.photo.radius);
  ctx.clip();
  drawCover(ctx, img, box.x, box.y, box.width, box.height);
  ctx.restore();
  if (box.extra <= 0) return;
  const B = S.badge;
  const label = `+${box.extra}`;
  ctx.font = font('bold', B.size);
  const w = ctx.measureText(label).width + 2 * B.padX;
  const bx = box.x + box.width - B.inset - w;
  const by = box.y + box.height - B.inset - B.height;
  roundRect(ctx, bx, by, w, B.height, B.height / 2);
  ctx.fillStyle = B.bg;
  ctx.fill();
  ctx.fillStyle = B.fg;
  ctx.textAlign = 'center';
  ctx.fillText(label, bx + w / 2, by + (B.height - B.size) / 2);
  ctx.textAlign = 'left';
}

function drawTape(ctx: Ctx, cx: number, cy: number, deg: number, color: string): void {
  const { width, height } = S.tapeSize;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.fillStyle = color;
  ctx.fillRect(-width / 2, -height / 2, width, height);
  ctx.restore();
}

function drawClip(ctx: Ctx, card: PreparedCard, pal: CardPalette): void {
  const L = card.layout;
  const c = L.clip;
  const H = S.header;
  const cx = c.x + c.width / 2;
  const cy = c.y + c.height / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((S.clip.rotateDeg * Math.PI) / 180);
  ctx.translate(-cx, -cy);

  ctx.save();
  ctx.shadowColor = pal.shadow.color;
  ctx.shadowBlur = pal.shadow.blur;
  ctx.shadowOffsetY = pal.shadow.offsetY;
  ctx.fillStyle = pal.paper;
  ctx.fillRect(c.x, c.y, c.width, c.height);
  ctx.restore();

  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  drawAvatar(ctx, card);
  drawLabel(ctx, L.name, font('bold', H.name), S.ink, H.nameLine, H.name);
  drawLabel(ctx, L.meta, font('regular', H.meta), S.inkMuted, H.metaLine, H.meta);
  if (L.location) drawLabel(ctx, L.location, font('regular', H.meta), S.inkMuted, H.metaLine, H.meta);
  if (L.text) drawText(ctx, L.text);
  if (L.poll) drawPoll(ctx, L.poll);
  if (L.ticket) drawTicket(ctx, L.ticket, card.ticket);
  if (L.photo && card.photo) drawPhoto(ctx, L.photo, card.photo);

  // fitas nos dois cantos de cima, por cima de tudo
  drawTape(ctx, c.x + S.tapeSize.width / 4, c.y, S.tapeSize.leftDeg, pal.tape);
  drawTape(ctx, c.x + c.width - S.tapeSize.width / 4, c.y + S.tapeSize.height / 8, S.tapeSize.rightDeg, pal.tape);
  ctx.restore();
}

function drawMark(ctx: Ctx, color: string): void {
  const scale = S.mark.height / LOGO_VIEWBOX.height;
  const w = LOGO_VIEWBOX.width * scale;
  ctx.save();
  ctx.translate((S.width - w) / 2, S.height - S.mark.bottom - S.mark.height);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.fill(new Path2D(LOGO_PATH));
  ctx.restore();
}

function renderCard(card: PreparedCard, bg: StoryBackground): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = S.width;
  canvas.height = S.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas indisponível');
  const pal = paletteFor(bg);
  drawBackground(ctx, card, bg, pal);
  drawClip(ctx, card, pal);
  drawMark(ctx, pal.mark);
  return canvas;
}

/** A imagem do story (JPEG 1080 × 1920) no fundo escolhido. */
export function storyBlob(card: PreparedCard, bg: StoryBackground): Promise<Blob> {
  const canvas = renderCard(card, bg);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('falhou gerar a imagem'))), 'image/jpeg', S.jpegQuality),
  );
}
