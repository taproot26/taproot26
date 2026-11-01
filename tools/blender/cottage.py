"""Taproot town cottage, built in Blender for the Three.js world (style test).

Same footprint as the code-built cottage in game/world3d (5 x 4 tiles, 1 unit
= 1 tile, front facing the street), but with bevelled parts, individual roof
shingle rows, a timber frame, stone foundation, framed windows with flower
boxes, and painted detail plus ambient occlusion baked into one texture.

    blender -b -P tools/blender/cottage.py -- game/assets3d/cottage.glb

Pipeline: build parts with node materials -> apply bevels -> join -> smart UV
unwrap -> bake the diffuse colour and AO into images -> multiply them into one
texture -> one material -> glTF export (Y up, front = +Z in Three.js).
"""
import math
import random
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np

OUT = Path(sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "cottage.glb").resolve()
TEX = 1024
random.seed(7)

# footprint matches TOWN_BUILD.cottage(5, 4): W x D walls, H eave height
W, D, H = 4.3, 3.3, 2.3
FRONT = -D / 2  # Blender -Y becomes +Z (the street side) in glTF


def hexc(h, a=1.0):
    h = h.lstrip("#")
    return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)] + [a]


# ------------------------------------------------------------------ materials

MATS = {}


def material(name, color, kind="flat", color2=None, scale=4.0):
    """Node material: flat colour with soft noise, or brick / wood / plank patterns."""
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.9
    tc = nt.nodes.new("ShaderNodeTexCoord")
    if kind == "brick":
        b = nt.nodes.new("ShaderNodeTexBrick")
        b.inputs["Color1"].default_value = hexc(color)
        b.inputs["Color2"].default_value = hexc(color2 or color)
        b.inputs["Mortar"].default_value = hexc("#5e5a58")
        b.inputs["Scale"].default_value = scale
        b.inputs["Mortar Size"].default_value = 0.025
        b.inputs["Mortar Smooth"].default_value = 0.3
        b.inputs["Brick Width"].default_value = 0.5
        b.inputs["Row Height"].default_value = 0.25
        nt.links.new(tc.outputs["Object"], b.inputs["Vector"])
        nt.links.new(b.outputs["Color"], bsdf.inputs["Base Color"])
    else:
        ramp_src = nt.nodes.new("ShaderNodeTexWave" if kind in ("wood", "plank") else "ShaderNodeTexNoise")
        if kind in ("wood", "plank"):
            ramp_src.wave_type = "BANDS"
            ramp_src.bands_direction = "Z" if kind == "plank" else "X"
            ramp_src.inputs["Scale"].default_value = scale
            ramp_src.inputs["Distortion"].default_value = 6.0 if kind == "wood" else 1.5
        else:
            ramp_src.inputs["Scale"].default_value = scale
            ramp_src.inputs["Detail"].default_value = 3.0
        nt.links.new(tc.outputs["Object"], ramp_src.inputs["Vector"])
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        lo, hi = hexc(color), hexc(color)
        k = 0.82 if kind in ("wood", "plank") else 0.9
        ramp.color_ramp.elements[0].color = [c * k for c in lo[:3]] + [1]
        ramp.color_ramp.elements[1].color = [min(1, c * 1.06) for c in hi[:3]] + [1]
        nt.links.new(ramp_src.outputs["Fac"], ramp.inputs["Fac"])
        nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    MATS[name] = m
    return m


PLASTER = lambda: material("plaster", "#efe2c2", scale=9)
TIMBER = lambda: material("timber", "#6a4426", "wood", scale=3)
STONE = lambda: material("stone", "#a8a296", "brick", "#8e887c", scale=3.2)
ROOFS = [lambda i=i, c=c: material(f"tile{i}", c, scale=12) for i, c in enumerate(("#c4553a", "#b84a32", "#cc6040"))]
RIDGE = lambda: material("ridge", "#8a3a2a", scale=10)
DOOR = lambda: material("door", "#8a5230", "plank", scale=7)
GLASS = lambda: material("glass", "#7aaee0", scale=3)
GOLD = lambda: material("gold", "#e0b048")
BOX = lambda: material("flowerbox", "#7a4a28", "plank", scale=9)
LEAF = lambda: material("leaf", "#4f9a3a", scale=20)
FLOWER = [lambda i=i, c=c: material(f"flower{i}", c) for i, c in enumerate(("#ff7aa8", "#ffe066", "#ffffff", "#c08aff"))]
CAP = lambda: material("cap", "#5a5652", scale=8)


# ------------------------------------------------------------------ geometry helpers

PARTS = []


