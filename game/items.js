(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GAME = factory();
})(this, function () {
  const SLOTS = ['head', 'eyes', 'body', 'rhand', 'lhand', 'feet', 'pet'];
  const STAT_KEYS = ['hp', 'atk', 'def', 'mag', 'spd'];
  const STAT_LABELS = { hp: 'HP', atk: 'ATK', def: 'DEF', mag: 'MAG', spd: 'SPD' };
  var SLOT_LABELS = { head: 'Head', eyes: 'Eyes', body: 'Body', rhand: 'R.Hand', lhand: 'L.Hand', feet: 'Feet', pet: 'Pet' };
  var SLOT_ICONS = { head: '\u{1F451}', eyes: '\u{1F441}', body: '\u{1F6E1}', rhand: '\u{2694}', lhand: '\u{1F6E1}', feet: '\u{1F45F}', pet: '\u{1F43E}' };
  var RARITY_ORDER = ['legendary', 'rare', 'uncommon', 'common'];
  var RARITIES = {
    common:    { label: 'Common',    color: '#9a95a8', power: 0 },
    uncommon:  { label: 'Uncommon',  color: '#8fd694', power: 2 },
    rare:      { label: 'Rare',      color: '#7ba8f0', power: 5 },
    legendary: { label: 'Legendary', color: '#e8c46a', power: 10 },
  };

  const BASE = {
    knight: { hp: 120, atk: 10, def: 10, mag: 2, spd: 4 },
    mage:   { hp: 80,  atk: 3,  def: 3,  mag: 12, spd: 5 },
    ranger: { hp: 95,  atk: 9,  def: 5,  mag: 3, spd: 8 },
    rogue:  { hp: 90,  atk: 9,  def: 4,  mag: 2, spd: 10 },
  };

  const ITEMS = {
    // HEAD
    iron_helm:     { name: 'Iron Helm',     slot: 'head',   rarity: 'common',    stats: { hp: 10, def: 3 } },
    wizard_hat:    { name: 'Wizard Hat',    slot: 'head',   rarity: 'common',    stats: { hp: 5, mag: 3 } },
    ranger_hood:   { name: 'Ranger Hood',   slot: 'head',   rarity: 'common',    stats: { def: 1, spd: 2 } },
    rogue_hood:    { name: 'Rogue Hood',    slot: 'head',   rarity: 'common',    stats: { def: 1, spd: 3 } },
    chain_coif:    { name: 'Chain Coif',    slot: 'head',   rarity: 'uncommon',  stats: { hp: 15, def: 4 } },
    gold_crown:    { name: 'Gold Crown',    slot: 'head',   rarity: 'rare',      stats: { hp: 30, def: 2, mag: 2 } },
    dragon_crown:  { name: 'Dragon Crown',  slot: 'head',   rarity: 'legendary', stats: { hp: 40, def: 5, mag: 5, atk: 3 } },
    // EYES
    round_specs:   { name: 'Round Specs',   slot: 'eyes',   rarity: 'common',    stats: { mag: 2 } },
    shadow_visor:  { name: 'Shadow Visor',  slot: 'eyes',   rarity: 'uncommon',  stats: { atk: 1, spd: 2 } },
    mystic_monocle:{ name: 'Mystic Monocle',slot: 'eyes',   rarity: 'rare',      stats: { mag: 4, hp: 10 } },
    dragons_gaze:  { name: "Dragon's Gaze", slot: 'eyes',   rarity: 'legendary', stats: { mag: 6, atk: 3, hp: 15 } },
    // BODY
    steel_armor:   { name: 'Steel Armor',   slot: 'body',   rarity: 'common',    stats: { hp: 25, def: 5, spd: -1 } },
    mage_robe:     { name: 'Mage Robe',     slot: 'body',   rarity: 'common',    stats: { hp: 10, def: 1, mag: 5 } },
    ranger_tunic:  { name: 'Ranger Tunic',  slot: 'body',   rarity: 'common',    stats: { hp: 15, def: 2, spd: 2 } },
    rogue_tunic:   { name: 'Rogue Tunic',   slot: 'body',   rarity: 'common',    stats: { hp: 10, def: 2, spd: 3 } },
    leather_vest:  { name: 'Leather Vest',  slot: 'body',   rarity: 'uncommon',  stats: { hp: 20, def: 3, spd: 1 } },
    phoenix_plate: { name: 'Phoenix Plate', slot: 'body',   rarity: 'legendary', stats: { hp: 50, def: 8, mag: 3, spd: 2 } },
    // RIGHT HAND (weapons)
    iron_sword:    { name: 'Iron Sword',    slot: 'rhand',  rarity: 'common',    stats: { atk: 5 } },
    oak_staff:     { name: 'Oak Staff',     slot: 'rhand',  rarity: 'common',    stats: { atk: 1, mag: 5 } },
    hunter_bow:    { name: 'Hunter Bow',    slot: 'rhand',  rarity: 'common',    stats: { atk: 4, spd: 2 } },
    shadow_dagger: { name: 'Shadow Dagger', slot: 'rhand',  rarity: 'common',    stats: { atk: 3, spd: 4 } },
    composite_bow: { name: 'Composite Bow', slot: 'rhand',  rarity: 'uncommon',  stats: { atk: 6, spd: 1 } },
    ember_blade:   { name: 'Ember Blade',   slot: 'rhand',  rarity: 'rare',      stats: { atk: 8, mag: 2 } },
    void_blade:    { name: 'Void Blade',    slot: 'rhand',  rarity: 'legendary', stats: { atk: 12, mag: 5, spd: 3 } },
    // LEFT HAND (shields / off-hand)
    wooden_shield: { name: 'Wooden Shield', slot: 'lhand',  rarity: 'common',    stats: { def: 4, hp: 5 } },
    iron_buckler:  { name: 'Iron Buckler',  slot: 'lhand',  rarity: 'common',    stats: { def: 3, spd: 1 } },
    tome_of_sparks:{ name: 'Tome of Sparks',slot: 'lhand',  rarity: 'common',    stats: { mag: 4 } },
    lantern:       { name: 'Lantern',       slot: 'lhand',  rarity: 'common',    stats: { mag: 2, spd: 1 } },
    tower_shield:  { name: 'Tower Shield',  slot: 'lhand',  rarity: 'uncommon',  stats: { def: 6, hp: 15, spd: -2 } },
    crystal_orb:   { name: 'Crystal Orb',   slot: 'lhand',  rarity: 'rare',      stats: { mag: 6, hp: 10 } },
    aegis:         { name: 'Aegis',         slot: 'lhand',  rarity: 'legendary', stats: { def: 10, hp: 30, mag: 3 } },
    // FEET
    leather_boots: { name: 'Leather Boots', slot: 'feet',   rarity: 'common',    stats: { spd: 2, def: 1 } },
    swift_sandals: { name: 'Swift Sandals', slot: 'feet',   rarity: 'uncommon',  stats: { spd: 4 } },
    iron_greaves:  { name: 'Iron Greaves',  slot: 'feet',   rarity: 'uncommon',  stats: { def: 4, hp: 10, spd: -1 } },
    winged_boots:  { name: 'Winged Boots',  slot: 'feet',   rarity: 'rare',      stats: { spd: 6, atk: 1 } },
    dragons_stride:{ name: "Dragon's Stride",slot:'feet',   rarity: 'legendary', stats: { spd: 5, def: 5, hp: 20 } },
    // PET
    baby_slime:    { name: 'Baby Slime',    slot: 'pet',    rarity: 'common',    stats: { hp: 10 } },
    forest_fox:    { name: 'Forest Fox',    slot: 'pet',    rarity: 'uncommon',  stats: { spd: 3, atk: 1 } },
    ember_sprite:  { name: 'Ember Sprite',  slot: 'pet',    rarity: 'rare',      stats: { mag: 4, atk: 2 } },
    void_familiar: { name: 'Void Familiar', slot: 'pet',    rarity: 'legendary', stats: { mag: 6, spd: 3, hp: 20 } },
  };

  const KITS = {
    knight: { head: 'iron_helm',   body: 'steel_armor',  rhand: 'iron_sword',    lhand: 'wooden_shield' },
    mage:   { head: 'wizard_hat',  body: 'mage_robe',    rhand: 'oak_staff',     lhand: 'tome_of_sparks' },
    ranger: { head: 'ranger_hood', body: 'ranger_tunic', rhand: 'hunter_bow' },
    rogue:  { head: 'rogue_hood',  body: 'rogue_tunic',  rhand: 'shadow_dagger', lhand: 'lantern' },
  };

  function defaultEquipment(cls) {
    return Object.assign({}, KITS[cls]);
  }

  function migrateEquipment(eq) {
    if (!eq) return eq;
    if ('weapon' in eq) {
      eq.rhand = eq.rhand || eq.weapon;
      delete eq.weapon;
    }
    if ('hands' in eq) {
      eq.rhand = eq.rhand || eq.hands;
      delete eq.hands;
    }
    return eq;
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

  function computePower(cls, equipment) {
    var p = 0;
    SLOTS.forEach(function (slot) {
      var id = equipment && equipment[slot];
      var item = id && Object.prototype.hasOwnProperty.call(ITEMS, id) ? ITEMS[id] : null;
      if (item && item.slot === slot) {
        STAT_KEYS.forEach(function (k) { p += item.stats[k] || 0; });
        p += RARITIES[item.rarity].power;
      }
    });
    return p;
  }

  return { SLOTS, STAT_KEYS, STAT_LABELS, SLOT_LABELS, SLOT_ICONS, BASE, ITEMS, KITS, RARITIES, RARITY_ORDER, defaultEquipment, migrateEquipment, computeStats, computePower };
});
