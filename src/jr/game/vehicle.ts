import { CHARACTERS, ITEMS, GRADE_SPEED, DEFAULT_PAINT_WIDTH, DEFAULT_GUN, GUN_GRADE_MUL, upgradedGrade, upgradeMul, type Stats, type Grade, type GunStats } from '../data/items';
import type { CarBuild } from '../store';

export interface VehicleSpec {
  wheelCount: number;
  wheelRadii: (number | null)[];
  maxSpeed: number;
  accel: number;
  grip: number;
  weight: number;
  boostPower: number;
  wobble: number;
  onFoot: boolean;
  jump: number;
  stats: Stats;
  /** 장착된 부품 수 (바퀴 포함) */
  partCount: number;
  /** 등급으로 얻은 속도 보너스 합계 */
  gradeBonus: number;
  /** 뒤에 단 붓이 결정하는 페인트 반경 배율 */
  paintWidth: number;
  /** 장착된 붓 등급 (없으면 null) */
  brushGrade: Grade | null;
  /** 차량 완성도: 채워진 부품 수 / 전체(바퀴 4 + 핵심 슬롯 5) */
  completeness: number;
  completenessMax: number;
  /** 완성도에 따른 페인트 범위 배율 (미완성일수록 단계적으로 줄어든다) */
  paintNerf: number;
  /** 사격 성능 (총 미장착 시 기본 콩알총) */
  gun: GunStats;
  gunName: string | null;
  gunGrade: Grade | null;
  /** 최대 내구도 — 이만큼 데미지를 받을 때마다 부품이 하나 빠진다 */
  partHp: number;
}

/** 완성도에 포함되는 핵심 슬롯 */
export const CORE_SLOTS = ['body', 'engine', 'booster', 'frontBumper', 'spoiler'] as const;
export const COMPLETENESS_MAX = 4 + CORE_SLOTS.length;
/** 부품이 하나 빠질 때마다 페인트 범위가 약 6.7%p씩 줄어든다 (완전체 1.0 → 아무것도 없으면 0.4) */
export const PAINT_NERF_MIN = 0.4;
export function completenessOf(build: CarBuild): { filled: number; nerf: number } {
  const filled = build.wheels.filter((w) => w !== null).length + CORE_SLOTS.filter((k) => build.slots[k] !== undefined).length;
  return { filled, nerf: PAINT_NERF_MIN + (1 - PAINT_NERF_MIN) * (filled / COMPLETENESS_MAX) };
}

/** 장착 부품의 실제 등급 (업그레이드 반영) */
export function partGrade(build: CarBuild, items: Record<number, string>, uid: number): Grade | null {
  const def = ITEMS[items[uid]];
  if (!def) return null;
  return upgradedGrade(def.grade, build.upgrades?.[uid] ?? 0);
}

export function gunOf(build: CarBuild, items: Record<number, string>): { gun: GunStats; name: string | null; grade: Grade | null } {
  const uid = build.slots.gun;
  const def = uid !== undefined ? ITEMS[items[uid]] : undefined;
  if (!def || !def.gun || uid === undefined) return { gun: DEFAULT_GUN, name: null, grade: null };
  const grade = partGrade(build, items, uid) ?? def.grade;
  const lvl = build.upgrades?.[uid] ?? 0;
  const mul = GUN_GRADE_MUL[grade] / GUN_GRADE_MUL[def.grade];
  return {
    gun: { ...def.gun, damage: def.gun.damage * mul, rate: def.gun.rate * (1 + lvl * 0.12) },
    name: def.name,
    grade,
  };
}

/** 장착된 모든 부품의 등급 보너스 합 */
export function gradeBonusOf(build: CarBuild, items: Record<number, string>): { bonus: number; count: number } {
  let bonus = 0;
  let count = 0;
  const addUid = (uid: number | null | undefined) => {
    if (uid === null || uid === undefined) return;
    const def = ITEMS[items[uid]];
    if (!def) return;
    bonus += GRADE_SPEED[upgradedGrade(def.grade, build.upgrades?.[uid] ?? 0)];
    count++;
  };
  Object.values(build.slots).forEach(addUid);
  build.wheels.forEach(addUid);
  return { bonus, count };
}

