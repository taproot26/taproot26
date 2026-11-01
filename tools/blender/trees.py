"""Taproot trees, built in Blender for the Three.js world (style test).

Three kinds at the same sizes as the code-built trees in game/world3d (2 x 2
tile footprint, origin at the base of the trunk):

  tree_round  broad-leaf tree: lumpy canopy of leaf clumps, tapered trunk, roots
  tree_oak    bigger, darker, wider oak with a few branches showing
  tree_pine   stacked, ragged cone tiers

Colour is baked into the vertices (no textures): a dark-to-light gradient up
the canopy, bark grain, and ambient occlusion so the inside and underside of
the canopy fall into shade. The game instances each model hundreds of times.

    blender -b -P tools/blender/trees.py -- game/assets3d
"""
import math
import random
import sys
from pathlib import Path

import bpy
import numpy as np

OUT_DIR = Path(sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else ".").resolve()


def hexc(h, a=1.0):
    """#rrggbb (sRGB, as on screen) -> linear RGBA, which is what Blender's colour inputs expect."""
    h = h.lstrip("#")
    lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return [lin(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4)] + [a]


def material(name, dark, light, kind):
    """Leaves: colour ramp by height + noise. Bark: wave bands."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = hexc(dark)
    ramp.color_ramp.elements[1].color = hexc(light)
    if kind == "bark":
        w = nt.nodes.new("ShaderNodeTexWave")
        w.wave_type = "BANDS"
        w.bands_direction = "Z"
        w.inputs["Scale"].default_value = 3.0
        w.inputs["Distortion"].default_value = 8.0
        nt.links.new(tc.outputs["Object"], w.inputs["Vector"])
        nt.links.new(w.outputs["Fac"], ramp.inputs["Fac"])
    else:
        # height in the object (0 at the canopy bottom .. 1 at the top) plus a little noise
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(tc.outputs["Object"], sep.inputs["Vector"])
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.inputs["From Min"].default_value = kind[0]
        mr.inputs["From Max"].default_value = kind[1]
        nt.links.new(sep.outputs["Z"], mr.inputs["Value"])
        noise = nt.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 3.5
        nt.links.new(tc.outputs["Object"], noise.inputs["Vector"])
        add = nt.nodes.new("ShaderNodeMath")
        add.operation = "MULTIPLY_ADD"
        add.inputs[1].default_value = 0.35
        nt.links.new(noise.outputs["Fac"], add.inputs[0])
        nt.links.new(mr.outputs["Result"], add.inputs[2])
        nt.links.new(add.outputs["Value"], ramp.inputs["Fac"])
        ramp.color_ramp.elements[0].position = 0.15
        ramp.color_ramp.elements[1].position = 1.0
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 1.0
    return m


PARTS = []


def add(o, mat):
    o.data.materials.append(mat)
    PARTS.append(o)
    return o


def trunk(h, r0, r1, mat, lean=0.0):
    bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=r0, radius2=r1, depth=h, location=(0, 0, h / 2))
    o = bpy.context.object
    o.rotation_euler = (lean, 0, 0)
    add(o, mat)
    for i in range(4):  # root flares
        a = i * math.pi / 2 + 0.4
        bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=r0 * 0.55, radius2=0.01, depth=r0 * 2.6,
                                        location=(math.cos(a) * r0 * 0.9, math.sin(a) * r0 * 0.9, r0 * 0.35),
                                        rotation=(0, math.radians(72), a))
        add(bpy.context.object, mat)


def branch(start, end, r, mat):
    sx, sy, sz = start
    ex, ey, ez = end
    dx, dy, dz = ex - sx, ey - sy, ez - sz
    L = math.sqrt(dx * dx + dy * dy + dz * dz)
    bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=r, radius2=r * 0.45, depth=L, location=((sx + ex) / 2, (sy + ey) / 2, (sz + ez) / 2))
    o = bpy.context.object
    o.rotation_euler = (0, math.acos(dz / L), math.atan2(dy, dx))
    add(o, mat)


def clump(loc, r, mat, squash=0.85, seed=0):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=r, location=loc)
    o = bpy.context.object
    o.scale = (1, 1, squash)
    tex = bpy.data.textures.new(f"vor{seed}", "VORONOI")
    tex.noise_scale = r * 0.55
    d = o.modifiers.new("lumps", "DISPLACE")
    d.texture = tex
    d.strength = r * 0.28
    d.mid_level = 0.6
    d.texture_coords = "OBJECT"
    add(o, mat)


def tier(z, r, h, mat, seed):
    """One ragged pine tier: a cone whose rim is pushed in and out."""
    bpy.ops.mesh.primitive_cone_add(vertices=14, radius1=r, radius2=0.02, depth=h, location=(0, 0, z + h / 2))
    o = bpy.context.object
    me = o.data
    rnd = random.Random(seed)
    for v in me.vertices:
        if v.co.z < -h / 2 + 0.01 and math.hypot(v.co.x, v.co.y) > r * 0.5:
            k = 1.0 + rnd.uniform(-0.12, 0.18)
            v.co.x *= k
            v.co.y *= k
            v.co.z -= rnd.uniform(0.0, 0.18) * r
    sub = o.modifiers.new("sub", "SUBSURF")
    sub.levels = 1
    add(o, mat)


# ------------------------------------------------------------------ the three kinds

def tree_round():
    bark = material("bark_r", "#5a301c", "#9a5a34", "bark")
    leaf = material("leaf_r", "#1f8a26", "#a8ec5a", (1.7, 4.2))
    trunk(2.2, 0.28, 0.16, bark)
    branch((0, 0, 1.6), (0.55, 0.2, 2.5), 0.08, bark)
    branch((0, 0, 1.8), (-0.5, -0.3, 2.6), 0.07, bark)
    for i, (x, y, z, r) in enumerate([(0, 0, 2.85, 1.15), (0.6, 0.25, 3.25, 0.8), (-0.65, -0.2, 2.6, 0.85), (0.2, 0.75, 2.45, 0.75),
                                      (-0.15, -0.7, 2.7, 0.7), (0.1, 0.1, 3.6, 0.7)]):
        clump((x, y, z), r, leaf, seed=i)


def tree_oak():
    bark = material("bark_o", "#4a2616", "#8a4e2c", "bark")
    leaf = material("leaf_o", "#17742a", "#7cd44a", (1.8, 4.6))
    trunk(2.4, 0.38, 0.22, bark)
    branch((0, 0, 1.7), (0.9, 0.1, 2.7), 0.11, bark)
    branch((0, 0, 1.9), (-0.85, 0.3, 2.8), 0.1, bark)
    branch((0, 0, 2.1), (0.1, -0.8, 2.9), 0.09, bark)
    for i, (x, y, z, r) in enumerate([(0, 0, 3.1, 1.35), (0.95, 0.1, 3.0, 0.95), (-0.95, 0.3, 2.95, 1.0), (0.2, -0.9, 2.85, 0.9),
                                      (-0.2, 0.85, 3.0, 0.9), (0.3, 0.2, 3.85, 0.85), (-0.5, -0.4, 3.6, 0.7)]):
        clump((x, y, z), r, leaf, squash=0.8, seed=10 + i)


def tree_pine():
    bark = material("bark_p", "#5a2e1a", "#8a4a2a", "bark")
    leaf = material("leaf_p", "#0f6e3e", "#46d27a", (0.6, 4.6))
    trunk(1.3, 0.22, 0.14, bark)
    for i, (z, r, h) in enumerate([(0.75, 1.35, 1.7), (1.55, 1.1, 1.5), (2.3, 0.85, 1.35), (3.0, 0.6, 1.2), (3.6, 0.36, 0.95)]):
        tier(z, r, h, leaf, seed=20 + i)


# ------------------------------------------------------------------ bake + export

def finish(name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in PARTS:
        o.select_set(True)
    bpy.context.view_layer.objects.active = PARTS[0]
    bpy.ops.object.convert(target="MESH")
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    bpy.ops.object.shade_smooth()

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 64
    scene.render.bake.target = "VERTEX_COLORS"

    def bake(kind, attr, **kw):
        a = obj.data.color_attributes.new(attr, "FLOAT_COLOR", "CORNER")
        obj.data.color_attributes.active_color = a
        bpy.ops.object.bake(type=kind, **kw)
        return np.array([c.color[:] for c in obj.data.color_attributes[attr].data])

    diff = bake("DIFFUSE", "diff", pass_filter={"COLOR"})
    ao = bake("AO", "ao")[:, :1]
    col = diff.copy()
    col[:, :3] = diff[:, :3] * (0.5 + 0.5 * ao)
    out = obj.data.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    for i, c in enumerate(out.data):
        c.color = col[i].tolist()
    for n in ("diff", "ao"):
        obj.data.color_attributes.remove(obj.data.color_attributes[n])
    obj.data.color_attributes.active_color = obj.data.color_attributes["Col"]
    obj.data.color_attributes.render_color_index = 0

    m = bpy.data.materials.new(name + "_mat")
    obj.data.materials.clear()
    obj.data.materials.append(m)
    path = OUT_DIR / f"{name}.glb"
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", use_selection=True, export_yup=True,
                              export_apply=True, export_vertex_color="ACTIVE", export_normals=True)
    print(f"wrote {path} ({path.stat().st_size // 1024} KB, {len(obj.data.polygons)} faces)")


for name, fn in (("tree_round", tree_round), ("tree_oak", tree_oak), ("tree_pine", tree_pine)):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    PARTS.clear()
    random.seed(name)
    fn()
    finish(name)