def box(size, loc, mat, bevel=0.025, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod = o.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = "ANGLE"
    o.data.materials.append(mat())
    PARTS.append(o)
    return o


def sphere(r, loc, mat, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=r, location=loc)
    o = bpy.context.object
    o.scale = scale
    o.data.materials.append(mat())
    PARTS.append(o)
    return o


def cylinder(r, depth, loc, mat, rot=(0, 0, 0), verts=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object
    mod = o.modifiers.new("bevel", "BEVEL")
    mod.width = min(r, depth) * 0.25
    mod.segments = 2
    mod.limit_method = "ANGLE"
    o.data.materials.append(mat())
    PARTS.append(o)
    return o


def prism(x0, x1, half, base, top, mat):
    """Attic: a triangular prism along X (ridge on top), the plaster behind the gables."""
    me = bpy.data.meshes.new("attic")
    bm = bmesh.new()
    vs = [bm.verts.new(v) for v in [(x0, -half, base), (x0, half, base), (x0, 0, top), (x1, -half, base), (x1, half, base), (x1, 0, top)]]
    for f in ([0, 1, 2], [5, 4, 3], [0, 3, 4, 1], [1, 4, 5, 2], [2, 5, 3, 0]):
        bm.faces.new([vs[i] for i in f])
    bm.normal_update()
    bm.to_mesh(me)
    o = bpy.data.objects.new("attic", me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(mat())
    PARTS.append(o)
    return o


# ------------------------------------------------------------------ the cottage

def build():
    # stone foundation and plaster walls
    box((W + 0.18, D + 0.18, 0.5), (0, 0, 0.25), STONE, 0.04)
    box((W, D, H - 0.5), (0, 0, 0.5 + (H - 0.5) / 2), PLASTER, 0.015)
    prism(-W / 2, W / 2, D / 2, H - 0.01, H + D / 2, PLASTER)

    # timber frame: corner posts, sill and eave beams, braces, gable beams
    for sx in (-1, 1):
        for sy in (-1, 1):
            box((0.16, 0.16, H - 0.45), (sx * W / 2, sy * D / 2, 0.5 + (H - 0.5) / 2), TIMBER, 0.02)
    for sy in (-1, 1):
        for z in (0.56, H):
            box((W + 0.06, 0.12, 0.13), (0, sy * (D / 2 + 0.01), z), TIMBER, 0.02)
    for sx in (-1, 1):
        box((0.11, 0.06, 1.6), (sx * W * 0.31, FRONT - 0.02, 1.45), TIMBER, 0.015, rot=(0, sx * 0.55, 0))
        for z in (0.56, H):
            box((0.12, D + 0.06, 0.13), (sx * (W / 2 + 0.01), 0, z), TIMBER, 0.02)
        for sy in (-1, 1):  # gable edge beams following the roof pitch
            box((0.1, 0.1, D / 2 * math.sqrt(2) + 0.1), (sx * (W / 2 + 0.03), sy * D / 4, H + D / 4), TIMBER, 0.015, rot=(sy * math.pi / 4, 0, 0))
        box((0.1, 0.1, D / 2), (sx * (W / 2 + 0.03), 0, H + D / 4 - 0.05), TIMBER, 0.015)

    # roof: overlapping shingle rows on both slopes, eaves overhanging, a rounded ridge
    run = D / 2 + 0.4
    L = run * math.sqrt(2)
    rows = 13
    for sy in (-1, 1):
        for i in range(rows):
            t = (i + 0.5) / rows
            dist = t * L  # down the slope from the ridge
            y = sy * dist / math.sqrt(2)
            z = H + D / 2 + 0.06 - dist / math.sqrt(2)
            row_len = W + 0.6
            segs = 8
            for k in range(segs):  # each row in a few tiles so edges stagger
                seg = row_len / segs
                x = -row_len / 2 + seg * (k + 0.5) + (0.12 if i % 2 else -0.12)
                if abs(x) + seg / 2 > row_len / 2 + 0.15:
                    continue
                tilt = sy * (math.pi / 4 + 0.035)  # each row sits a little steeper, so the lower edge lifts
                box((seg * 0.97, L / rows + 0.08, 0.045), (x, y, z), random.choice(ROOFS), 0.012,
                    rot=(tilt + random.uniform(-0.01, 0.01), random.uniform(-0.01, 0.01), random.uniform(-0.012, 0.012)))
    cylinder(0.11, W + 0.66, (0, 0, H + D / 2 + 0.1), RIDGE, rot=(0, math.pi / 2, 0), verts=10)

    # chimney on the back slope
    box((0.48, 0.48, 1.5), (W / 4, D / 6, H + D / 2 - 0.1), STONE, 0.03)
    box((0.6, 0.6, 0.12), (W / 4, D / 6, H + D / 2 + 0.68), CAP, 0.02)

    # door: frame, planked door, iron knob, stone step
    box((1.0, 0.1, 1.6), (0, FRONT - 0.02, 0.95), TIMBER, 0.02)
    box((0.78, 0.07, 1.42), (0, FRONT - 0.06, 0.93), DOOR, 0.015)
    sphere(0.045, (0.25, FRONT - 0.12, 0.9), GOLD)
    box((1.25, 0.5, 0.14), (0, FRONT - 0.3, 0.07), STONE, 0.03)

    # windows: frame, glass, cross, sill and a flower box spilling over
    def window(cx, cz, face_y, side=False):
        n = -1 if face_y < 0 else 1
        if side:  # windows on the gable walls face +-X
            box((0.08, 0.78, 0.78), (cx, 0, cz), TIMBER, 0.015)
            box((0.06, 0.58, 0.58), (cx + n * 0.03, 0, cz), GLASS, 0.0)
            box((0.05, 0.05, 0.6), (cx + n * 0.06, 0, cz), TIMBER, 0.01)
            box((0.05, 0.6, 0.05), (cx + n * 0.06, 0, cz), TIMBER, 0.01)
            return
        box((0.8, 0.08, 0.8), (cx, face_y, cz), TIMBER, 0.015)
        box((0.6, 0.06, 0.6), (cx, face_y + n * 0.03, cz), GLASS, 0.0)
        box((0.05, 0.05, 0.6), (cx, face_y + n * 0.06, cz), TIMBER, 0.01)
        box((0.6, 0.05, 0.05), (cx, face_y + n * 0.06, cz), TIMBER, 0.01)
        box((0.86, 0.16, 0.06), (cx, face_y + n * 0.08, cz - 0.42), TIMBER, 0.015)
        box((0.78, 0.22, 0.18), (cx, face_y + n * 0.16, cz - 0.55), BOX, 0.02)
        for j in range(9):
            fx = cx - 0.33 + j * 0.083
            sphere(0.07, (fx, face_y + n * 0.17, cz - 0.42 + random.uniform(-0.02, 0.03)), LEAF, (1, 1, 0.8))
            if j % 2 == 0:
                sphere(0.045, (fx + random.uniform(-0.02, 0.02), face_y + n * (0.22 + random.uniform(0, 0.05)), cz - 0.36 + random.uniform(0, 0.05)),
                       random.choice(FLOWER))

    for sx in (-1, 1):
        window(sx * W / 3, 1.6, FRONT - 0.01)
        window(sx * (W / 2 + 0.01), 1.6, 0, side=True)
    window(-W / 4, 1.6, -FRONT + 0.01)


# ------------------------------------------------------------------ bake + export

def finish():
    bpy.ops.object.select_all(action="DESELECT")
    for o in PARTS:
        o.select_set(True)
    bpy.context.view_layer.objects.active = PARTS[0]
    bpy.ops.object.convert(target="MESH")  # applies the bevels
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = "cottage"
    bpy.ops.object.shade_auto_smooth(angle=math.radians(40))

    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.004)
    bpy.ops.object.mode_set(mode="OBJECT")

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 48
    scene.render.bake.margin = 6

    def target(name):
        img = bpy.data.images.new(name, TEX, TEX, alpha=False)
        for m in obj.data.materials:
            n = m.node_tree.nodes.new("ShaderNodeTexImage")
            n.image = img
            m.node_tree.nodes.active = n
        return img

    color = target("color")
    bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"})
    ao = target("ao")
    bpy.ops.object.bake(type="AO")

    c = np.array(color.pixels[:]).reshape(-1, 4)
    a = np.array(ao.pixels[:]).reshape(-1, 4)[:, :1]
    out = c.copy()
    out[:, :3] = c[:, :3] * (0.42 + 0.58 * a)  # soft contact shadows, never fully black
    final = bpy.data.images.new("cottage_tex", TEX, TEX, alpha=False)
    final.pixels = out.ravel().tolist()
    final.file_format = "PNG"
    tex_path = OUT.with_suffix(".png")
    final.filepath_raw = str(tex_path)
    final.save()

    m = bpy.data.materials.new("cottage")
    m.use_nodes = True
    n = m.node_tree.nodes.new("ShaderNodeTexImage")
    n.image = final
    m.node_tree.links.new(n.outputs["Color"], m.node_tree.nodes["Principled BSDF"].inputs["Base Color"])
    m.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 1.0
    obj.data.materials.clear()
    obj.data.materials.append(m)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(OUT), export_format="GLB", use_selection=True, export_yup=True, export_apply=True)
    tex_path.unlink(missing_ok=True)  # the texture is embedded in the .glb
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB, {len(obj.data.polygons)} faces)")


bpy.ops.wm.read_factory_settings(use_empty=True)
build()
finish()