export function brushOf(build: CarBuild, items: Record<number, string>) {
  const uid = build.slots.brush;
  const def = uid !== undefined ? ITEMS[items[uid]] : undefined;
  return def && def.cat === 'brush' ? def : null;
}

export function sumStats(build: CarBuild, items: Record<number, string>, characterId: string): Stats {
  const s: Stats = { speed: 0, accel: 0, grip: 0, weight: 0, boost: 0 };
  const add = (p: Partial<Stats>) => {
    s.speed += p.speed ?? 0;
    s.accel += p.accel ?? 0;
    s.grip += p.grip ?? 0;
    s.weight += p.weight ?? 0;
    s.boost += p.boost ?? 0;
  };
  // 업그레이드된 부품은 능력치가 단계당 35%씩 강화된다 (음수 능력치는 그대로)
  const addPart = (uid: number) => {
    const def = ITEMS[items[uid]];
    if (!def) return;
    const mul = upgradeMul(build.upgrades?.[uid] ?? 0);
    const scaled: Partial<Stats> = {};
    (Object.keys(def.stats) as (keyof Stats)[]).forEach((k) => {
      const v = def.stats[k] ?? 0;
      scaled[k] = v > 0 ? v * mul : v;
    });
    add(scaled);
  };
  Object.values(build.slots).forEach((uid) => { if (uid !== undefined) addPart(uid); });
  build.wheels.forEach((uid) => { if (uid !== null) addPart(uid); });
  const ch = CHARACTERS.find((c) => c.id === characterId);
  if (ch) add(ch.bonus);
  return s;
}

/**
 * 속도 체계 (느림 → 빠름):
 *   맨몸 (바퀴 0개)            ≈ 3.6 ~ 4.4
 *   바퀴 1~3개 임시 차량       ≈ 8.5 ~ 18
 *   바퀴 4개 + 부품 多 + 고등급 ≈ 18 ~ 30+
 * 부품을 많이, 등급 높게 장착할수록 최고속도가 올라간다.
 */
export function computeSpec(build: CarBuild, items: Record<number, string>, characterId: string): VehicleSpec {
  const stats = sumStats(build, items, characterId);
  const wheelRadii = build.wheels.map((uid) => (uid !== null && items[uid] ? ITEMS[items[uid]].radius ?? 0.4 : null));
  const wheelCount = wheelRadii.filter((r) => r !== null).length;
  const { bonus: gradeBonus, count: partCount } = gradeBonusOf(build, items);
  const brush = brushOf(build, items);
  const brushLvl = build.slots.brush !== undefined ? build.upgrades?.[build.slots.brush] ?? 0 : 0;
  const done = completenessOf(build);
  // 붓 자체 폭 × 차량 완성도 — 차량이 덜 완성될수록 칠하는 범위가 단계적으로 좁아진다
  const paintWidth = (brush ? (brush.paintWidth ?? 1) * (1 + brushLvl * 0.12) : DEFAULT_PAINT_WIDTH) * done.nerf;
  const brushGrade = brush && build.slots.brush !== undefined ? partGrade(build, items, build.slots.brush) : null;
  const g = gunOf(build, items);
  const gunExtra = { completeness: done.filled, completenessMax: COMPLETENESS_MAX, paintNerf: done.nerf, gun: g.gun, gunName: g.name, gunGrade: g.grade, partHp: 26 + Math.max(0, stats.weight) * 3.0 };
  // 바퀴가 하나라도 있으면 차체가 없어도(뼈대만 있어도) 주행 가능
  const onFoot = wheelCount === 0;

  if (onFoot) {
    // Running while carrying the junk bundle is always slower than a one-wheel vehicle.
    const load = Math.min(1, partCount / 10);
    return {
      wheelCount: 0,
      wheelRadii,
      maxSpeed: 4.8 - load * 0.5 + Math.min(0.3, Math.max(0, stats.speed * 0.08)),
      accel: 11,
      grip: 1.1,
      weight: 0,
      boostPower: 0.28,
      wobble: 0,
      onFoot: true,
      jump: 1,
      stats,
      partCount,
      gradeBonus,
      // 맨몸은 붓을 "끌고" 다닐 뿐이라 범위가 더 좁다
      paintWidth: paintWidth * 0.7,
      brushGrade,
      ...gunExtra,
    };
  }

  const avgR = wheelRadii.reduce<number>((a, r) => a + (r ?? 0), 0) / wheelCount;
  // 바퀴 수에 따른 기본 배율 — 1개는 매우 느리고 4개가 완전체
  const countMul = [0, 0.5, 0.68, 0.86, 1][wheelCount];
  const wobble = [0, 1, 0.65, 0.3, 0.06][wheelCount];
  const weight = Math.max(0, 2 + stats.weight);
  // 완성도 보너스: 핵심 슬롯(차체/엔진/부스터/범퍼/스포일러)이 채워질수록 추가 속도
  const coreFilled = CORE_SLOTS.filter((s) => build.slots[s] !== undefined).length;
  const completeness = coreFilled * 1.1;
  const base = 14 + stats.speed * 1.0 + (avgR - 0.42) * 5 + completeness + gradeBonus;
  const maxSpeed = base * countMul - weight * 0.2;
  const accel = Math.max(5, (8 + stats.accel * 1.3 + gradeBonus * 0.4) / (1 + weight * 0.1)) * (0.6 + 0.4 * countMul);
  const grip = Math.max(0.35, Math.min(1.4, 0.78 + stats.grip * 0.1 - (4 - wheelCount) * 0.08));

  return {
    wheelCount,
    wheelRadii,
    maxSpeed: Math.max(8.5, maxSpeed),
    accel,
    grip,
    weight,
    boostPower: stats.boost > 0 ? 0.35 + stats.boost * 0.12 : 0,
    wobble,
    onFoot: false,
    jump: 1 + Math.max(0, -stats.weight) * 0.15,
    stats,
    partCount,
    gradeBonus,
    paintWidth,
    brushGrade,
    ...gunExtra,
  };
}

