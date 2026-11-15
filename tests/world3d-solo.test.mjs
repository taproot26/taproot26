import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

globalThis.location = { search: '?area=mine1&solo=1' };
// solo.js is a plain browser script (world3d/ is "type": "module", so it can't be require()d): run it as one
vm.runInThisContext(readFileSync(new URL('../game/world3d/solo.js', import.meta.url), 'utf8'));
const { SOLO, soloKey, withSolo, installSolo } = globalThis;

const fakeStorage = (init) => {
  const map = new Map(Object.entries(init));
  return { map, getItem(k) { return map.has(k) ? map.get(k) : null; }, setItem(k, v) { map.set(k, String(v)); }, removeItem(k) { map.delete(k); } };
};

test('SOLO reads ?solo=1', () => assert.equal(SOLO, true));

test('soloKey prefixes once', () => {
  assert.equal(soloKey('taproot_field'), 'taproot_solo:taproot_field');
  assert.equal(soloKey(soloKey('a')), soloKey('a'));
});

test('withSolo keeps query', () => {
  assert.equal(withSolo('/game/world3d/?area=arena&from=city'), '/game/world3d/?area=arena&from=city&solo=1');
  assert.equal(withSolo('/game/world3d/'), '/game/world3d/?solo=1');
  assert.equal(withSolo('/x/?a=1#h'), '/x/?a=1&solo=1#h');
  assert.equal(withSolo('/x/?solo=1'), '/x/?solo=1');
});

test('online keys untouched', () => {
  const s = fakeStorage({ taproot_field: '{"gold":5}' });
  installSolo(s);
  assert.equal(s.getItem('taproot_field'), null);
  s.setItem('taproot_field', '{"gold":99}');
  assert.equal(s.map.get('taproot_field'), '{"gold":5}');
  assert.equal(s.getItem('taproot_field'), '{"gold":99}');
  s.removeItem('taproot_field');
  assert.equal(s.map.get('taproot_field'), '{"gold":5}');
});
