"""Taproot hero pieces and weapons, built in Blender (style test).

One file, game/assets3d/hero_parts.glb, with these named meshes:

  torso, pelvis, boot, hand   body pieces for game/lib/hero3d.js. Their vertex
                              colours hold only shading (baked ambient occlusion
                              plus painted darks like the boot sole), so each
                              player's own outfit and skin colours still apply:
                              the game multiplies its material colour by them.
  iron_sword, inferno_staff   full-colour weapons (orb glow stays in the game).

Sizes match the code-built pieces they replace; origins are the joints the game
attaches them to. Blender is Z up with the front at -Y (glTF turns that into
Y up, front +Z).

    blender -b -P tools/blender/hero.py -- game/assets3d/hero_parts.glb
"""
import math
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Vector

OUT = Path(sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "hero_parts.glb").resolve()


def hexc(h, a=1.0):
    """#rrggbb (sRGB, as on screen) -> linear RGBA, which is what Blender's colour inputs expect."""
    h = h.lstrip("#")
    lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return [lin(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4)] + [a]


def flat_mat(name, color):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = hexc(color)
    m.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 1.0
    return m


def obj_from_bm(name, bm):
    me = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    return o


def revolve(name, profile, seg=32, sx=1.0, sy=1.0, cap_top=True, cap_bottom=True):
    """Surface of revolution around Z from (radius, z) pairs, squashed to an ellipse (sx, sy)."""
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        ring = []
        for i in range(seg):
            a = 2 * math.pi * i / seg
            ring.append(bm.verts.new((math.cos(a) * r * sx, math.sin(a) * r * sy, z)))
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        for i in range(seg):
            j = (i + 1) % seg
            bm.faces.new((a[i], a[j], b[j], b[i]))
    if cap_bottom:
        bm.faces.new(list(reversed(rings[0])))
    if cap_top:
        bm.faces.new(rings[-1])
    return obj_from_bm(name, bm)


def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.convert(target="MESH")
    bpy.ops.object.join()
    o = bpy.context.object
    o.name = name
    o.data.name = name
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    # hand-built pieces can come out inside-out, which the game's outline shell would then cover: point every face outward
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.shade_auto_smooth(angle=math.radians(45))
    return o


def prim(kind, mat=None, **kw):
    getattr(bpy.ops.mesh, f"primitive_{kind}_add")(**kw)
    o = bpy.context.object
    if mat:
        o.data.materials.append(mat)
    return o


def bevel(o, w, seg=2):
    m = o.modifiers.new("bevel", "BEVEL")
    m.width = w
    m.segments = seg
    m.limit_method = "ANGLE"
    return o


def subdivide(o, levels=1):
    m = o.modifiers.new("sub", "SUBSURF")
    m.levels = levels
    m.render_levels = levels
    return o


def bake_colors(o, mode, mask=None):
    """mode 'shade': vertex colour = AO (+ mask darks), grey. mode 'color': diffuse colour x AO."""
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 64
    scene.render.bake.target = "VERTEX_COLORS"
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    if not o.data.materials:
        o.data.materials.append(flat_mat(o.name + "_white", "#ffffff"))

    def bake(kind, attr, **kw):
        a = o.data.color_attributes.new(attr, "FLOAT_COLOR", "CORNER")
        o.data.color_attributes.active_color = a
        bpy.ops.object.bake(type=kind, **kw)
        return np.array([c.color[:] for c in o.data.color_attributes[attr].data])

    ao = bake("AO", "ao")[:, :1]
    if mode == "color":
        diff = bake("DIFFUSE", "diff", pass_filter={"COLOR"})
        col = diff.copy()
        col[:, :3] = diff[:, :3] * (0.5 + 0.5 * ao)
    else:
        shade = 0.55 + 0.45 * ao
        if mask is not None:  # per-corner extra darkening (soles, seams)
            shade = shade * mask[:, None]
        col = np.concatenate([np.repeat(shade, 3, axis=1), np.ones((len(shade), 1))], axis=1)
    out = o.data.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    for i, c in enumerate(out.data):
        c.color = col[i].tolist()
    for n in ("ao", "diff"):
        if n in o.data.color_attributes:
            o.data.color_attributes.remove(o.data.color_attributes[n])
    o.data.color_attributes.active_color = o.data.color_attributes["Col"]
    o.data.color_attributes.render_color_index = o.data.color_attributes.active_color_index
    o.data.materials.clear()
    o.data.materials.append(flat_mat(o.name + "_m", "#ffffff"))
    o.hide_render = True  # every piece is built at the origin: keep finished ones out of the next bake


def corner_mask(o, fn):
    """Evaluate fn(vertex position) per face corner -> array of multipliers."""
    me = o.data
    return np.array([fn(me.vertices[l.vertex_index].co) for l in me.loops])


# ------------------------------------------------------------------ body pieces

