(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GAME = factory();
})(this, function () {
  const SLOTS = ['head', 'body', 'weapon'];
  const STAT_KEYS = ['hp', 'atk', 'def', 'mag', 'spd'];
  const STAT_LABELS = { hp: 'HP', atk: 'ATK', def: 'DEF', mag: 'MAG', spd: 'SPD' };

  const BASE = {
    knight: { hp: 120, atk: 10, def: 10, mag: 2, spd: 4 },
    mage:   { hp: 80,  atk: 3,  def: 3,  mag: 12, spd: 5 },
    ranger: { hp: 95,  atk: 9,  def: 5,  mag: 3, spd: 8 },
    rogue:  { hp: 90,  atk: 9,  def: 4,  mag: 2, spd: 10 },
  };

  const ITEMS = {
    iron_helm:     { name: 'Iron Helm',     slot: 'head',   rarity: 'common', stats: { hp: 10, def: 3 } },
    wizard_hat:    { name: 'Wizard Hat',    slot: 'head',   rarity: 'common', stats: { hp: 5, mag: 3 } },
    ranger_hood:   { name: 'Ranger Hood',   slot: 'head',   rarity: 'common', stats: { def: 1, spd: 2 } },
    rogue_hood:    { name: 'Rogue Hood',    slot: 'head',   rarity: 'common', stats: { def: 1, spd: 3 } },
    gold_crown:    { name: 'Gold Crown',    slot: 'head',   rarity: 'rare',   stats: { hp: 30, def: 2, mag: 2 } },
    steel_armor:   { name: 'Steel Armor',   slot: 'body',   rarity: 'common', stats: { hp: 25, def: 5, spd: -1 } },
    mage_robe:     { name: 'Mage Robe',     slot: 'body',   rarity: 'common', stats: { hp: 10, def: 1, mag: 5 } },
    ranger_tunic:  { name: 'Ranger Tunic',  slot: 'body',   rarity: 'common', stats: { hp: 15, def: 2, spd: 2 } },
    rogue_tunic:   { name: 'Rogue Tunic',   slot: 'body',   rarity: 'common', stats: { hp: 10, def: 2, spd: 3 } },
    iron_sword:    { name: 'Iron Sword',    slot: 'weapon', rarity: 'common', stats: { atk: 5 } },
    oak_staff:     { name: 'Oak Staff',     slot: 'weapon', rarity: 'common', stats: { atk: 1, mag: 5 } },
    hunter_bow:    { name: 'Hunter Bow',    slot: 'weapon', rarity: 'common', stats: { atk: 4, spd: 2 } },
    shadow_dagger: { name: 'Shadow Dagger', slot: 'weapon', rarity: 'common', stats: { atk: 3, spd: 4 } },
    ember_blade:   { name: 'Ember Blade',   slot: 'weapon', rarity: 'rare',   stats: { atk: 8, mag: 2 } },
  };

  const KITS = {
    knight: { head: 'iron_helm',   body: 'steel_armor',  weapon: 'iron_sword' },
    mage:   { head: 'wizard_hat',  body: 'mage_robe',    weapon: 'oak_staff' },
    ranger: { head: 'ranger_hood', body: 'ranger_tunic', weapon: 'hunter_bow' },
    rogue:  { head: 'rogue_hood',  body: 'rogue_tunic',  weapon: 'shadow_dagger' },
  };

  function defaultEquipment(cls) {
    return Object.assign({}, KITS[cls]);
  }

  function computeStats(cls, equipment) {
    const stats = Object.assign({}, BASE[cls]);
    SLOTS.forEach(function (slot) {
      const id = equipment && equipment[slot];
      const item = id && Object.prototype.hasOwnProperty.call(ITEMS, id) ? ITEMS[id] : null;
      if (item && item.slot === slot) STAT_KEYS.forEach(function (k) { stats[k] += item.stats[k] || 0; });
    });
    return stats;
  }

  return { SLOTS, STAT_KEYS, STAT_LABELS, BASE, ITEMS, KITS, defaultEquipment, computeStats };
});
