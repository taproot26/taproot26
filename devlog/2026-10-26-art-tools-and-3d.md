# Taproot devlog: art tools, combat and the 3D prototypes

**Dates:** 2026-10-21 to 2026-10-26 · **Repo:** taproot26 · **Branch:** main (all commits local, nothing pushed)

This log covers a run of sessions that took Taproot the Game from hand-drawn browser sprites to a reusable art pipeline, field combat, and three Three.js prototypes. It records what's working, where everything lives, and how to pick it back up.

---

## What's going well (keep doing this)

1. **Generate, preview, fix, wire in.** Every art request follows the same loop. A script draws it, renders a labelled preview sheet, Claude looks once and fixes what's off, then it gets installed into the game. That keeps quality up without endless back-and-forth. The user called this workflow "great".
2. **Procedural art beats prompting.** Claude can't run diffusion models or make images from a reference, so art is drawn in code with real technique:
   - hue-shifted colour ramps, light from the top-left, coloured selective outlines, and dithering on a 16px grid (2D);
   - flat-shaded low-poly shapes, warm sun with soft shadows, and ACES tone mapping (3D).
   The early rectangle-sprites were "trash"; the code-drawn pixel art was "pretty good".
3. **Reusable tools, not one-offs.** Shared code lives in two libraries, `tools/pixelgen/pixel.py` (2D) and `game/lib/stylized3d.js` (3D). New content means adding to a library, not starting over.
4. **Test without a person in the loop.** The offline dev server runs the real API on a mock DB. Pages expose debug hooks (`__yard.tick()`, `__city3d.tick()`, `.snap()`), so frames can be stepped and the camera pinned for screenshots even when the browser tab is hidden.
5. **Commit locally, often.** Each milestone is its own local commit, with other sessions' files left alone. Nothing is pushed unless the user asks.
6. **Match the reference closely.** When the user sends a reference image, the build mirrors its specifics: camera angle, grass density, HUD layout, damage-number style.

---

## Where things live

| Thing | Path | How to run |
|---|---|---|
| 2D pixel-art generator (core) | `tools/pixelgen/pixel.py` | imported by the generators below |
| Market stalls and props | `tools/pixelgen/market.py` | `python3 tools/pixelgen/build.py market` |
| Medieval shop interior and room | `tools/pixelgen/interior.py` | `... build.py interior` |
| Gen-3 mart interior (reference) | `tools/pixelgen/interior_mart.py` | `... build.py interior_mart` |
| Monsters and slash effect | `tools/pixelgen/monsters.py` | `... build.py monsters` (installs to `game/world/assets/monsters/`) |
| Loot: gold coin and per-monster drops | `tools/pixelgen/loot.py` | `... build.py loot` (installs to `game/world/assets/loot/`) |
| Coastal port tileset, ships, lighthouse | `tools/pixelgen/coast.py` | `... build.py coast` (previews in `tools/pixelgen/out/coast/`) |
| 24x24 equipment icons (54 items) | `tools/pixelgen/items.py` | `... build.py items` (installs to `game/assets/items/`) |
| Farm-valley art for the fields (grass, sand, water, trees, cottages, fence) | `tools/pixelgen/valley.py` | `... build.py valley` (installs to `game/world/assets/valley/`) |
| Textures and billboards for the HD-2D city | `tools/pixelgen/city3d.py` | `... build.py city3d` (installs to `game/city3d/assets/`) |
| Build everything | `tools/pixelgen/build.py` | `python3 tools/pixelgen/build.py` |
| **3D scene library** | `game/lib/stylized3d.js` | `import { World, makeHero, ... } from '/game/lib/stylized3d.js'` |
| Offline dev server | `game-dev-server.js` | `node game-dev-server.js`, then open http://localhost:8137/game/ |

Generated PNGs land in `tools/pixelgen/out/` (gitignored). Only the installed copies under `game/` are committed.

### `game/lib/stylized3d.js` API

```js
import { THREE, World, makeHero, animateHero, makeGolem, Slashes } from '/game/lib/stylized3d.js';
const W = new World(scene);            // owns colliders, seeded rand, grass uniforms
W.ground(); W.road(x0, z0, x1, z1);    // cobble roads (one painted canvas texture, shared)
W.fence(x0, z0, x1, z1, [[gx, gz, r]]) // fence with gate gaps
W.barrel / crate / wheel / lampPost / hayCart / banner / tree / well / stall
W.house({ x, z, w, d, h, roof, facing, floors, sign, chimney })
W.grass({ x0, z0, x1, z1, count, avoid })   // instanced, wind + player push
W.solid(x, z, r)                       // collision query
const hero = makeHero(W); animateHero(hero, A, dt, t);   // A = { phase, move, atk, dir, block }
const golem = makeGolem(W); const fx = new Slashes(W); fx.spawn(x, z, heading, dir);
// each frame: W.uniforms.time.value = t; W.uniforms.player.value.set(x, 0, z);
```

---