def torso():
    # same silhouette as the game's lathe torso, plus a hem, a collar and a chest (round here: the game squashes depth to 0.8)
    prof = [(0.0, -0.035), (0.142, -0.035), (0.146, -0.012), (0.138, 0.0), (0.146, 0.05), (0.158, 0.1), (0.166, 0.15), (0.165, 0.19),
            (0.152, 0.225), (0.115, 0.255), (0.07, 0.268), (0.0, 0.27)]
    body = revolve("torso_body", prof, seg=36)
    subdivide(body)
    collar = prim("torus", major_radius=0.066, minor_radius=0.017, major_segments=28, minor_segments=8, location=(0, 0, 0.262))
    collar.scale = (1, 1, 0.9)
    chest = prim("uv_sphere", segments=20, ring_count=12, radius=0.07, location=(0, -0.118, 0.165))
    chest.scale = (1.6, 0.55, 0.85)
    o = join([body, collar, chest], "torso")
    # a soft crease where the hem folds and a darker line down the front placket
    mask = corner_mask(o, lambda v: (0.78 if -0.01 < v.z < 0.005 else 1.0) * (0.86 if abs(v.x) < 0.008 and v.y < -0.11 and 0.03 < v.z < 0.24 else 1.0))
    bake_colors(o, "shade", mask)
    return o


def pelvis():
    prof = [(0.0, -0.065), (0.11, -0.065), (0.13, -0.05), (0.138, 0.0), (0.142, 0.04), (0.146, 0.05), (0.146, 0.065), (0.0, 0.065)]
    o = revolve("pelvis", prof, seg=32, sx=1.0, sy=0.7)
    subdivide(o)
    o = join([o], "pelvis")
    mask = corner_mask(o, lambda v: 0.8 if 0.035 < v.z < 0.048 else 1.0)  # waistband seam
    bake_colors(o, "shade", mask)
    return o


def boot():
    # foot pointing -Y (front), ankle joint at the origin like the game's ankle group
    shaft = revolve("shaft", [(0.0, -0.06), (0.05, -0.06), (0.054, -0.02), (0.052, 0.02), (0.056, 0.035), (0.0, 0.035)], seg=20, sy=0.95)
    foot = prim("uv_sphere", segments=24, ring_count=14, radius=0.06, location=(0, -0.04, -0.045))
    foot.scale = (0.95, 1.65, 0.75)
    toe = prim("uv_sphere", segments=20, ring_count=12, radius=0.05, location=(0, -0.105, -0.055))
    toe.scale = (1.05, 1.0, 0.75)
    heel = bevel(prim("cube", size=1, location=(0, 0.03, -0.075)), 0.008)
    heel.scale = (0.1, 0.06, 0.03)
    sole = bevel(prim("cube", size=1, location=(0, -0.035, -0.088)), 0.01, 3)
    sole.scale = (0.118, 0.205, 0.022)
    cuff = prim("torus", major_radius=0.054, minor_radius=0.011, major_segments=24, minor_segments=6, location=(0, 0, 0.033))
    o = join([shaft, foot, toe, heel, sole, cuff], "boot")
    mask = corner_mask(o, lambda v: 0.42 if v.z < -0.077 else 0.72 if (v.z > 0.024 and math.hypot(v.x, v.y) > 0.05) else 1.0)
    bake_colors(o, "shade", mask)
    return o


def hand():
    # a mitten fist around the grip: palm, knuckle bumps, a thumb; wrist joint at the origin
    palm = prim("uv_sphere", segments=20, ring_count=14, radius=0.05, location=(0, 0, -0.02))
    palm.scale = (1.0, 0.95, 1.12)
    parts = [palm]
    for i, x in enumerate((-0.03, -0.01, 0.01, 0.03)):
        k = prim("uv_sphere", segments=10, ring_count=8, radius=0.017, location=(x, -0.035, -0.045 + abs(x) * 0.25))
        parts.append(k)
    thumb = prim("uv_sphere", segments=12, ring_count=8, radius=0.022, location=(0.035, -0.02, -0.005))
    thumb.scale = (0.9, 1.3, 0.9)
    parts.append(thumb)
    o = join(parts, "hand")
    bake_colors(o, "shade")
    return o


# ------------------------------------------------------------------ weapons (grip at the origin, blade / shaft up +Z)

