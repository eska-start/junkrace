import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ARENA_SIZE, HALF, BARRIERS, BOOST_PADS, RAMPS, BUMPS, REPAIRS, arenaHeight, insideArena, overpassDeckHeight } from '../game/battleMap';
import type { TerritoryMap } from '../game/paint';
import { Mat, makeTexture, rng, woodTexture } from './materials';
import { SoftBox } from './Workshop';
import { CardboardBox, GiantCan, Pencil } from './Props';

// Every visible driving surface samples the same height function as the vehicle.
function surfaceGeometry(x0 = -HALF, z0 = -HALF, w = ARENA_SIZE, d = ARENA_SIZE, lift = 0.015, deck = false) {
  const nx = Math.ceil(w * 2), nz = Math.ceil(d * 2), vertices: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let z = 0; z <= nz; z++) for (let x = 0; x <= nx; x++) {
    const xx = x0 + x / nx * w, zz = z0 + z / nz * d;
    vertices.push(xx, (deck ? overpassDeckHeight(xx, zz) : arenaHeight(xx, zz)) + lift, zz);
    uv.push((xx + HALF) / ARENA_SIZE, 1 - (zz + HALF) / ARENA_SIZE);
  }
  for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
    if (!deck && !insideArena(x0 + (x + 0.5) / nx * w, z0 + (z + 0.5) / nz * d)) continue;
    const a = z * (nx + 1) + x, b = a + nx + 1;
    indices.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(indices); g.computeVertexNormals();
  return g;
}