export interface VehicleState {
  x: number;
  z: number;
  y: number;
  vy: number;
  heading: number;
  speed: number;
  steer: number;
  roll: number;
  pitch: number;
  bounce: number;
  boostTime: number;
  boostEnergy: number;
  hit: number;
  airborne: boolean;
  wheelSpin: number;
  t: number;
  accelVis: number;
  skid: number;
  itemBoost: number;
  spinAngle: number;
  stun: number;
  shield: number;
  /** 마리오카트 스타일 드리프트 & 조작 메카닉 */
  driftDir: number; // -1: 좌측 드리프트, 1: 우측 드리프트, 0: 미드리프트
  driftTime: number; // 드리프트 지속 시간 (초)
  driftLevel: number; // 0: 일반, 1: 청색 미니터보, 2: 주황색 슈퍼 미니터보
  driftAngle: number; // 드리프트 시 차체 회전각 오프셋 (라디안)
  hopTime: number; // 홉 도약 타이머
  prevDriftLevel: number; // 스파크 단계 변화 감지용
  turboRelease: number; // 0: 미발동, 1: 청색 터보 발동, 2: 주황색 슈퍼 터보 발동
}

export const newVehicleState = (x: number, z: number, heading: number): VehicleState => ({
  x,
  z,
  y: 0,
  vy: 0,
  heading,
  speed: 0,
  steer: 0,
  roll: 0,
  pitch: 0,
  bounce: 0,
  boostTime: 0,
  boostEnergy: 1,
  hit: 0,
  airborne: false,
  wheelSpin: 0,
  t: Math.random() * 10,
  accelVis: 0,
  skid: 0,
  itemBoost: 0,
  spinAngle: 0,
  stun: 0,
  shield: 0,
  driftDir: 0,
  driftTime: 0,
  driftLevel: 0,
  driftAngle: 0,
  hopTime: 0,
  prevDriftLevel: 0,
  turboRelease: 0,
});

export interface Control {
  steer: number;
  throttle: number;
  boost: boolean;
  /** 사격 버튼 */
  fire?: boolean;
  /** 점프/드리프트 홀드 상태 */
  jump?: boolean;
  /** 점프/드리프트 신규 입력 엣지 트리거 */
  hopTrigger?: boolean;
}

export interface Surface {
  friction: number; // 1 = road
  ground: number; // ground height
  jumpImpulse?: number;
}

export interface Obstacle {
  x: number;
  z: number;
  r: number;
}

