// Shared monsters: two players on the same map see the same monsters in the same places, and a
// hit from the player who isn't the monster host lands on the host's copy.
import assert from 'node:assert/strict';
import { launch, ready, sleep, BASE } from './harness.mjs';

const { player, kill } = await launch();
try {
  const A = await player('Red'), B = await player('Blue');
  await A.go(`${BASE}/game/world3d/?area=fields&hour=13`);
  assert.ok(await ready(A));
  await sleep(1500); // A is in first, so A runs the monsters
  await B.go(`${BASE}/game/world3d/?area=fields&hour=13`);
  assert.ok(await ready(A)); assert.ok(await ready(B));
  await sleep(4000);
  const mobs = (p) => p.ev(`__world3d.monsters.filter((m) => !m.dead).map((m) => ({ sid: m.sid, x: m.x, z: m.z, hp: m.hp })).sort((a, b) => a.sid < b.sid ? -1 : 1)`);
  const a = await mobs(A), b = await mobs(B);
  assert.ok(a.length > 0, 'A has monsters');
  assert.deepEqual(b.map((m) => m.sid), a.map((m) => m.sid), 'same monsters on both screens');
  for (const m of a) {
    const o = b.find((q) => q.sid === m.sid);
    assert.ok(Math.hypot(m.x - o.x, m.z - o.z) < 2.5, `${m.sid} in about the same place`);
  }
  // B hits one: A's copy loses HP too
  const sid = a[0].sid;
  await B.ev(`(() => { const m = __world3d.monsters.find((q) => q.sid === '${sid}'); __world3d.hitMonster(m, 3); return 1; })()`);
  await sleep(1200);
  const hpA = await A.ev(`__world3d.monsters.find((q) => q.sid === '${sid}').hp`);
  assert.ok(hpA < a[0].hp, `A saw B's hit (${a[0].hp} -> ${hpA})`);
  // a group kill: A chips in a little, B finishes it, and both get the full XP
  const xp = (p) => p.ev('__world3d.field().xp');
  const [xa, xb] = [await xp(A), await xp(B)];
  const target = a[1].sid, hp = await A.ev(`__world3d.monsters.find((q) => q.sid === '${target}').cfg.hp`);
  const reward = await A.ev(`__world3d.monsters.find((q) => q.sid === '${target}').cfg.xp`);
  await A.ev(`(() => { const m = __world3d.monsters.find((q) => q.sid === '${target}'); __world3d.hitMonster(m, ${Math.ceil(hp * 0.15)}); return 1; })()`);
  await sleep(1200);
  await B.ev(`(() => { const m = __world3d.monsters.find((q) => q.sid === '${target}'); __world3d.hitMonster(m, ${hp}); return 1; })()`);
  await sleep(1500);
  assert.equal(await A.ev(`__world3d.monsters.find((q) => q.sid === '${target}').dead`), true, 'dead for A too');
  assert.equal(await xp(A), xa + reward, 'A got the kill');
  assert.equal(await xp(B), xb + reward, 'B got the kill');
  console.log('PASS');
} finally { kill(); }
process.exit(0);
