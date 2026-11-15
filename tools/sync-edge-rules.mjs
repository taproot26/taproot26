// Copies the game's rule files into the Edge Function (supabase/functions/game/rules), which can
// only bundle files inside supabase/functions. Run after changing any of them:
//   node tools/sync-edge-rules.mjs
// tests/edge-rules-sync.test.mjs fails while the copies differ.
import { copyFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const RULES = {
  'items.js': 'game/items.js',
  'economy.js': 'game/world3d/economy.js',
  'shops.js': 'game/world3d/shops.js',
  'farm.js': 'game/world3d/farm.js',
  'blocks.js': 'game/world3d/blocks.js',
};
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = join(ROOT, 'supabase/functions/game/rules');
  mkdirSync(out, { recursive: true });
  for (const [name, src] of Object.entries(RULES)) { copyFileSync(join(ROOT, src), join(out, name)); console.log(`${src} -> supabase/functions/game/rules/${name}`); }
}