export function stepVehicle(
  st: VehicleState,
  spec: VehicleSpec,
  ctrl: Control,
  dt: number,
  surface: Surface,
  obstacles: Obstacle[],
) {
  st.t += dt;
  const prevSpeed = st.speed;
  st.turboRelease = 0;
  if (st.hopTime > 0) st.hopTime = Math.max(0, st.hopTime - dt);

  // boost
  if (ctrl.boost && ctrl.throttle > 0.05 && spec.boostPower > 0 && st.boostEnergy >= 0.45 && st.boostTime <= 0) {
    st.boostTime = 1.3;
    st.boostEnergy = Math.max(0, st.boostEnergy - 0.45);
  }
  if (st.boostTime > 0) st.boostTime -= dt;
  else st.boostEnergy = Math.min(1, st.boostEnergy + dt * 0.12);
  const boosting = st.boostTime > 0;

  const itemBoosting = st.itemBoost > 0;
  if (itemBoosting) st.itemBoost -= dt;
  st.stun = Math.max(0, st.stun - dt);
  st.shield = Math.max(0, st.shield - dt);

  // speed
  const maxS = spec.maxSpeed * (boosting ? 1 + spec.boostPower : 1) * (itemBoosting ? 1.45 : 1) * (0.55 + 0.45 * surface.friction);
  // 엑셀 가속 / 제동
  if (ctrl.throttle > 0.05) {
    st.speed += spec.accel * ctrl.throttle * (boosting ? 1.6 : 1) * (itemBoosting ? 1.5 : 1) * dt;
  } else if (ctrl.throttle < -0.05) {
    if (st.speed > 0.6) st.speed += spec.accel * 1.35 * ctrl.throttle * dt; // 브레이크 제동
    else st.speed += spec.accel * 0.7 * ctrl.throttle * dt; // 정지 상태에선 후진
  } else {
    // 드리프트 중에는 탄력을 유지하여 속도가 급격히 죽지 않음 (마리오카트 코너링 감각)
    const driftCoast = st.driftDir !== 0 ? 0.9 : 2.4;
    st.speed -= st.speed * driftCoast * dt;
    if (Math.abs(st.speed) < 0.18) st.speed = 0;
  }
  // drag
  const over = st.speed - maxS;
  if (over > 0) st.speed -= over * 3 * dt;
  st.speed -= st.speed * 0.25 * (2 - surface.friction) * dt;
  if (st.speed < -maxS * 0.4) st.speed = -maxS * 0.4;

  const speedFrac = Math.min(1, Math.abs(st.speed) / Math.max(1, spec.maxSpeed));
  const wantsHop = Boolean(ctrl.hopTrigger);
  const isJumpHeld = Boolean(ctrl.jump);
  const canInitiateDrift = !spec.onFoot && !st.airborne && st.speed > 3.5 && st.stun <= 0;

  // ── 마리오카트 홉 & 드리프트 개시 판정 ──
  if (wantsHop) {
    if (canInitiateDrift && Math.abs(ctrl.steer) > 0.16) {
      // 스티어링을 꺾은 채 점프하면 통통 튀며 드리프트 진입!
      st.driftDir = ctrl.steer > 0 ? 1 : -1;
      st.driftTime = 0;
      st.driftLevel = 0;
      st.prevDriftLevel = 0;
      st.hopTime = 0.22;
      st.vy = 4.2 * Math.max(0.85, spec.jump);
      st.airborne = true;
      st.bounce = 0.38;
    } else if (!st.airborne) {
      // 일반 직진 수동 점프
      st.vy = 8.8 * spec.jump;
      st.airborne = true;
      st.bounce = 0.5;
    }
  }

  // ── 스티어링 (조향) 반응성 대폭 향상 ──
  const targetSteer = ctrl.steer;
  st.steer += (targetSteer - st.steer) * Math.min(1, dt * (spec.onFoot ? 16 : 14));
  // 고속에서도 선회력이 급감하지 않도록 부드러운 아케이드 커브 제공
  const turnCurve = spec.onFoot ? 1 : Math.max(0.78, Math.min(1.22, 0.8 + speedFrac * 0.42));
  const baseTurnRate = (spec.onFoot ? 3.8 : 2.65 * spec.grip) * turnCurve;
  const dir = st.speed >= 0 ? 1 : -1;

  // ── 드리프트 중 선회 및 미니터보 충전 ──
  if (st.driftDir !== 0 && !spec.onFoot) {
    const steerFactor = ctrl.steer * st.driftDir; // 1 = 인코스(급선회), -1 = 아웃코스(카운터스티어), 0 = 중립
    const isMaintained =
      (isJumpHeld || (Math.sign(ctrl.steer) === st.driftDir && Math.abs(ctrl.steer) > 0.12)) &&
      st.speed > 2.4 &&
      st.stun <= 0;

    if (isMaintained) {
      // 인코스로 꺾으면 회전 반경이 좁아지고, 카운터스티어를 치면 넓어져 라인 조절이 가능함!
      const driftTurnMul =
        steerFactor >= 0
          ? 1.15 + 0.6 * steerFactor
          : Math.max(0.38, 1.15 + 0.72 * steerFactor);
      st.heading -= st.driftDir * baseTurnRate * driftTurnMul * dt * dir;

      // 미니터보 차지 게이지: 인코스로 감을수록 35% 더 빠르게 모임
      const chargeRate = steerFactor > 0.15 ? 1.35 : steerFactor < -0.15 ? 0.75 : 1.0;
      st.driftTime += dt * chargeRate;

      // 미니터보 2단계 판정 (0.65초: 청색 미니터보, 1.5초: 주황색 슈퍼 미니터보)
      st.prevDriftLevel = st.driftLevel;
      if (st.driftTime >= 1.5) {
        st.driftLevel = 2;
      } else if (st.driftTime >= 0.65) {
        st.driftLevel = 1;
      } else {
        st.driftLevel = 0;
      }

      // 비주얼 카트 슬라이드 각도 (인코스로 노즈가 틀어지는 마리오카트 실루엣)
      const targetDriftYaw = -st.driftDir * (0.34 - 0.12 * steerFactor);
      st.driftAngle += (targetDriftYaw - st.driftAngle) * Math.min(1, dt * 14);
      st.skid = 1.0;
    } else {
      // ── 드리프트 해제 & 미니터보 부스트 발동! ──
      const released = st.driftLevel;
      if (released === 2) {
        // 주황색 슈퍼 미니터보
        st.itemBoost = Math.max(st.itemBoost, 1.35);
        st.speed = Math.max(st.speed * 1.25, spec.maxSpeed * 1.4);
        st.turboRelease = 2;
      } else if (released === 1) {
        // 청색 미니터보
        st.itemBoost = Math.max(st.itemBoost, 0.75);
        st.speed = Math.max(st.speed * 1.15, spec.maxSpeed * 1.25);
        st.turboRelease = 1;
      }
      st.driftDir = 0;
      st.driftTime = 0;
      st.driftLevel = 0;
      st.prevDriftLevel = 0;
    }
  } else {
    st.heading -= st.steer * baseTurnRate * dt * dir;
    st.driftAngle += (0 - st.driftAngle) * Math.min(1, dt * 10);
  }

  // instability wander
  if (spec.wobble > 0 && !st.airborne) {
    st.heading += Math.sin(st.t * 2.7) * spec.wobble * 0.55 * speedFrac * dt;
  }

  // vertical
  if (st.y > surface.ground + 0.2) st.airborne = true;
  if (surface.jumpImpulse && !st.airborne && st.speed > 4) {
    st.vy = surface.jumpImpulse * spec.jump * Math.min(1, st.speed / 12);
    st.airborne = true;
  }
  if (st.airborne || st.y > surface.ground + 0.01) {
    st.vy -= 28 * dt;
    st.y += st.vy * dt;
    if (st.y <= surface.ground) {
      st.y = surface.ground;
      if (st.vy < -4) st.bounce = Math.min(1, -st.vy / 14);
      st.vy = 0;
      st.airborne = false;
    }
  } else {
    st.y += (surface.ground - st.y) * Math.min(1, dt * 10);
  }

  // integrate (위치 적분)
  if (st.driftDir !== 0 && !spec.onFoot) {
    // 드리프트 중에는 카트가 미끄러지며 바깥쪽으로 원심력 슬립을 발생시킴
    const slipAngle = st.driftAngle * 0.45;
    const travelHeading = st.heading + slipAngle;
    const fx = Math.sin(travelHeading);
    const fz = Math.cos(travelHeading);
    const sideX = Math.cos(st.heading) * st.driftDir * 1.7;
    const sideZ = -Math.sin(st.heading) * st.driftDir * 1.7;
    st.x += (fx * st.speed + sideX) * dt;
    st.z += (fz * st.speed + sideZ) * dt;
  } else {
    const fx = Math.sin(st.heading);
    const fz = Math.cos(st.heading);
    const drift = (1 - Math.min(1, spec.grip)) * 2.2 * st.steer * speedFrac * (spec.onFoot ? 0 : 1);
    st.x += (fx * st.speed + fz * drift) * dt;
    st.z += (fz * st.speed - fx * drift) * dt;
  }

  // obstacles
  st.hit = Math.max(0, st.hit - dt);
  const selfR = spec.onFoot ? 0.5 : 1.1;
  const fx = Math.sin(st.heading);
  const fz = Math.cos(st.heading);
  for (const o of obstacles) {
    const dx = st.x - o.x;
    const dz = st.z - o.z;
    const d2 = dx * dx + dz * dz;
    const rr = o.r + selfR;
    if (d2 < rr * rr && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const nz = dz / d;
      st.x = o.x + nx * rr;
      st.z = o.z + nz * rr;
      const dot = fx * nx + fz * nz;
      if (dot < -0.3 && st.speed > 2) {
        st.speed *= 0.35;
        st.hit = 0.5;
        st.bounce = 0.6;
      } else {
        st.speed *= 0.97;
      }
    }
  }

  // visual
  const accelNow = (st.speed - prevSpeed) / Math.max(dt, 0.001);
  st.accelVis += (accelNow - st.accelVis) * Math.min(1, dt * 7);
  const wob = spec.wobble;
  // 마리오카트 특유의 활기찬 서스펜션 롤 (드리프트 시 안쪽으로 차체가 쏠림)
  const driftRoll = st.driftDir !== 0 ? -st.driftDir * 0.19 : 0;
  const targetRoll =
    -st.steer * speedFrac * (0.16 + wob * 0.3) +
    driftRoll +
    Math.sin(st.t * 5.1) * wob * 0.11 * (0.4 + speedFrac) +
    Math.sin(st.t * 13.3) * wob * 0.03;
  // 가속 시 후방 스쿼트, 제동 시 전방 다이브
  const targetPitch =
    -st.accelVis * 0.016 +
    Math.sin(st.t * 7.7) * wob * 0.05 +
    (st.airborne ? -st.vy * 0.025 : 0);
  st.roll += (targetRoll - st.roll) * Math.min(1, dt * 8);
  st.pitch += (targetPitch - st.pitch) * Math.min(1, dt * 8);
  st.bounce *= Math.max(0, 1 - dt * 3.5);
  st.wheelSpin += st.speed * dt;
  if (st.driftDir === 0) {
    st.skid = Math.abs(st.steer) * speedFrac * (surface.friction < 1 ? 0.3 : 1);
  }
}

