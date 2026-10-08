// Mesa 3D (Three.js): feltro com borda de madeira, cartas e fichas. Só redesenha enquanto algo se mexe.
// Textos e botões não ficam aqui: são HTML por cima (hud/), presos à cena por anchor().
import {
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  DirectionalLight,
  ExtrudeGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type Material,
} from 'three';

import type { RoundState } from '../types';
import {
  CARD_D,
  CARD_T,
  CARD_W,
  camera as cameraFor,
  cardSlot,
  orientationOf,
  POT,
  SHOE,
  tagPoint,
  type Orientation,
  type Who,
} from './layout';
import { chipStack } from './chips';
import { createLoop } from './loop';
import { cardBack, cardFace, chipFace, chipSide, feltTexture } from './textures';
import { tween } from './tween';

export type Table = {
  resize(w: number, h: number): void;
  /** Carta saindo do sapato até o lugar. null = virada; Promise = voa virada e mostra a face quando chegar. */
  dealCard(who: Who, hand: number, hands: number, i: number, card: number | null | Promise<number>): Promise<void>;
  /** Vira a carta i da banca. */
  reveal(i: number, card: number): Promise<void>;
  /** Dividiu: a segunda carta vai para a segunda mão. */
  splitHand(): Promise<void>;
  /** Desenha uma mão inteira no lugar, sem voar (retomar a mão aberta). */
  placeRound(round: RoundState): void;
  setPot(amount: number): void;
  clear(): Promise<void>;
  /** Ponto da tela (px, relativo ao canvas) embaixo da mão, para a plaquinha. */
  anchor(who: Who, hand: number): { x: number; y: number };
  orientation(): Orientation;
  reducedMotion: boolean;
};

type CardObj = { who: Who; hand: number; i: number; mesh: Mesh; shadow: Mesh };

const TABLE_TOP = 0.5; // y (= -z) do centro do arco do fundo
const TABLE_BOTTOM = -4.5;

/** Contorno da mesa no plano (x, y = -z): arco no fundo, cantos arredondados na frente. */
function tableShape(pad = 0): Shape {
  const R = 5 + pad;
  const bottom = TABLE_BOTTOM - pad;
  const c = 0.8;
  const s = new Shape();
  s.moveTo(-R, TABLE_TOP);
  s.absarc(0, TABLE_TOP, R, Math.PI, 0, true);
  s.lineTo(R, bottom + c);
  s.quadraticCurveTo(R, bottom, R - c, bottom);
  s.lineTo(-R + c, bottom);
  s.quadraticCurveTo(-R, bottom, -R, bottom + c);
  s.lineTo(-R, TABLE_TOP);
  return s;
}


