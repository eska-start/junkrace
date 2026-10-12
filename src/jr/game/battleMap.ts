import type { Obstacle } from './vehicle';

export const BATTLE_DURATION = 90;
export const ARENA_SIZE = 96;
export const HALF = ARENA_SIZE / 2;
export const ARENA_NAME = '고물 공방';
export const PLAZA_RADIUS = 16;
export const LOOP_RADIUS = 34;
export const LOOP_WIDTH = 10;
export interface Barrier { x: number; z: number; w: number; d: number; h: number }
// 그레이박스 A: 내부를 벽으로 나누지 않는다. 중앙 광장 가장자리는 연결.
export const BARRIERS: Barrier[] = [
  // The supports sit outside an 8U clear east/west crossing.
  ...[24.5, 31.5].flatMap(x => [-4.5, 4.5].map(z => ({ x, z, w: 0.7, d: 0.7, h: 4 }))),
];
export const ARENA_OBSTACLES: Obstacle[] = [];
export const STARTS = [
  { x: -8, z: -8, heading: Math.PI * 0.25 }, { x: 8, z: -8, heading: -Math.PI * 0.25 },
  { x: -8, z: 8, heading: Math.PI * 0.75 }, { x: 8, z: 8, heading: -Math.PI * 0.75 },
];
export const BOOST_PADS = [
  { x: -34, z: 0, heading: Math.PI }, { x: 34, z: 0, heading: 0 },
  { x: 0, z: -34, heading: Math.PI / 2 }, { x: 12, z: 34, heading: -Math.PI / 2 },
];
export const ITEM_SPOTS = [[18, 18], [-18, -18], [18, -18], [-18, 18]] as const;
export const JUMP_PADS = [{ x: -6, z: -31, heading: 0 }, { x: 6, z: 31, heading: Math.PI }];
export function insideArena(x: number, z: number, margin = 0): boolean {
  const h = HALF - 1.5 - margin;
  if (Math.abs(x) > h || Math.abs(z) > h) return false;
  const cx = Math.max(0, Math.abs(x) - (h - 7)), cz = Math.max(0, Math.abs(z) - (h - 7));
  return cx * cx + cz * cz <= 49;
}
export function blocked(x: number, z: number, margin = 0): boolean {
  if (ARENA_OBSTACLES.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + margin)) return true;
  return BARRIERS.some((b) => Math.abs(x - b.x) < b.w / 2 + margin && Math.abs(z - b.z) < b.d / 2 + margin);
}
export function paintable(x: number, z: number) { return insideArena(x, z) && !blocked(x, z); }
// 02 cardboardOverpass: 동측 남북 고가. X방향 하부 횡단 가능.
// 데크 상면 Y=5, 양쪽 접근 경사 각 12U, 중앙 데크 8U. 하부 유효 높이 4U 확보.
export const OVERPASS = { x: 28, z: 0, w: 8, len: 32, deckY: 5, rampLen: 12, deckLen: 8 } as const;
export function overpassDeckHeight(x: number, z: number): number {
  const dx = x - OVERPASS.x, dz = z - OVERPASS.z;
  if (Math.abs(dx) > OVERPASS.w / 2 || Math.abs(dz) > OVERPASS.len / 2) return 0;
  const az = Math.abs(dz);
  const deckHalf = OVERPASS.deckLen / 2;
  const t = az <= deckHalf ? 1 : Math.max(0, 1 - (az - deckHalf) / OVERPASS.rampLen);
  return OVERPASS.deckY * t;
}
export function underOverpass(x: number, z: number): boolean {
  const dx = x - OVERPASS.x, dz = z - OVERPASS.z;
  return Math.abs(dx) < OVERPASS.w / 2 + 1 && Math.abs(dz) < OVERPASS.deckLen / 2 + 1;
}
// ---- 01~08 배치표 (heading: XZ평면 +Z=0도, +X=90도) ----
// 01 점프대 8x12x2, 02 고가 8x32x5, 03 뱅크 길폭10 반경18 외측높이2,
// 04 낮은굴곡 5x6x0.7, 05 파괴폐품 4x4x1.2, 06 수리지점 4x3x2.5,
// 07 부품상자 1.6^3, 08 가장자리장식 8x6x8 (경계 밖, 충돌 없음)
export const RAMPS = [
  { x: -6, z: -31, heading: 0 }, { x: 6, z: 31, heading: 180 },
] as const;
export const BANKS = [
  { x: -24, z: -24, heading: 45 }, { x: 24, z: 24, heading: 225 },
] as const;
export const BUMPS = [
  { x: -27, z: 8, heading: 90 }, { x: 12, z: -25, heading: 0 },
] as const;
export const BREAKABLES = [
  { x: -22, z: -12, heading: 0 }, { x: 20, z: 14, heading: 0 },
] as const;
export const REPAIRS = [
  { x: -37, z: 0, heading: 90 }, { x: 37, z: 0, heading: 270 },
] as const;
export const REPAIR_COOLDOWN = 10;
export const BREAKABLE_RESPAWN = 12;
export function bankHeight(x: number, z: number): number {
  let h = 0;
  for (const b of BANKS) {
    // Anchor is the middle of the bend, not the centre of a full ring.
    const heading = b.heading * Math.PI / 180;
    const ox = -Math.sin(heading), oz = -Math.cos(heading);
    const cx = b.x - ox * 18, cz = b.z - oz * 18;
    const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz);
    const angle = Math.acos(Math.min(1, Math.max(-1, (dx * ox + dz * oz) / (d || 1))));
    if (d < 13 || d > 24 || angle > Math.PI / 4) continue;
    const t = Math.min(1, (d - 13) / 10);
    const ends = Math.min(1, (Math.PI / 4 - angle) / 0.16);
    const outside = Math.min(1, 24 - d);
    h = Math.max(h, 2 * t * t * (3 - 2 * t) * ends * outside);
  }
  return h;
}
function bumpHeight(x: number, z: number): number {
  let h = 0;
  for (const b of BUMPS) {
    const rad = b.heading * Math.PI / 180;
    const dx = x - b.x, dz = z - b.z;
    const lx = dx * Math.cos(rad) + dz * Math.sin(rad);
    const lz = -dx * Math.sin(rad) + dz * Math.cos(rad);
    if (Math.abs(lx) > 2.5 || Math.abs(lz) > 3) continue;
    const q = Math.sqrt((lx / 2.5) ** 2 + (lz / 3) ** 2);
    if (q >= 1) continue;
    h = Math.max(h, 0.7 * (0.5 + 0.5 * Math.cos(Math.PI * q)));
  }
  return h;
}
export type SurfaceId = 'ground' | 'rampA' | 'rampB' | 'deck';
export interface DriveSurface { id: SurfaceId; ground: number; friction: number }
function rampHeight(cx: number, cz: number, dir: 1 | -1, x: number, z: number): number {
  const dx = x - cx, dz = z - cz;
  if (Math.abs(dx) > 4 || Math.abs(dz) > 6) return 0;
  const t = dir > 0 ? (dz + 6) / 12 : (6 - dz) / 12;
  return 2 * Math.min(1, Math.max(0, t));
}
// A low ramp entrance can acquire the deck; a car under its centre cannot.
// Continuity follows the previous surface and actual height, including jump landings.
export function getDriveSurface(x: number, z: number, currentY = 0, prevId: SurfaceId = 'ground'): DriveSurface {
  const ha = rampHeight(-6, -31, 1, x, z), hb = rampHeight(6, 31, -1, x, z);
  const base = arenaHeight(x, z), hd = overpassDeckHeight(x, z);
  if (hd > 0 && (prevId === 'deck' || hd <= 0.65 || currentY >= hd - 0.55)) {
    return { id: 'deck', ground: hd, friction: 1 };
  }
  return { id: ha > 0 ? 'rampA' : hb > 0 ? 'rampB' : 'ground', ground: base, friction: 1 };
}
// 필수조건 5: 점프 끝단 통과를 1회만 감지해 이륙. 램프 위 매 프레임 재발사 금지.
export function rampTakeoff(prevX: number, prevZ: number, x: number, z: number): SurfaceId | null {
  for (const [cx, lip, direction, id] of [[-6, -25, 1, 'rampA'], [6, 25, -1, 'rampB']] as const) {
    if ((prevZ - lip) * direction < 0 && (z - lip) * direction >= 0) {
      const t = (lip - prevZ) / (z - prevZ);
      const crossingX = prevX + (x - prevX) * t;
      if (Math.abs(crossingX - cx) < 4) return id;
    }
  }
  return null;
}
export const RAMP_TAKEOFF_VY = 9;
export const LAND_TURBO_TIME = 0.35;
// A raised shelf and its two ramps are part of the paintable surface, not a separate flat overlay.
// 03 뱅크·04 굴곡은 단층 높이로 합성. 04는 통과형이라 원형 장애물로 등록 금지.
export function arenaHeight(x: number, z: number): number {
  return Math.max(0, rampHeight(-6, -31, 1, x, z), rampHeight(6, 31, -1, x, z), bankHeight(x, z), bumpHeight(x, z));
}
export function surfaceAreaFactor(x: number, z: number): number {
  const e = 0.12;
  const dx = (arenaHeight(x + e, z) - arenaHeight(x - e, z)) / (2 * e);
  const dz = (arenaHeight(x, z + e) - arenaHeight(x, z - e)) / (2 * e);
  return Math.sqrt(1 + dx * dx + dz * dz);
}
export function clampArena(p: { x: number; z: number }) {
  const h = HALF - 2.8;
  p.x = Math.max(-h, Math.min(h, p.x)); p.z = Math.max(-h, Math.min(h, p.z));
  const c = h - 7, ax = Math.abs(p.x), az = Math.abs(p.z);
  if (ax > c && az > c) {
    const d = Math.hypot(ax - c, az - c);
    if (d > 7) { p.x = Math.sign(p.x) * (c + (ax - c) * 7 / d); p.z = Math.sign(p.z) * (c + (az - c) * 7 / d); }
  }
}
export function pushBarrier(p: { x: number; z: number }, radius = 1): boolean {
  let hit = false;
  for (const b of BARRIERS) {
    const hx = b.w / 2 + radius, hz = b.d / 2 + radius, dx = p.x - b.x, dz = p.z - b.z;
    if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
      if (hx - Math.abs(dx) < hz - Math.abs(dz)) p.x = b.x + Math.sign(dx || 1) * hx;
      else p.z = b.z + Math.sign(dz || 1) * hz;
      hit = true;
    }
  }
  return hit;
}
export function segmentClear(ax: number, az: number, bx: number, bz: number, margin = 1.4): boolean {
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.75));
  for (let i = 1; i <= n; i++) {
    const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n;
    if (!insideArena(x, z, margin) || blocked(x, z, margin)) return false;
  }
  return true;
}
// A* navigation allows territory-seeking bots to route around obstacles.
export function findPath(ax: number, az: number, bx: number, bz: number): [number, number][] {
  const N = 48, step = ARENA_SIZE / N;
  const toCell = (n: number) => Math.max(0, Math.min(N - 1, Math.round((n + HALF - step / 2) / step)));
  const at = (i: number): [number, number] => [i % N * step - HALF + step / 2, Math.floor(i / N) * step - HALF + step / 2];
  const start = toCell(az) * N + toCell(ax), end = toCell(bz) * N + toCell(bx);
  const open = new Set([start]), closed = new Set<number>();
  const cost = new Map([[start, 0]]), prev = new Map<number, number>();
  let found = start;
  for (let iter = 0; iter < 900 && open.size; iter++) {
    let best = Infinity, cur = start;
    for (const i of open) {
      const [x, z] = at(i), c = (cost.get(i) ?? Infinity) + Math.hypot(x - bx, z - bz);
      if (c < best) { best = c; cur = i; }
    }
    open.delete(cur); closed.add(cur); found = cur;
    if (cur === end) break;
    const [x, z] = at(cur);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const nx = cur % N + dx, nz = Math.floor(cur / N) + dz;
      if (nx < 0 || nx >= N || nz < 0 || nz >= N) continue;
      const ni = nz * N + nx, [xx, zz] = at(ni);
      if (closed.has(ni) || !segmentClear(x, z, xx, zz, 1.25)) continue;
      const next = (cost.get(cur) ?? 0) + Math.hypot(dx, dz) * step;
      if (next < (cost.get(ni) ?? Infinity)) { cost.set(ni, next); prev.set(ni, cur); open.add(ni); }
    }
  }
  if (found !== end) return [[bx, bz]];
  const result: [number, number][] = [[bx, bz]];
  let i = end;
  while (i !== start && prev.has(i)) { result.unshift(at(i)); i = prev.get(i)!; }
  return result;
}
/** Shorten the camera boom before terrain or the bridge slab hides the kart. */
export function clearCameraBoom(target: { x: number; y: number; z: number }, desired: { x: number; y: number; z: number }) {
  let safe = 1;
  for (let i = 1; i <= 40; i++) {
    const t = i / 40;
    const x = target.x + (desired.x - target.x) * t;
    const y = target.y + (desired.y - target.y) * t;
    const z = target.z + (desired.z - target.z) * t;
    const deck = overpassDeckHeight(x, z);
    const hitsDeck = deck > .1 && y >= deck - .8 && y <= deck + .45;
    if (y < arenaHeight(x, z) + .45 || hitsDeck) { safe = Math.max(.08, t - .055); break; }
  }
  return { x: target.x + (desired.x - target.x) * safe, y: target.y + (desired.y - target.y) * safe, z: target.z + (desired.z - target.z) * safe };
}
