import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Run the actual TypeScript physics in Node without a browser or a test framework.
const moduleUrl = async (file, imports = {}) => {
  let code = ts.transpileModule(await readFile(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const [name, url] of Object.entries(imports)) code = code.replaceAll(`from '${name}'`, `from '${url}'`);
  return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
};
const map = await import(await moduleUrl('../src/jr/game/battleMap.ts'));
const items = await moduleUrl('../src/jr/data/items.ts');
const vehicle = await import(await moduleUrl('../src/jr/game/vehicle.ts', { '../data/items': items }));
const spec = vehicle.computeSpec({ slots: { body: 1, engine: 2 }, wheels: [3,3,3,3] }, { 1: 'can', 2: 'motor', 3: 'cap' }, 'dog');

assert.equal(map.overpassDeckHeight(24, 0), 5, 'Deck must remain flat across its full width');
assert.equal(map.overpassDeckHeight(32, 0), 5);
for (let x = 20; x <= 36; x += .25) assert.equal(map.getDriveSurface(x, 0, 0, 'ground').id, 'ground', 'Ground crossing must not snap onto bridge');
assert.equal(map.segmentClear(18, 0, 38, 0, 1.1), true, 'Underpass must have clear east/west passage');
assert.equal(map.blocked(24.5, 4.5), true, 'Visible bridge support must collide');
for (const direction of [-1, 1]) {
  const st = vehicle.newVehicleState(28, -direction * 18, direction === 1 ? 0 : Math.PI);
  st.speed = 8; let id = 'ground', maxY = 0;
  for (let frame = 0; frame < 500; frame++) {
    const surface = map.getDriveSurface(st.x, st.z, st.y, id); id = surface.id;
    vehicle.stepVehicle(st, { ...spec, wobble: 0 }, { steer: 0, throttle: .45, boost: false }, 1 / 60, surface, []);
    maxY = Math.max(maxY, st.y);
    if (direction * st.z > 18) break;
  }
  assert.ok(maxY > 4.7, `Bridge must be reachable from ${direction} approach (${maxY})`);
}
assert.equal(map.bankHeight(0,0), 0, 'Central plaza must stay flat');
assert.ok(map.bankHeight(-26,-26) > .8, 'NW bank must rise on outer bend');
assert.equal(map.bankHeight(-11.272 + 18, -11.272), 0, 'Bank must not form a complete circular mountain');
assert.equal(map.bankHeight(26,26), map.bankHeight(-26,-26), 'Opposite banks must match');
for (const direction of [-1,1]) {
  const x = direction === 1 ? -6 : 6, z = direction === 1 ? -31 : 31;
  const st = vehicle.newVehicleState(x,z - direction * 8,direction === 1 ? 0 : Math.PI);
  st.speed = 10; let id='ground', previousX=st.x,previousZ=st.z,launches=0,maxY=0;
  for(let frame=0;frame<220;frame++) {
    const surface=map.getDriveSurface(st.x,st.z,st.y,id); id=surface.id;
    const launch=!st.airborne && map.rampTakeoff(previousX,previousZ,st.x,st.z);
    previousX=st.x; previousZ=st.z;
    vehicle.stepVehicle(st,{...spec,wobble:0},{steer:0,throttle:.6,boost:false},1/60,{...surface,jumpImpulse:launch?map.RAMP_TAKEOFF_VY:undefined},[]);
    if(launch) launches++; maxY=Math.max(maxY,st.y);
  }
  assert.equal(launches,1,'Each ramp crossing must launch exactly once');
  assert.ok(maxY>2.2,`Ramp should launch above the lip (${maxY})`);
  assert.equal(st.airborne,false,'Kart should land after the jump');
}
console.log('PASS: flat deck, both approaches, underpass clearance, supports, quadrant banks, both ramp takeoffs and landings');

const camera = map.clearCameraBoom({x:28,y:1.2,z:0}, {x:28,y:4.3,z:-9});
assert.ok(camera.z > -9, 'Camera must shorten under the bridge instead of entering its approach');
assert.ok(camera.y < 4, 'Underpass camera must stay below the deck');
assert.deepEqual(map.clearCameraBoom({x:0,y:1.2,z:0},{x:0,y:4.3,z:-9}), {x:0,y:4.3,z:-9}, 'Unobstructed chase camera must keep its normal distance');
console.log('PASS: bridge camera occlusion and unobstructed chase distance');
