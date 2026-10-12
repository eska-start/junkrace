import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ARENA_SIZE, HALF, ARENA_OBSTACLES, BARRIERS, BOOST_PADS, JUMP_PADS, OVERPASS, RAMPS, BANKS, BUMPS, REPAIRS, arenaHeight, insideArena, overpassDeckHeight } from '../game/battleMap';
import type { TerritoryMap } from '../game/paint';
import { Mat, makeTexture, woodTexture } from './materials';
import { PaintCan, BigBrush, WorkshopSign, SoftBox } from './Workshop';
import { CardboardBox, Pencil, PetBottle } from './Props';

function surfaceGeometry(lift = 0) {
  const N = 144, vertices: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let z = 0; z <= N; z++) for (let x = 0; x <= N; x++) {
    const xx = x / N * ARENA_SIZE - HALF, zz = z / N * ARENA_SIZE - HALF;
    vertices.push(xx, arenaHeight(xx, zz) + lift, zz); uv.push(x / N, z / N);
  }
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    if (!insideArena((x + 0.5) / N * ARENA_SIZE - HALF, (z + 0.5) / N * ARENA_SIZE - HALF)) continue;
    const a = z * (N + 1) + x, b = a + N + 1;
    indices.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(indices); g.computeVertexNormals();
  return g;
}
function deckGeometry() {
  const nx = 8, nz = 32, vertices: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let z = 0; z <= nz; z++) for (let x = 0; x <= nx; x++) {
    const xx = OVERPASS.x - OVERPASS.w / 2 + x / nx * OVERPASS.w;
    const zz = OVERPASS.z - OVERPASS.len / 2 + z / nz * OVERPASS.len;
    vertices.push(xx, overpassDeckHeight(xx, zz) + 0.06, zz); uv.push(x / nx, z / nz);
  }
  for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
    const a = z * (nx + 1) + x, b = a + nx + 1;
    indices.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(indices); g.computeVertexNormals();
  return g;
}
function arenaPaper() {
  return makeTexture((g, s) => {
    g.fillStyle = '#f4edd9'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 13000; i++) {
      g.fillStyle = `rgba(140,116,84,${Math.random() * 0.055})`;
      g.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
    g.strokeStyle = 'rgba(176,183,160,0.25)'; g.lineWidth = 1;
    for (let i = 0; i <= 32; i++) {
      const p = i / 32 * s; g.beginPath(); g.moveTo(p, 0); g.lineTo(p, s); g.stroke();
      g.beginPath(); g.moveTo(0, p); g.lineTo(s, p); g.stroke();
    }
    g.strokeStyle = '#e6af7b'; g.lineWidth = 8; g.setLineDash([12, 10]);
    g.strokeRect(35, 35, s - 70, s - 70); g.setLineDash([]);
    g.textAlign = 'center'; g.fillStyle = 'rgba(67,113,99,0.11)';
    g.font = '900 62px sans-serif'; g.fillText('COLOR', s / 2, s / 2 - 8); g.fillText('FACTORY', s / 2, s / 2 + 62);
  }, 1024);
}
function Pads() {
  const arrow = useMemo(() => makeTexture((g, s) => {
    g.fillStyle = '#ffba5d'; g.fillRect(0, 0, s, s);
    g.fillStyle = '#fff7de';
    for (let i = 0; i < 3; i++) {
      const y = i * s / 3;
      g.beginPath(); g.moveTo(s * 0.15, y + s * 0.15); g.lineTo(s * 0.5, y + s * 0.3);
      g.lineTo(s * 0.85, y + s * 0.15); g.lineTo(s * 0.85, y + s * 0.22);
      g.lineTo(s * 0.5, y + s * 0.37); g.lineTo(s * 0.15, y + s * 0.22); g.fill();
    }
  }, 128), []);
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((s) => { if (mesh.current) (mesh.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4 + Math.sin(s.clock.elapsedTime * 3) * 0.15; });
  return <>
    {BOOST_PADS.map((p, i) => <group key={i} position={[p.x, arenaHeight(p.x, p.z) + 0.075, p.z]} rotation={[0, p.heading, 0]}>
      <SoftBox size={[3.2, 0.08, 4.2]} color="#435b4e" />
      <mesh ref={i === 0 ? mesh : undefined} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <planeGeometry args={[2.9, 3.9]} /><meshStandardMaterial map={arrow} emissiveMap={arrow} emissive="#ffb03a" emissiveIntensity={0.4} roughness={0.5} />
      </mesh>
    </group>)}
    {JUMP_PADS.map((p, i) => <group key={`j${i}`} position={[p.x, 0.08, p.z]} rotation={[0, p.heading, 0]}>
      <SoftBox size={[3.3, 0.12, 3.5]} color="#59c7b4" />
      {[0, 1, 2].map((k) => <mesh key={k} position={[0, 0.1, (k - 1) * 0.8]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.35, 0.04, 5, 14]} /><Mat color="#eef7df" kind="plastic" />
      </mesh>)}
    </group>)}
  </>;
}
function Tunnel() {
  return <group>
    {[20, 22.5, 25, 27.5].map((x) => <mesh key={x} position={[x, 0.02, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
      <torusGeometry args={[3.2, 0.18, 8, 24, Math.PI]} /><Mat color="#88b4a0" kind="plastic" />
    </mesh>)}
    {[-3.2, 3.2].map((z) => <SoftBox key={z} position={[23.5, 0.3, z]} size={[8.5, 0.6, 0.35]} color="#637d68" />)}
  </group>;
}
export function BattleArena({ paint }: { paint: TerritoryMap }) {
  const baseGeo = useMemo(() => surfaceGeometry(0.012), []);
  const paintGeo = useMemo(() => surfaceGeometry(0.044), []);
  const deckGeo = useMemo(() => deckGeometry(), []);
  const paper = useMemo(arenaPaper, []), wood = useMemo(() => woodTexture(4), []);
  return <group>
    <mesh geometry={baseGeo} receiveShadow><meshStandardMaterial map={paper} roughness={0.85} /></mesh>
    <mesh geometry={paintGeo} renderOrder={2} receiveShadow>
      <meshStandardMaterial map={paint.texture} transparent depthWrite={false} roughness={0.46} metalness={0.03} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
    {/* 그레이박스 가이드: 중앙 광장 + 외곽 순환로 */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} renderOrder={1}>
      <ringGeometry args={[15.7, 16.3, 64]} /><meshBasicMaterial color="#d8c49a" transparent opacity={0.9} depthWrite={false} />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} renderOrder={1}>
      <ringGeometry args={[28.7, 29.3, 96]} /><meshBasicMaterial color="#d8c49a" transparent opacity={0.55} depthWrite={false} />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} renderOrder={1}>
      <ringGeometry args={[38.7, 39.3, 96]} /><meshBasicMaterial color="#d8c49a" transparent opacity={0.55} depthWrite={false} />
    </mesh>
    <mesh position={[0, -0.65, 0]} receiveShadow><boxGeometry args={[ARENA_SIZE + 5, 1.2, ARENA_SIZE + 5]} /><meshStandardMaterial map={wood} roughness={0.8} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.3, 0]}><planeGeometry args={[220, 220]} /><Mat color="#89a690" kind="matte" /></mesh>
    {/* Low rails keep the playfield readable without hiding the paint. */}
    {[-1, 1].map((s) => <group key={s}>
      <SoftBox size={[ARENA_SIZE - 2, 0.8, 0.65]} position={[0, 0.4, s * (HALF - 1)]} color="#88b198" />
      <SoftBox size={[0.65, 0.8, ARENA_SIZE - 2]} position={[s * (HALF - 1), 0.4, 0]} color="#88b198" />
    </group>)}
    {BARRIERS.map((b, i) => <group key={i}>
      <SoftBox size={[b.w, b.h, b.d]} position={[b.x, b.h / 2, b.z]} color={i % 2 ? '#e59e86' : '#8cafb3'} radius={0.2} />
      <SoftBox size={[b.w + 0.16, 0.12, b.d + 0.16]} position={[b.x, b.h, b.z]} color="#f0ddba" />
      {[-0.6, 0.6].map((x) => <mesh key={x} position={[b.x + x, b.h + 0.14, b.z]}>
        <cylinderGeometry args={[0.25, 0.25, 0.25, 12]} /><Mat color="#f0ddba" kind="plastic" />
      </mesh>)}
    </group>)}
    {ARENA_OBSTACLES.map((o, i) => <PaintCan key={i} position={[o.x, arenaHeight(o.x, o.z), o.z]} scale={o.r / 1.5} color={['#e2ab79', '#78b7a3', '#86a4c5'][i % 3]} number={`0${i + 1}`} />)}
    <Pads />
    {/* 02 고가도로 데크 + 기둥. 하부 유효 높이 4U */}
    <mesh geometry={deckGeo} receiveShadow castShadow><meshStandardMaterial color="#c9a36a" roughness={0.85} /></mesh>
    {[-1, 1].map((s) => <group key={`deck-pillar-${s}`}>
      <SoftBox size={[0.8, OVERPASS.deckY, 0.8]} position={[OVERPASS.x - OVERPASS.w / 2 + 0.4, OVERPASS.deckY / 2, s * (OVERPASS.deckLen / 2 - 0.4)]} color="#8a6f4d" />
      <SoftBox size={[0.8, OVERPASS.deckY, 0.8]} position={[OVERPASS.x + OVERPASS.w / 2 - 0.4, OVERPASS.deckY / 2, s * (OVERPASS.deckLen / 2 - 0.4)]} color="#8a6f4d" />
    </group>)}
    {/* 01 점프대 그레이박스 8x12x2 */}
    {RAMPS.map((r, i) => <group key={`ramp-${i}`} position={[r.x, 0, r.z]} rotation={[0, r.heading * Math.PI / 180, 0]}>
      <mesh position={[0, 0.5, 0]} rotation={[-Math.atan2(2, 12), 0, 0]} receiveShadow>
        <boxGeometry args={[8, 0.3, 13.5]} /><meshStandardMaterial color="#d9b06a" roughness={0.9} />
      </mesh>
    </group>)}
    {/* 03 뱅크 코너 가이드 */}
    {BANKS.map((b, i) => <group key={`bank-${i}`} position={[b.x, 0.05, b.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[13, 23, 48, 1, 0, Math.PI / 2]} /><meshBasicMaterial color="#c98f5a" transparent opacity={0.35} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>)}
    {/* 04 낮은 굴곡: 통과형 */}
    {BUMPS.map((b, i) => <group key={`bump-${i}`} position={[b.x, 0.1, b.z]} rotation={[0, b.heading * Math.PI / 180, 0]}>
      <mesh scale={[1, 0.35, 1]} receiveShadow><sphereGeometry args={[2.6, 20, 12]} /><meshStandardMaterial color="#c44b3d" roughness={0.8} /></mesh>
    </group>)}
    {/* 06 수리 지점: 도구함 + 트리거 링 */}
    {REPAIRS.map((r, i) => <group key={`repair-${i}`} position={[r.x, 0, r.z]}>
      <SoftBox size={[3, 1.6, 2.2]} position={[0, 0.8, 0]} color="#4f8f7b" />
      <SoftBox size={[3.2, 0.18, 2.4]} position={[0, 1.7, 0]} color="#e8d9a8" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
        <ringGeometry args={[2.0, 2.4, 32]} /><meshBasicMaterial color="#7fd8a0" transparent opacity={0.8} depthWrite={false} />
      </mesh>
    </group>)}
    <PaintCan position={[-38, -0.5, -26]} scale={3.6} color="#efb092" number="01" />
    <PaintCan position={[38, -0.5, 20]} scale={3.2} color="#8bb9b8" number="02" />
    <PaintCan position={[16, -0.5, -40]} scale={2.7} color="#dfc483" number="03" />
    <BigBrush position={[-35, 0, 8]} rotation={[0.3, 0.25, -0.9]} scale={2.2} />
    <BigBrush position={[30, 1.5, -34]} rotation={[0.3, 1.2, Math.PI / 2]} scale={2} color="#c6856f" />
    <PetBottle position={[-38, -0.5, 32]} scale={1.5} tint="#b6dabf" cap="#527669" />
    <CardboardBox position={[37, -0.5, -30]} rotation={[0, 0.3, 0]} size={[10, 9, 8]} open />
    <Pencil position={[-5, 1, 38]} rotation={[0, 0.2, Math.PI / 2]} length={29} color="#e9b856" />
    {/* 08 가장자리 장식: 경계 밖 배치, 충돌 없음. 시야 가림 페이드는 TODO */}
    {Array.from({ length: 10 }, (_, k) => {
      const ang = k / 10 * Math.PI * 2 + 0.31;
      const px = Math.cos(ang) * 53, pz = Math.sin(ang) * 53;
      return <group key={`perim-${k}`} position={[px, -0.5, pz]} rotation={[0, -ang, 0]}>
        {k % 3 === 0
          ? <PaintCan position={[0, 0, 0]} scale={3.4} color={k % 2 ? '#8bb9b8' : '#efb092'} number={`${k + 1}`} />
          : k % 3 === 1
            ? <CardboardBox position={[0, 0, 0]} rotation={[0, 0.3, 0]} size={[8, 7, 6]} open />
            : <PetBottle position={[0, 0, 0]} scale={1.6} tint="#b6dabf" cap="#527669" />}
      </group>;
    })}
    <WorkshopSign text="COLOR FACTORY" position={[0, 11, -39]} width={23} sub="NO FINISH LINE. MAKE IT YOURS." />
    {[-1, 1].map((s) => <SoftBox key={s} size={[0.4, 16, 0.4]} color="#57776b" position={[s * 14, 7, -39]} />)}
  </group>;
}