// Mesa 3D do poker (Three.js): feltro oval com borda de madeira, cartas, fichas e o botão do dealer. Recebe passos
// (tableDiff) e anima; nenhuma regra aqui. Textos e botões ficam no HUD (view.ts), presos à cena pelos anchors.
// Só redesenha enquanto algo se mexe.
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

import { chipStack, POKER_CHIPS } from '../shared/table3d/chips';
import { CARD_D, CARD_T, CARD_W, orientationOf, type Orientation } from '../shared/table3d/layout';
import { createLoop } from '../shared/table3d/loop';
import { cardBack, cardFace, chipFace, chipSide } from '../shared/table3d/textures';
import { tween } from '../shared/table3d/tween';
import {
  betSpot,
  boardSlot,
  buttonSpot,
  camera as cameraFor,
  DECK,
  FELT,
  holeSlot,
  myCardSlot,
  POT,
  SEATS,
  type P2,
  type Slot,
} from './layout';
import type { Step, TableView } from './tableDiff';

export type PokerTable = {
  /** Devolve true quando a orientação mudou (quem chama redesenha a vista, que depende dela). */
  resize(w: number, h: number): boolean;
  orientation(): Orientation;
  reducedMotion: boolean;
  play(steps: Step[]): Promise<void>;
  seatAnchor(visual: number): { x: number; y: number };
  potAnchor(): { x: number; y: number };
  mineAnchor(): { x: number; y: number };
};

type CardObj = { mesh: Mesh; shadow: Mesh };

/** Feltro visto de cima: verde com luz no meio e um anel dourado fino. */
function feltCanvas(o: Orientation): HTMLCanvasElement {
  const { rx, rz } = FELT[o];
  const w = 1024;
  const h = Math.round((1024 * rz) / rx);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, Math.max(w, h) * 0.7);
  grad.addColorStop(0, '#1f8a57');
  grad.addColorStop(0.6, '#11603b');
  grad.addColorStop(1, '#0a3f27');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(242,210,122,0.35)';
  g.lineWidth = 4;
  const r = Math.min(w, h) / 2 - 70;
  g.beginPath();
  g.roundRect(70, 70, w - 140, h - 140, r);
  g.stroke();
  return c;
}

/** Retângulo de pontas redondas (estádio) no plano x / y (= −z). */
function stadium(rx: number, rz: number, pad = 0): Shape {
  const a = rx + pad;
  const b = rz + pad;
  const r = Math.min(a, b);
  const s = new Shape();
  if (a >= b) {
    const l = a - r;
    s.moveTo(-l, -r);
    s.lineTo(l, -r);
    s.absarc(l, 0, r, -Math.PI / 2, Math.PI / 2, false);
    s.lineTo(-l, r);
    s.absarc(-l, 0, r, Math.PI / 2, (3 * Math.PI) / 2, false);
  } else {
    const l = b - r;
    s.moveTo(r, -l);
    s.lineTo(r, l);
    s.absarc(0, l, r, 0, Math.PI, false);
    s.lineTo(-r, -l);
    s.absarc(0, -l, r, Math.PI, 2 * Math.PI, false);
  }
  return s;
}

/** Botão do dealer: disco branco com "D". */
function dealerCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f4f1ea';
  g.beginPath();
  g.arc(64, 64, 62, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#121212';
  g.font = '800 70px "Golos Text", system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('D', 64, 68);
  return c;
}

