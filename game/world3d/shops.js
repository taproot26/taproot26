/* ============================================================================
   Shops, sell prices and crafting recipes for the 3D world. Edit freely.

   - SHOPS: keyed by the building's sign name in /game/world3d (the object's
     name in AREAS). `stock` is [id, price in gold]; ids are gear from
     /game/items.js (GAME.ITEMS) or consumables below.
   - SELL: what a shop pays for one of each bag item.
   - RECIPES: made at the crafting table in the Workshop. `needs` are bag
     items (monster drops, consumables); `gold` is an extra fee; `qty` makes
     more than one.
   - CONSUMABLES: bag items you can drink / eat for HP (click them in the bag,
     or press H for the best potion you have).
   ============================================================================ */

export const CONSUMABLES = {
  health_potion: { name: 'Health Potion', heal: 40, emoji: '\u{1F9EA}' },
  big_potion:    { name: 'Big Potion',    heal: 100, emoji: '⚗️' },
  apple:         { name: 'Apple',         heal: 10, emoji: '\u{1F34E}' },
};

export const SHOPS = {
  'Potion Shop': {
    keeper: 'Wren',
    greeting: 'Potions, wands and a little gossip. What will it be?',
    stock: [['health_potion', 15], ['big_potion', 45], ['apprentice_wand', 45], ['fire_wand', 140], ['oak_staff', 70],
      ['tome_of_sparks', 60], ['crystal_orb', 220], ['wizard_hat', 40], ['mage_robe', 80]],
  },
  'The Armoury': {
    keeper: 'Mira',
    greeting: 'Steel for the brave. Bring me goblin ears and we can talk.',
    stock: [['iron_sword', 50], ['wooden_shield', 35], ['iron_helm', 45], ['leather_boots', 25], ['cutlass', 110],
      ['chainmail', 120], ['steel_armor', 160], ['tower_shield', 140], ['iron_greaves', 70]],
  },
  'Fruit Stall': {
    keeper: 'Old Fenn',
    greeting: 'Fresh from the fields! Mind the slimes on your way out.',
    stock: [['apple', 4], ['health_potion', 18]],
  },
};

export const SELL = { slime_gel: 3, spore_cap: 4, bat_fang: 5, goblin_ear: 8, royal_jelly: 40, health_potion: 6, big_potion: 18, apple: 1 };

export const RECIPES = [
  // the first gear loop: beat a slime and a bat, grab their drops and 10 gold, forge a fire staff
  { id: 'inferno_staff', needs: { slime_gel: 1, bat_fang: 1 }, gold: 10 },
  { id: 'health_potion', needs: { slime_gel: 2, spore_cap: 1 }, gold: 0, qty: 2 },
  { id: 'big_potion', needs: { royal_jelly: 1, slime_gel: 3 }, gold: 10 },
  { id: 'apprentice_wand', needs: { slime_gel: 3, bat_fang: 1 }, gold: 0 },
  { id: 'fire_wand', needs: { spore_cap: 3, bat_fang: 2, goblin_ear: 1 }, gold: 20 },
];
