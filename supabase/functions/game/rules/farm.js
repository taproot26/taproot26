/* ============================================================================
   Farming and plot buildings for the 3D world. Edit freely.

   - CROPS: what grows on a plot. `grow` is minutes from seed to ripe and
     `yield` how many you harvest. Seed prices are in the Seed Shop and crop
     prices in SELL (shops.js).
   - BUILDS: what an owner can put on their plot in build mode (G). `size` is
     the footprint in tiles (square), `cost` in gold, `max` per plot.
   - FARM_ITEMS: names and icons for seeds and harvested crops in the bag.
   - ALTAR: the Growth Altar's offering and how long its boost lasts.
   ============================================================================ */

import { SELL } from './shops.js';

export const CROPS = {
  carrot:  { name: 'Carrot',  emoji: '\u{1F955}', grow: 5,  yield: 2 },
  wheat:   { name: 'Wheat',   emoji: '\u{1F33E}', grow: 10, yield: 3 },
  pumpkin: { name: 'Pumpkin', emoji: '\u{1F383}', grow: 60, yield: 1 },
};

export const BUILDS = {
  altar:     { name: 'Growth Altar', emoji: '\u{1F48E}', size: 2, cost: 150, max: 1, about: 'offer a Pumpkin: crops grow 2x faster' },
  clubhouse: { name: 'Clubhouse',    emoji: '\u{1F3E0}', size: 3, cost: 250, max: 1, about: 'hang out with friends' },
  scarecrow: { name: 'Scarecrow',    emoji: '\u{1F383}', size: 1, cost: 20,  max: 4, about: 'decoration' },
};

export const ALTAR = { offering: 'pumpkin', minutes: 60, speed: 2 };

export const FARM_ITEMS = {};
for (const [k, c] of Object.entries(CROPS)) {
  FARM_ITEMS[k + '_seed'] = { name: `${c.name} Seeds`, emoji: '\u{1F331}', info: `Plant on your plot · ready in ${c.grow < 60 ? c.grow + ' min' : c.grow / 60 + ' hour'}` };
  FARM_ITEMS[k] = { name: c.name, emoji: c.emoji, info: `Harvested crop · sells for ${SELL[k]}g` };
}