export function createPokerTable(canvas: HTMLCanvasElement): PokerTable | null {
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
  sun.position.set(2, 10, 4);
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

  // feltro e borda: refeitos quando a orientação muda
  let felt: Mesh | null = null;
  let rim: Mesh | null = null;
  function buildTable() {
    if (felt) scene.remove(felt);
    if (rim) scene.remove(rim);
    const { rx, rz } = FELT[orient];
    const geo = new ShapeGeometry(stadium(rx, rz), 64);
    const uv = geo.attributes.uv;
    const pos = geo.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + rx) / (2 * rx), (pos.getY(i) + rz) / (2 * rz));
    felt = new Mesh(geo, new MeshBasicMaterial({ map: tex(feltCanvas(orient)) }));
    felt.rotation.x = -Math.PI / 2;
    const ring = stadium(rx, rz, 0.42);
    ring.holes.push(stadium(rx, rz));
    rim = new Mesh(
      new ExtrudeGeometry(ring, { depth: 0.22, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, curveSegments: 64 }),
      new MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.55 }),
    );
    rim.rotation.x = -Math.PI / 2;
    scene.add(felt, rim);
  }

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

  // fichas
  const chipGeo = new CylinderGeometry(0.3, 0.3, 0.07, 36);
  const chipMats = new Map<string, Material[]>();
  const chipMat = (v: number, top: boolean) => {
    const key = `${v}-${top}`;
    if (!chipMats.has(key)) {
      const face = new MeshBasicMaterial({ map: tex(chipFace(v, top)) });
      chipMats.set(key, [new MeshBasicMaterial({ map: tex(chipSide(v)) }), face, face]);
    }
    return chipMats.get(key)!;
  };

  const dealer = new Mesh(new CylinderGeometry(0.24, 0.24, 0.06, 32), [
    new MeshBasicMaterial({ color: 0xd9d6cf }),
    new MeshBasicMaterial({ map: tex(dealerCanvas()) }),
    new MeshBasicMaterial({ color: 0xd9d6cf }),
  ]);

  const holes = new Map<number, CardObj[]>();
  let mine: CardObj[] = [];
  let board: CardObj[] = [];
  const bets = new Map<number, Mesh[]>();
  let pot: Mesh[] = [];

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const table: PokerTable = { reducedMotion, resize, orientation: () => orient, play, seatAnchor, potAnchor, mineAnchor };

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
  const pause = (ms: number) => (table.reducedMotion ? Promise.resolve() : new Promise<void>((r) => setTimeout(r, ms)));

  function newCard(face: number | null, at: Slot): CardObj {
    const mesh = new Mesh(cardGeo, [edgeMat, edgeMat, face === null ? backMat : faceMat(face), backMat, edgeMat, edgeMat]);
    if (face === null) mesh.rotation.z = Math.PI;
    mesh.scale.set(at.scale, 1, at.scale);
    const shadow = new Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(at.scale, at.scale, 1);
    scene.add(shadow, mesh);
    const o = { mesh, shadow };
    place(o, at.x, 0.02, at.z);
    return o;
  }
  function place(o: CardObj, x: number, y: number, z: number) {
    o.mesh.position.set(x, y, z);
    o.shadow.position.set(x + 0.03, 0.004, z + 0.06);
  }
  function drop(o: CardObj) {
    scene.remove(o.mesh, o.shadow);
  }
  function fly(o: CardObj, from: P2, to: Slot, ms: number) {
    return run(ms, (k) => place(o, from.x + (to.x - from.x) * k, 0.02 + Math.sin(k * Math.PI) * 0.5, from.z + (to.z - from.z) * k));
  }
  function flip(o: CardObj, c: number) {
    (o.mesh.material as Material[])[2] = faceMat(c);
    const y = o.mesh.position.y;
    return run(240, (k) => {
      o.mesh.rotation.z = Math.PI * (1 - k);
      o.mesh.position.y = y + Math.sin(k * Math.PI) * 0.4;
    });
  }

  function stackAt(amount: number, at: P2): Mesh[] {
    const values = chipStack(amount, POKER_CHIPS);
    return values.map((v, n) => {
      const m = new Mesh(chipGeo, chipMat(v, n === values.length - 1));
      m.position.set(at.x, 0.04 + n * 0.075, at.z);
      m.rotation.y = n * 0.7;
      scene.add(m);
      return m;
    });
  }
  function setChips(next: Record<number, number>, amount: number) {
    for (const ms of bets.values()) for (const m of ms) scene.remove(m);
    bets.clear();
    for (const [v, a] of Object.entries(next)) bets.set(Number(v), stackAt(a, betSpot(orient, Number(v))));
    for (const m of pot) scene.remove(m);
    pot = stackAt(amount, POT[orient]);
    loop.invalidate();
  }
  function setButton(v: number | null) {
    if (v === null) {
      scene.remove(dealer);
    } else {
      const p = buttonSpot(orient, v);
      dealer.position.set(p.x, 0.035, p.z);
      scene.add(dealer);
    }
    loop.invalidate();
  }

  function clearAll() {
    for (const cs of holes.values()) cs.forEach(drop);
    holes.clear();
    mine.forEach(drop);
    mine = [];
    board.forEach(drop);
    board = [];
  }

  /** Desenha a vista inteira, sem animar. */
  function draw(v: TableView) {
    clearAll();
    for (const s of v.dealt) {
      const faces = v.shown[s];
      holes.set(s, [0, 1].map((i) => newCard(faces ? faces[i] : null, holeSlot(orient, s, i))));
    }
    if (v.mine) mine = v.mine.map((c, i) => newCard(c, myCardSlot(orient, i)));
    board = v.board.map((c, i) => newCard(c, boardSlot(orient, i)));
    setChips(v.bets, v.pot);
    setButton(v.button);
  }

  async function step(s: Step) {
    switch (s.kind) {
      case 'reset':
        draw(s.view);
        return;
      case 'chips':
        setChips(s.bets, s.pot);
        return;
      case 'deal':
        for (let i = 0; i < 2; i++) {
          for (const v of s.seats) {
            const o = newCard(null, { ...DECK[orient], scale: holeSlot(orient, v, i).scale });
            holes.set(v, [...(holes.get(v) ?? []), o]);
            await fly(o, DECK[orient], holeSlot(orient, v, i), 110);
          }
        }
        return;
      case 'mine':
        mine.forEach(drop);
        mine = [];
        for (let i = 0; i < 2; i++) {
          const o = newCard(null, { ...DECK[orient], scale: myCardSlot(orient, i).scale });
          mine.push(o);
          await fly(o, DECK[orient], myCardSlot(orient, i), 160);
        }
        await Promise.all(mine.map((o, i) => flip(o, s.cards[i])));
        return;
      case 'muck': {
        const cs = holes.get(s.seat) ?? [];
        holes.delete(s.seat);
        await Promise.all(cs.map((o) => fly(o, o.mesh.position, { ...DECK[orient], scale: 0.55 }, 220)));
        cs.forEach(drop);
        return;
      }
      case 'board':
        for (let i = 0; i < s.cards.length; i++) {
          const at = s.from + i;
          if (s.pause && at >= 3) await pause(1500); // turn e river com suspense no all-in
          const o = newCard(null, { ...DECK[orient], scale: boardSlot(orient, at).scale });
          board.push(o);
          await fly(o, DECK[orient], boardSlot(orient, at), 200);
          await flip(o, s.cards[i]);
        }
        return;
      case 'show': {
        let cs = holes.get(s.seat);
        if (!cs) {
          cs = [0, 1].map((i) => newCard(null, holeSlot(orient, s.seat, i)));
          holes.set(s.seat, cs);
        }
        await Promise.all(cs.map((o, i) => flip(o, s.cards[i])));
        return;
      }
      case 'pay': {
        const moving = pot;
        pot = [];
        const winners = Object.keys(s.payouts).map(Number);
        await Promise.all(
          moving.map((m, n) => {
            const to = betSpot(orient, winners[n % winners.length]);
            const from = { x: m.position.x, z: m.position.z };
            return run(420, (k) => m.position.set(from.x + (to.x - from.x) * k, m.position.y, from.z + (to.z - from.z) * k));
          }),
        );
        await pause(500);
        for (const m of moving) scene.remove(m);
        loop.invalidate();
        return;
      }
    }
  }

  async function play(steps: Step[]) {
    for (const s of steps) await step(s);
  }

  function project(p: P2) {
    const v = new Vector3(p.x, 0, p.z).project(cam);
    return { x: ((v.x + 1) / 2) * size.w, y: ((1 - v.y) / 2) * size.h };
  }
  function seatAnchor(visual: number) {
    return project(SEATS[orient][visual]);
  }
  function potAnchor() {
    const p = POT[orient];
    return project({ x: p.x, z: p.z - 0.55 });
  }
  function mineAnchor() {
    const a = myCardSlot(orient, 0);
    return project({ x: 0, z: a.z + (CARD_D * a.scale) / 2 + 0.25 });
  }

  function resize(w: number, h: number): boolean {
    size = { w, h };
    renderer.setSize(w, h, false);
    const next = orientationOf(window.innerWidth, window.innerHeight);
    const changed = next !== orient || !felt;
    orient = next;
    const c = cameraFor(orient);
    cam.fov = c.fov;
    cam.aspect = w / h;
    cam.position.set(...c.pos);
    cam.lookAt(...c.look);
    cam.updateProjectionMatrix();
    if (changed) buildTable();
    loop.invalidate();
    return changed;
  }

  resize(canvas.clientWidth || 1, canvas.clientHeight || 1);
  return table;
}