export function createTable(canvas: HTMLCanvasElement): Table | null {
  let renderer: WebGLRenderer;
  try {
    if (!canvas.getContext('webgl2') && !canvas.getContext('webgl')) return null;
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new Scene();
  scene.add(new AmbientLight(0xffffff, 1.4));
  const sun = new DirectionalLight(0xffffff, 1.8);
  sun.position.set(2, 8, 5);
  scene.add(sun);

  const cam = new PerspectiveCamera(50, 1, 0.1, 100);
  const loop = createLoop(() => renderer.render(scene, cam));
  let orient: Orientation = 'portrait';
  let size = { w: 1, h: 1 };

  const tex = (c: HTMLCanvasElement) => {
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = maxAniso;
    return t;
  };

  // feltro + borda de madeira
  const feltGeo = new ShapeGeometry(tableShape(), 48);
  const uv = feltGeo.attributes.uv;
  const pos = feltGeo.attributes.position;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (pos.getX(i) + 5) / 10, (pos.getY(i) - TABLE_BOTTOM) / 10);
  }
  const feltMat = new MeshBasicMaterial({ map: tex(feltTexture(POT.portrait.z)) });
  const felt = new Mesh(feltGeo, feltMat);
  felt.rotation.x = -Math.PI / 2;
  scene.add(felt);

  const rimShape = tableShape(0.42);
  rimShape.holes.push(tableShape(0));
  const rim = new Mesh(
    new ExtrudeGeometry(rimShape, { depth: 0.22, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, curveSegments: 48 }),
    new MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.55 }),
  );
  rim.rotation.x = -Math.PI / 2;
  scene.add(rim);

  // sapato (de onde as cartas saem)
  const shoe = new Mesh(new BoxGeometry(1.1, 0.5, 1.5), new MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.8 }));
  scene.add(shoe);

  // cartas
  const cardGeo = new BoxGeometry(CARD_W, CARD_T, CARD_D);
  const edgeMat = new MeshBasicMaterial({ color: 0xe9e6df });
  const backMat = new MeshBasicMaterial({ map: tex(cardBack()) });
  const faceMats = new Map<number, Material>();
  const faceMat = (c: number) => {
    if (!faceMats.has(c)) faceMats.set(c, new MeshBasicMaterial({ map: tex(cardFace(c)) }));
    return faceMats.get(c)!;
  };
  const shadowGeo = new PlaneGeometry(CARD_W * 1.06, CARD_D * 1.06);
  const shadowMat = new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false });
  const cards: CardObj[] = [];

  // pote de fichas
  const chipGeo = new CylinderGeometry(0.36, 0.36, 0.08, 40);
  const chipMats = new Map<string, Material[]>();
  const chipMat = (v: number, top: boolean) => {
    const key = `${v}-${top}`;
    if (!chipMats.has(key)) {
      const side = new MeshBasicMaterial({ map: tex(chipSide(v)) });
      const face = new MeshBasicMaterial({ map: tex(chipFace(v, top)) });
      chipMats.set(key, [side, face, face]);
    }
    return chipMats.get(key)!;
  };
  let chips: Mesh[] = [];

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const table: Table = {
    reducedMotion,
    resize,
    dealCard,
    reveal,
    splitHand,
    placeRound,
    setPot,
    clear,
    anchor,
    orientation: () => orient,
  };

  function run(ms: number, step: (k: number) => void): Promise<void> {
    if (table.reducedMotion) {
      step(1);
      loop.invalidate();
      return Promise.resolve();
    }
    const t = tween(ms, step);
    loop.track(() => t.busy());
    return t.done;
  }

  function place(o: CardObj, x: number, y: number, z: number) {
    o.mesh.position.set(x, y, z);
    o.shadow.position.set(x + 0.03, 0.004, z + 0.06);
  }

  function handsCount() {
    return cards.some((c) => c.who === 'player' && c.hand === 1) ? 2 : 1;
  }

  function slotOf(o: CardObj) {
    return cardSlot(orient, o.who, o.hand, o.who === 'player' ? handsCount() : 1, o.i);
  }

  function newCard(who: Who, hand: number, i: number, face: number | null): CardObj {
    const mesh = new Mesh(cardGeo, [edgeMat, edgeMat, face === null ? backMat : faceMat(face), backMat, edgeMat, edgeMat]);
    if (face === null) mesh.rotation.z = Math.PI; // virada: o verso fica para cima
    const shadow = new Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    scene.add(shadow, mesh);
    const o = { who, hand, i, mesh, shadow };
    cards.push(o);
    return o;
  }

  function setFace(o: CardObj, c: number) {
    (o.mesh.material as Material[])[2] = faceMat(c);
  }

  function flip(o: CardObj, c: number): Promise<void> {
    setFace(o, c);
    const base = slotOf(o);
    return run(260, (k) => {
      o.mesh.rotation.z = Math.PI * (1 - k);
      o.mesh.position.y = base.y + Math.sin(k * Math.PI) * 0.5;
    });
  }

  async function dealCard(who: Who, hand: number, hands: number, i: number, card: number | null | Promise<number>) {
    const known = typeof card === 'number' ? card : null;
    const o = newCard(who, hand, i, known);
    const to = cardSlot(orient, who, hand, hands, i);
    const from = SHOE[orient];
    place(o, from.x, from.y, from.z);
    await run(320, (k) => {
      place(o, from.x + (to.x - from.x) * k, to.y + Math.sin(k * Math.PI) * 0.6, from.z + (to.z - from.z) * k);
    });
    if (card instanceof Promise) await flip(o, await card);
  }

  function reveal(i: number, card: number) {
    const o = cards.find((c) => c.who === 'dealer' && c.i === i);
    return o ? flip(o, card) : Promise.resolve();
  }

  function splitHand() {
    const second = cards.find((c) => c.who === 'player' && c.hand === 0 && c.i === 1);
    if (!second) return Promise.resolve();
    second.hand = 1;
    second.i = 0;
    const moves = cards
      .filter((c) => c.who === 'player')
      .map((o) => {
        const from = o.mesh.position.clone();
        const to = slotOf(o);
        return run(280, (k) => place(o, from.x + (to.x - from.x) * k, to.y, from.z + (to.z - from.z) * k));
      });
    return Promise.all(moves).then(() => undefined);
  }

  function removeAll() {
    for (const o of cards) scene.remove(o.mesh, o.shadow);
    cards.length = 0;
  }

  function placeRound(round: RoundState) {
    removeAll();
    round.hands.forEach((h, hand) => h.cards.forEach((c, i) => newCard('player', hand, i, c)));
    round.dealer.forEach((c, i) => newCard('dealer', 0, i, c));
    if (round.status === 'playing') newCard('dealer', 0, round.dealer.length, null);
    for (const o of cards) {
      const s = slotOf(o);
      place(o, s.x, s.y, s.z);
    }
    setPot(round.hands.reduce((sum, h) => sum + h.bet, 0));
  }

  function setPot(amount: number) {
    for (const m of chips) scene.remove(m);
    const stack = chipStack(amount);
    const p = POT[orient];
    chips = stack.map((v, n) => {
      const m = new Mesh(chipGeo, chipMat(v, n === stack.length - 1));
      m.position.set(p.x, 0.045 + n * 0.085, p.z);
      m.rotation.y = n * 0.7;
      scene.add(m);
      return m;
    });
    loop.invalidate();
  }

  async function clear() {
    const leaving = [...cards];
    await run(300, (k) => {
      for (const o of leaving) place(o, o.mesh.position.x, o.mesh.position.y, o.mesh.position.z - k * 0.6);
    });
    removeAll();
    setPot(0);
  }

  function anchor(who: Who, hand: number) {
    const p = tagPoint(orient, who, hand, who === 'player' ? handsCount() : 1);
    const v = new Vector3(p.x, p.y, p.z).project(cam);
    return { x: ((v.x + 1) / 2) * size.w, y: ((1 - v.y) / 2) * size.h };
  }

  function resize(w: number, h: number) {
    size = { w, h };
    renderer.setSize(w, h, false);
    const next = orientationOf(window.innerWidth, window.innerHeight);
    const c = cameraFor(next);
    cam.fov = c.fov;
    cam.aspect = w / h;
    cam.position.set(...c.pos);
    cam.lookAt(...c.look);
    cam.updateProjectionMatrix();
    if (next !== orient) {
      orient = next;
      feltMat.map?.dispose();
      feltMat.map = tex(feltTexture(POT[orient].z));
      for (const o of cards) {
        const s = slotOf(o);
        place(o, s.x, s.y, s.z);
      }
      const p = POT[orient];
      chips.forEach((m) => m.position.set(p.x, m.position.y, p.z));
    }
    const s = SHOE[orient];
    shoe.position.set(s.x, 0.25, s.z - 0.2);
    shoe.rotation.y = -0.5;
    loop.invalidate();
  }

  // primeira orientação certa antes do primeiro quadro
  orient = orientationOf(window.innerWidth, window.innerHeight) === 'portrait' ? 'landscape' : 'portrait';
  resize(canvas.clientWidth || 1, canvas.clientHeight || 1);
  return table;
}