def iron_sword():
    steel, steel_dk, gold, leather = flat_mat("steel", "#eef2f8"), flat_mat("steel_dk", "#b4bccb"), flat_mat("gold", "#d9a83a"), flat_mat("leather", "#5a3a22")
    parts = []
    grip = prim("cylinder", leather, vertices=12, radius=0.019, depth=0.13, location=(0, 0, 0))
    parts.append(grip)
    for i in range(6):  # leather wrap ridges
        parts.append(prim("torus", leather, major_radius=0.019, minor_radius=0.004, major_segments=12, minor_segments=4,
                          location=(0, 0, -0.05 + i * 0.02), rotation=(0.25, 0, 0)))
    parts.append(prim("uv_sphere", gold, segments=14, ring_count=10, radius=0.027, location=(0, 0, -0.08)))
    parts.append(prim("torus", gold, major_radius=0.02, minor_radius=0.006, major_segments=14, minor_segments=5, location=(0, 0, -0.08), rotation=(math.pi / 2, 0, 0)))
    guard = bevel(prim("cube", gold, size=1, location=(0, 0, 0.072)), 0.008)
    guard.scale = (0.15, 0.04, 0.026)
    parts.append(guard)
    for s in (-1, 1):  # curled guard tips
        parts.append(prim("uv_sphere", gold, segments=10, ring_count=8, radius=0.017, location=(s * 0.083, 0, 0.082)))
    parts.append(prim("uv_sphere", steel_dk, segments=10, ring_count=8, radius=0.014, location=(0, -0.02, 0.072)))  # guard gem / rivet
    # blade: a flat hexagonal cross-section (broad faces catch the light, bevelled edges) tapering to a point
    bm = bmesh.new()
    L, w0, t0 = 0.5, 0.031, 0.009
    rings = []
    steps = 10
    for i in range(steps + 1):
        z = 0.085 + L * i / steps
        k = 1.0 if i < steps - 2 else (steps - i) / 2.0
        w, t = w0 * (1 - 0.18 * i / steps) * k + 0.0015, t0 * (1 - 0.3 * i / steps) * k + 0.001
        rings.append([bm.verts.new(p) for p in ((w, 0, z), (w * 0.72, -t, z), (-w * 0.72, -t, z), (-w, 0, z), (-w * 0.72, t, z), (w * 0.72, t, z))])
    tip = bm.verts.new((0, 0, 0.085 + L + 0.045))
    for a, b in zip(rings, rings[1:]):
        for j in range(6):
            bm.faces.new((a[j], a[(j + 1) % 6], b[(j + 1) % 6], b[j]))
    for j in range(6):
        bm.faces.new((rings[-1][j], rings[-1][(j + 1) % 6], tip))
    bm.faces.new(list(reversed(rings[0])))
    blade = obj_from_bm("blade", bm)
    blade.data.materials.append(steel)
    parts.append(blade)
    fuller = bevel(prim("cube", steel_dk, size=1, location=(0, 0, 0.085 + L * 0.42)), 0.002)
    fuller.scale = (0.008, 0.0195, L * 0.7)
    parts.append(fuller)
    o = join(parts, "iron_sword")
    bake_colors(o, "color")
    return o


def inferno_staff():
    wood, gold, ember = flat_mat("darkwood", "#3a1a14"), flat_mat("gold", "#d9a83a"), flat_mat("ember", "#7a2410")
    parts = []
    # a twisted shaft: a cylinder with its rings rotated and wobbled up the length
    shaft = revolve("shaft", [(0.024, -0.325 + 1.05 * i / 26) for i in range(27)], seg=8)
    shaft.data.materials.append(wood)
    for v in shaft.data.vertices:
        t = (v.co.z + 0.325) / 1.05
        a = t * math.pi * 5
        r = 0.022 + 0.006 * (1 - t) + 0.003 * math.sin(math.atan2(v.co.y, v.co.x) * 2 + a)
        ang = math.atan2(v.co.y, v.co.x) + a * 0.15
        v.co.x, v.co.y = math.cos(ang) * r, math.sin(ang) * r
    parts.append(shaft)
    for z in (-0.25, 0.1, 0.55, 0.7):  # gold bands
        parts.append(prim("torus", gold, major_radius=0.026, minor_radius=0.007, major_segments=16, minor_segments=6, location=(0, 0, z)))
    parts.append(prim("uv_sphere", gold, segments=12, ring_count=8, radius=0.03, location=(0, 0, -0.33)))  # butt cap
    # claw head: four curved prongs holding the orb at z 0.83
    for i in range(4):
        a = i * math.pi / 2 + math.pi / 4
        pts = [(math.cos(a) * r, math.sin(a) * r, z) for r, z in ((0.025, 0.72), (0.07, 0.77), (0.085, 0.84), (0.05, 0.91), (0.02, 0.94))]
        curve = bpy.data.curves.new(f"prong{i}", "CURVE")
        curve.dimensions = "3D"
        curve.bevel_depth = 0.011
        curve.bevel_resolution = 2
        sp = curve.splines.new("NURBS")
        sp.points.add(len(pts) - 1)
        for p, (x, y, z) in zip(sp.points, pts):
            p.co = (x, y, z, 1)
        sp.use_endpoint_u = True
        sp.order_u = 3
        co = bpy.data.objects.new(f"prong{i}", curve)
        bpy.context.collection.objects.link(co)
        co.data.materials.append(gold)
        parts.append(co)
    parts.append(prim("cone", ember, vertices=12, radius1=0.045, radius2=0.02, depth=0.05, location=(0, 0, 0.745)))  # orb cradle
    o = join(parts, "inferno_staff")
    bake_colors(o, "color")
    return o


bpy.ops.wm.read_factory_settings(use_empty=True)
made = [torso(), pelvis(), boot(), hand(), iron_sword(), inferno_staff()]
bpy.ops.object.select_all(action="DESELECT")
for o in made:
    o.hide_render = False
    o.select_set(True)
OUT.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(OUT), export_format="GLB", use_selection=True, export_yup=True,
                          export_apply=True, export_vertex_color="ACTIVE", export_normals=True)
print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB): " + ", ".join(f"{o.name} {len(o.data.polygons)}f" for o in made))
