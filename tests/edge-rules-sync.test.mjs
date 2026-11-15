// The Supabase Edge Function bundles its own copies of the game's rule files
// (supabase/functions/game/rules). They must match the game's exactly.
// If this fails: node tools/sync-edge-rules.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES } from '../tools/sync-edge-rules.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

test('the Edge Function\'s rule files match the game\'s', () => {
  for (const [name, src] of Object.entries(RULES)) {
    const a = readFileSync(join(ROOT, src), 'utf8'), b = readFileSync(join(ROOT, 'supabase/functions/game/rules', name), 'utf8');
    assert.ok(a === b, `supabase/functions/game/rules/${name} differs from ${src}: run node tools/sync-edge-rules.mjs`);
  }
});