function workshopPaper() {
  return makeTexture((g, s) => {
    const random = rng(4028), u = s / ARENA_SIZE;
    g.fillStyle = '#a88257'; g.fillRect(0, 0, s, s);
    g.save(); g.translate(s / 2, s / 2); g.scale(u, u);
    // Infield cardboard patches remain completely drivable.
    for (let z = -48; z < 48; z += 8) for (let x = -48; x < 48; x += 12) {
      g.fillStyle = ['#b88e5f', '#b58c60', '#be986b', '#ac8155'][Math.floor(random() * 4)];
      g.fillRect(x + 0.04, z + 0.04, 11.9, 7.9);
      g.strokeStyle = 'rgba(78,49,25,.13)'; g.lineWidth = 0.035; g.strokeRect(x + .2, z + .2, 11.6, 7.6);
    }
    const roads = () => {
      g.beginPath(); g.arc(0, 0, 34, 0, Math.PI * 2); g.lineWidth = 10; g.stroke();
      g.lineWidth = 8;
      for (const a of [45, 135, 225, 315]) {
        const t = a * Math.PI / 180;
        g.beginPath(); g.moveTo(Math.sin(t) * 12, Math.cos(t) * 12); g.lineTo(Math.sin(t) * 35, Math.cos(t) * 35); g.stroke();
      }
      g.beginPath(); g.arc(0, 0, 16, 0, Math.PI * 2); g.fill();
    };
    g.strokeStyle = g.fillStyle = '#d8b780'; roads();
    // Panel joints follow the loop, with narrow masking tape strips.
    for (let i = 0; i < 56; i++) {
      const a = i / 56 * Math.PI * 2;
      g.save(); g.rotate(a); g.fillStyle = i % 3 === 0 ? '#edcf96' : '#c19c65';
      g.fillRect(-.10, 29, i % 3 === 0 ? .38 : .09, 10); g.restore();
    }
    for (const r of [16, 29, 39]) {
      g.strokeStyle = '#efdab0'; g.lineWidth = .38; g.setLineDash([2.2, .12]);
      g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke();
    }
    g.setLineDash([]);
    for (const [cx, cz, angle] of [[-11.272, -11.272, Math.PI * 1.25], [11.272, 11.272, Math.PI * .25]]) {
      g.strokeStyle = '#b9533b'; g.lineWidth = .65;
      g.beginPath(); g.arc(cx, cz, 22.3, angle - Math.PI / 4 + .12, angle + Math.PI / 4 - .12); g.stroke();
    }
    for (const a of [45, 135, 225, 315]) {
      g.save(); g.rotate(a * Math.PI / 180);
      for (const side of [-1, 1]) { g.fillStyle = '#efd8a3'; g.fillRect(side * 3.8 - .15, 16, .3, 15); }
      g.fillStyle = '#c59e6c'; for (let z = 17; z < 30; z += 3) g.fillRect(-3.6, z, 7.2, .07);
      g.restore();
    }
    // Start spots and neutral tape rosette: no decorative paint is scored.
    g.strokeStyle = '#a67a4d'; g.lineWidth = .12;
    for (let z = -12; z <= 12; z += 4) { g.beginPath(); g.moveTo(-Math.sqrt(256-z*z), z); g.lineTo(Math.sqrt(256-z*z), z); g.stroke(); }
    g.strokeStyle = '#f5dfab'; g.lineWidth = .5; g.beginPath(); g.arc(0, 0, 5, 0, Math.PI * 2); g.stroke();
    for (const x of [-8, 8]) for (const z of [-8, 8]) { g.strokeStyle = '#f4deab'; g.lineWidth = .18; g.strokeRect(x - 1.5, z - 2, 3, 4); }
    for (const ramp of RAMPS) {
      g.save(); g.translate(ramp.x, ramp.z); g.rotate(ramp.heading * Math.PI / 180);
      g.fillStyle = '#d6ad72'; g.fillRect(-4, -6, 8, 12);
      g.fillStyle = '#f0d8a5'; g.fillRect(-4, -6, .35, 12); g.fillRect(3.65, -6, .35, 12);
      g.strokeStyle = '#c0955d'; g.lineWidth = .07;
      for (let z = -5; z < 6; z += 2) { g.beginPath(); g.moveTo(-3.6, z); g.lineTo(3.6, z); g.stroke(); }
      g.strokeStyle = '#c4513e'; g.lineWidth = .65;
      for (const z of [-2, 1]) { g.beginPath(); g.moveTo(-1.8, z - 1); g.lineTo(0, z + .5); g.lineTo(1.8, z - 1); g.stroke(); }
      g.restore();
    }
    g.fillStyle = '#d3aa71'; g.fillRect(24, -16, 8, 32);
    for (const x of [24.15, 31.5]) { g.fillStyle = '#f1d5a0'; g.fillRect(x, -16, .35, 32); }
    for (let z = -15; z < 16; z += 2) { g.fillStyle = '#b58c58'; g.fillRect(24.6, z, 6.8, .08); }
    for (const b of BUMPS) {
      g.save(); g.translate(b.x, b.z); g.rotate(b.heading * Math.PI / 180);
      g.fillStyle = '#ba4c39'; g.beginPath(); g.ellipse(0, 0, 2.5, 3, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e6cd94'; g.fillRect(-1.5, -3, .7, 6); g.fillRect(1, -3, .5, 6); g.restore();
    }
    g.restore();
    // Fine fibres and wrinkles are texture detail, not extra geometry.
    for (let i = 0; i < 24000; i++) {
      g.fillStyle = `rgba(${random() > .5 ? '255,237,192' : '73,46,24'},${random() * .1})`;
      g.fillRect(random() * s, random() * s, random() * 9 + 1, 1);
    }
  }, 2048);
}

function BottleCap({ x = 0, z = 0, scale = 1 }: { x?: number; z?: number; scale?: number }) {
  return <group position={[x, 0, z]} scale={scale}>
    <mesh position={[0, .7, 0]} castShadow><cylinderGeometry args={[1.7, 1.8, 1.4, 24]} /><Mat color="#277f78" /></mesh>
    <mesh position={[0, 1.42, 0]}><cylinderGeometry args={[1.45, 1.45, .08, 24]} /><Mat color="#42a99d" /></mesh>
    {Array.from({ length: 16 }, (_, i) => { const a = i / 16 * Math.PI * 2; return <mesh key={i} position={[Math.sin(a) * 1.7, .7, Math.cos(a) * 1.7]} rotation={[0, a, 0]}><boxGeometry args={[.13, 1.15, .16]} /><Mat color="#21675f" /></mesh>; })}
  </group>;
}

// Fade only scenery that lies between the camera and its forward view target.
function fadeMaterials(entries: { mat: THREE.Material; opacity: number }[], fade: number, dt: number) {
  for (const { mat, opacity } of entries) {
    mat.opacity = THREE.MathUtils.damp(mat.opacity, opacity * fade, 8, dt);
    const transparent = mat.opacity < .99;
    if (mat.transparent !== transparent) { mat.transparent = transparent; mat.needsUpdate = true; }
    mat.depthWrite = !transparent;
  }
}
function Scenery({ children, position }: { children: ReactNode; position: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  const materials = useRef<{ mat: THREE.Material; opacity: number }[]>([]);
  const direction = useMemo(() => new THREE.Vector3(), []), delta = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    ref.current?.traverse(obj => {
      if (!(obj instanceof THREE.Mesh)) return;
      const clone = (mat: THREE.Material) => { const m = mat.clone(); materials.current.push({ mat: m, opacity: m.opacity }); return m; };
      obj.material = Array.isArray(obj.material) ? obj.material.map(clone) : clone(obj.material);
    });
    return () => { materials.current.forEach(({ mat }) => mat.dispose()); materials.current = []; };
  }, []);
  useFrame(({ camera }, dt) => {
    camera.getWorldDirection(direction); delta.set(position[0], 3, position[2]).sub(camera.position);
    const along = delta.dot(direction), side = Math.sqrt(Math.max(0, delta.lengthSq() - along * along));
    const fade = along > -3 && along < 20 && side < 7 ? .16 : 1;
    fadeMaterials(materials.current, fade, dt);
  });
  return <group ref={ref} position={position}>{children}</group>;
}