/** Simple on-foot movement for the collection phase (camera-relative) */
export function stepRunner(st: VehicleState, ix: number, iy: number, dt: number, obstacles: Obstacle[], bounds: number) {
  st.t += dt;
  const len = Math.hypot(ix, iy);
  const maxS = 11;
  if (len > 0.1) {
    const nx = ix / Math.max(1, len);
    const nz = -iy / Math.max(1, len);
    const target = Math.atan2(nx, nz);
    let d = target - st.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    st.heading += d * Math.min(1, dt * 12);
    st.steer += (d - st.steer) * Math.min(1, dt * 8);
    st.speed += (maxS * Math.min(1, len) - st.speed) * Math.min(1, dt * 7);
  } else {
    st.speed -= st.speed * Math.min(1, dt * 9);
    st.steer -= st.steer * Math.min(1, dt * 8);
  }
  const fx = Math.sin(st.heading);
  const fz = Math.cos(st.heading);
  st.x += fx * st.speed * dt;
  st.z += fz * st.speed * dt;
  const r = Math.hypot(st.x, st.z);
  if (r > bounds) {
    st.x *= bounds / r;
    st.z *= bounds / r;
  }
  for (const o of obstacles) {
    const dx = st.x - o.x;
    const dz = st.z - o.z;
    const d2 = dx * dx + dz * dz;
    const rr = o.r + 0.5;
    if (d2 < rr * rr && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      st.x = o.x + (dx / d) * rr;
      st.z = o.z + (dz / d) * rr;
    }
  }
  st.wheelSpin += st.speed * dt;
  st.accelVis = st.speed / maxS;
}