## Playable pages (local: http://localhost:8137)

| Page | What it is |
|---|---|
| `/game/` | Accounts (custom auth), character creator, Home (the bag shows field loot), and an armory with real item icons |
| `/game/world/?area=woods` · `?area=docks` | West of the city: woods, then the docks |
| `/game/world/` | 2D Gen-3 fields: 12 monsters, Space or the button to attack, gold plus per-monster drops, walk-over pickup, a bag (B) |
| `/game/city/` | 2D city (another session added walls, gates and multiplayer presence) |
| `/game/city3d/` | **HD-2D** Three.js plaza: pixel-textured 3D houses, billboards, a voxel player (V toggles flat), Q/E rotate, P pixel mode |
| `/game/yard3d/` | **Stylized 3D** combat yard plus a slice of town: dense grass, a jointed hero, golems, slash VFX, damage numbers with combo totals, and an HP/Stamina/Block HUD |

---

## Recent exchange (summary)

1. **Pixel-art tool.** The user wanted something better than diffusion-style results. Claude built a Pillow generator and showed market sprites, then Gen-3 mart interiors, then a medieval shop ("more medieval"). The user asked to save the tool, so it was committed with a shared core.
2. **Monsters and combat in the fields.** Claude generated the sprites first, then added wandering and chasing AI, attacks, XP and fainting. Next came an Attack button, gold plus a signature drop per monster (bat → Bat Fang), pickup, and a bag that also shows on Home.
3. **Local test link.** The user tried port 3000 and couldn't reach it. The real dev server is `game-dev-server.js` on **8137**.
4. **More sprites.** Claude added a coast/port tileset with pirate ships, and redrew the equipment icons, which had all shown one generic slot emoji. That covered 40 existing items plus **14 new pirate-themed items**, two per slot, each drawn on the character too. Footwear now recolours the boots. The API now merges new catalog items into existing accounts.
5. **"See it in Three.js".** Claude built an HD-2D plaza (`/game/city3d`). The user asked for 3D player sprites, so the sprite was voxelised: cubes, deeper toward the middle so bodies come out round and swords stay thin, front and back colours, and it turns while walking.
6. **Reference image (stylized action RPG).** The user wanted a local copy that mimics it, with a more realistic side view of the character. Claude built `/game/yard3d`: lush instanced grass, a cobble road, fences and props, a jointed low-poly hero with walk, sprint, attack and block, orange training golems, crescent slashes, big damage numbers with a yellow TOTAL, and the HP/Stamina/Block panel. The user said "this looks pretty good".
7. **This session.** Claude added a slice of town around the yard (houses, corner tavern, well, market stalls, lamps, trees), moved every 3D builder into `game/lib/stylized3d.js` so future scenes can reuse it, and wrote this log.

8. **Stardew-style fields.** From a Stardew Valley reference, `valley.py` redraws the fields: seamless 64px grass with leaf tufts, warm sand paths with pebbles and hoe marks, bright water with glints, foam and sandy pond banks, fruit trees, layered pines, log fences, and shingle-roofed cottages. The fields load these PNGs under the old texture keys, so no game logic changed.

9. **Woods and docks (2026-10-30).** The fields page now serves several areas from an `AREAS` table (`/game/world/?area=woods`, `?area=docks`). Each area lists its paths, ponds, tall grass, objects, exits and arrival points. The map runs city west gate → woods (dense oak and pine forest, cabin, two ponds) → docks (beach, stone quay, two piers, pirate ship, tavern, lighthouse, crabs and gulls). Dock tiles from `coast.py` are painted into the ground; `valley.py` gained forest-floor and beach textures plus oak, fern, log and mushrooms.

### Decisions worth remembering
- 2D style is Gen-3 Pokémon with a medieval/pirate theme. Art must be original, never ripped tiles.
- For 3D, the user is weighing two looks: **HD-2D** (pixel textures in 3D) and **stylized low-poly** (the yard). The yard got the stronger reaction. The engine (Phaser vs Three.js vs Godot) is not decided yet.
- Field loot, XP and gold are stored only in localStorage (`taproot_field`). There's no server sync yet.
- zk/onchain is tabled. If it comes back: write game actions as pure deterministic functions plus signed action logs.

### Commits from this run
`7a5ab08` pixelgen tool · `91a098a` monsters, loot, icons, pirate gear, port tileset · `54b5f79` HD-2D city · `d650e58` voxel player · `4645fcb` stylized yard · *(this session)* town slice plus `stylized3d.js` library plus this devlog.

---

## Known gaps and good next steps
- The yard has only been driven by stepped frames, never by live keyboard and mouse play. Tune speed, camera and enemy damage once the user has walked around.
- The 3D hero doesn't use the player's saved gear yet. `makeHero(world, look)` takes colours, so wire `taproot_character` equipment into it.
- Port the coast set into a playable map (2D or 3D), and turn the city3d/yard3d town into the full city layout.
- Field loot should eventually sync to the account server-side.