export function BattleArena({ paint }: { paint: TerritoryMap }) {
  const baseGeo = useMemo(() => surfaceGeometry(), []);
  const paintGeo = useMemo(() => { const g = surfaceGeometry(-HALF, -HALF, ARENA_SIZE, ARENA_SIZE, .045); const uv = g.getAttribute('uv'); for (let i=0;i<uv.count;i++) uv.setY(i,1-uv.getY(i)); return g; }, []);
  const deckGeo = useMemo(() => surfaceGeometry(24, -16, 8, 32, .02, true), []);
  const paper = useMemo(() => workshopPaper(), []), wood = useMemo(() => woodTexture(4), []);
  useEffect(() => () => { baseGeo.dispose(); paintGeo.dispose(); deckGeo.dispose(); paper.dispose(); wood.dispose(); }, [baseGeo, paintGeo, deckGeo, paper, wood]);
  return <group>
    <mesh geometry={baseGeo} receiveShadow><meshStandardMaterial map={paper} roughness={.94} /></mesh>
    <mesh geometry={paintGeo} renderOrder={2} receiveShadow><meshStandardMaterial map={paint.texture} transparent depthWrite={false} roughness={.55} polygonOffset polygonOffsetFactor={-2} /></mesh>
    <mesh position={[0, -.65, 0]} receiveShadow><boxGeometry args={[102, 1.2, 102]} /><meshStandardMaterial map={wood} roughness={.9} /></mesh>
    <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -1.3, 0]}><planeGeometry args={[240, 240]} /><Mat color="#87705b" kind="matte" /></mesh>
    {/* Segmented cardboard boundary, low enough to read the playing surface. */}
    {[-1, 1].flatMap(side => Array.from({ length: 16 }, (_, i) => <group key={`${side}-${i}`}>
      <SoftBox position={[-43.5 + i * 5.8, .45, side * 47]} size={[5.5, .9, .55]} color={i % 4 === 0 ? '#ad4e39' : '#b58a55'} radius={.04} />
      <SoftBox position={[side * 47, .45, -43.5 + i * 5.8]} size={[.55, .9, 5.5]} color={i % 4 === 0 ? '#367f76' : '#b58a55'} radius={.04} />
    </group>))}
    {BOOST_PADS.map((p,i) => <group key={i} position={[p.x, arenaHeight(p.x,p.z)+.09,p.z]} rotation={[0,p.heading,0]}>
      <mesh rotation={[-Math.PI/2,0,0]}><planeGeometry args={[3,4]} /><Mat color="#e3b846" /></mesh>
      {[-1,0,1].map(z => <group key={z} position={[0,.015,z]}><mesh rotation={[-Math.PI/2,0,.65]} position={[-.45,0,0]}><planeGeometry args={[.22,1.4]} /><Mat color="#fff0bb" /></mesh><mesh rotation={[-Math.PI/2,0,-.65]} position={[.45,0,0]}><planeGeometry args={[.22,1.4]} /><Mat color="#fff0bb" /></mesh></group>)}
    </group>)}
    <mesh geometry={deckGeo} castShadow receiveShadow><meshStandardMaterial map={paper} roughness={.9} side={THREE.DoubleSide} /></mesh>
    <SoftBox position={[28,4.65,0]} size={[8,.65,8]} color="#a67943" radius={.03} />
    {BARRIERS.map((b,i) => <group key={i}>
      <SoftBox position={[b.x,2,b.z]} size={[b.w,4,b.d]} color="#91613e" radius={.02} />
      <SoftBox position={[b.x,1,b.z]} size={[.8,.35,.8]} color="#32867b" radius={.02} />
    </group>)}
    {/* Corrugated edges and braces make the bridge read as a built object. */}
    {[24.15,31.85].map(x => <group key={x}>
      {[-1,1].map(sign => <mesh key={sign} position={[x,2.43,sign*10]} rotation={[sign*Math.atan2(5,12),0,0]} castShadow><boxGeometry args={[.22,.32,13]} /><Mat color="#966639" kind="matte" /></mesh>)}
      <SoftBox position={[x,4.9,0]} size={[.22,.28,8]} color="#e5c48d" radius={.02} />
    </group>)}
    {RAMPS.map((r,i) => <group key={i} position={[r.x,0,r.z]} rotation={[0,r.heading*Math.PI/180,0]}>
      <SoftBox position={[0,.92,5.85]} size={[7.8,1.8,.22]} color="#ab7c45" radius={.02} />
      {[-3.8,3.8].map(x => <group key={x}>
        <mesh position={[x,.9,0]} rotation={[-Math.atan2(2,12),0,0]}><boxGeometry args={[.16,.12,12.1]} /><Mat color="#f0d19b" kind="matte" /></mesh>
        <SoftBox position={[x,2.3,5.7]} size={[.13,1.6,.13]} color="#a86e40" radius={.02} />
        <mesh position={[x+.35,2.8,5.7]}><boxGeometry args={[.7,.45,.035]} /><Mat color={i ? '#2e9f95' : '#c94c38'} /></mesh>
      </group>)}
    </group>)}
    {REPAIRS.map((r,i) => <group key={i} position={[r.x,0,r.z]}>
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,.075,0]}><ringGeometry args={[2,2.4,40]} /><meshBasicMaterial color="#b4edab" /></mesh>
      {/* The toolboxes are beside the trigger, not on the driving line. */}
      <group position={[i ? 6 : -6,0,0]}>
        <SoftBox position={[0,.65,0]} size={[2.8,1.3,2]} color="#b84432" radius={.08} />
        <SoftBox position={[0,1.32,0]} size={[3,.16,2.1]} color="#dab67a" radius={.03} />
        <SoftBox position={[0,1.65,0]} size={[1.2,.18,.2]} color="#4c4e42" radius={.02} />
        <BottleCap x={0} z={2.3} scale={.55} />
        <SoftBox position={[0,1.7,-1.25]} size={[3.6,3.4,.2]} color="#af8554" radius={.03} />
        {[-1,0,1].map(x=><mesh key={x} position={[x,2,-1.05]} rotation={[0,0,x*.3]}><boxGeometry args={[.18,1.4,.12]} /><Mat color="#a4ada0" kind="metal" /></mesh>)}
      </group>
    </group>)}
    {/* Ten scenery clusters wholly outside the ±48 playing square. */}
    {([[-55,-34],[-55,0],[-55,34],[55,-34],[55,0],[55,34],[-28,-55],[22,-55],[-28,55],[22,55]] as [number,number][]).map(([x,z],i)=><Scenery key={i} position={[x,-.5,z]}>
      <CardboardBox position={[0,0,0]} size={[6,3.2,5]} rotation={[0,i*.4,0]} />
      {i%3===0 ? <GiantCan position={[0,3.1,0]} scale={1.25} color="#bd4433" /> : i%3===1 ? <Pencil position={[0,3,0]} length={8} rotation={[.2,0,-.18]} color="#e7b537" /> : <CardboardBox position={[0,3.2,0]} size={[4,4,3.6]} rotation={[0,.2,0]} />}
      <BottleCap x={3} z={2.5} scale={1.15} />
      <BottleCap x={-2.6} z={2.8} scale={.7} />
    </Scenery>)}
  </group>;
}
