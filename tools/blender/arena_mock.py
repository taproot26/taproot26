"""PvP arena concept mockup (Blender, rendered stills only; not a game asset yet).

A round sand pit (radius 14 tiles) ringed by a stone wall and three tiers of
stands, four broken columns for cover, eight braziers, red and blue banners,
four glowing spawn pads and a gated entrance on the south side. Two copies of
the rigged Blender hero fight in the middle (one slashing, one running) with a
fireball in flight.

    blender -b -P tools/blender/arena_mock.py -- <out_dir>

Writes arena_view.png (the in-game camera angle) and arena_plan.png (top-down layout).
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

OUT = Path(sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else ".").resolve()
HERO = Path(__file__).resolve().parents[2] / "game/assets3d/hero_blender.glb"
R = 14.0  # pit radius in tiles


def hexc(h, a=1.0):
    h = h.lstrip("#")
    lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return [lin(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4)] + [a]


MATS = {}


def mat(color, glow=0.0):
    key = (color, glow)
    if key not in MATS:
        m = bpy.data.materials.new(f"{color}{glow}")
        m.use_nodes = True
        b = m.node_tree.nodes["Principled BSDF"]
        b.inputs["Base Color"].default_value = hexc(color)
        b.inputs["Roughness"].default_value = 0.85
        if glow:
            b.inputs["Emission Color"].default_value = hexc(color)
            b.inputs["Emission Strength"].default_value = glow
        MATS[key] = m
    return MATS[key]


def box(size, loc, color, rot=(0, 0, 0), glow=0.0, bevel=0.04):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = size
    if bevel:
        m = o.modifiers.new("b", "BEVEL"); m.width = bevel; m.segments = 2
    o.data.materials.append(mat(color, glow))
    return o


def cyl(r, h, loc, color, verts=24, glow=0.0, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=loc)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=h, location=loc)
    o = bpy.context.object
    o.data.materials.append(mat(color, glow))
    return o


def ring_of(n, radius, fn, skip=None):
    for i in range(n):
        a = 2 * math.pi * i / n
        if skip and skip(a):
            continue
        fn(a, math.cos(a) * radius, math.sin(a) * radius)


def gate_gap(a, half=0.18):  # the entrance faces -Y (south, toward the camera)
    return abs(math.atan2(math.sin(a + math.pi / 2), math.cos(a + math.pi / 2))) < half


def build():
    # ground outside, the sand pit and a painted emblem
    cyl(R + 14, 0.2, (0, 0, -0.1), "#6a9a4a", verts=64)
    cyl(R, 0.06, (0, 0, 0.03), "#e2c48a", verts=96)
    for rr, c in ((3.2, "#c8a66c"), (2.9, "#e2c48a"), (1.2, "#b8452e"), (0.95, "#e2c48a")):
        cyl(rr, 0.065, (0, 0, 0.035 + rr * 0.0005), c, verts=64)
    # pit wall: stone blocks with a gap for the gate
    ring_of(64, R + 0.4, lambda a, x, y: box((1.45, 0.8, 2.4), (x, y, 1.2), "#9a948a" if int(a * 10) % 2 else "#8a847a", rot=(0, 0, a + math.pi / 2)), skip=gate_gap)
    ring_of(64, R + 0.4, lambda a, x, y: box((1.5, 0.95, 0.25), (x, y, 2.5), "#b8b2a6", rot=(0, 0, a + math.pi / 2)), skip=gate_gap)
    # three tiers of stands rising outward, with red/blue seat cushions here and there
    for t in range(3):
        rad, z = R + 1.6 + t * 1.6, 2.6 + t * 1.2
        ring_of(72, rad, lambda a, x, y, z=z: box((1.4, 1.6, 0.5), (x, y, z), "#a8a296", rot=(0, 0, a + math.pi / 2)), skip=lambda a: gate_gap(a, 0.22))
        ring_of(72, rad, lambda a, x, y, z=z, t=t: box((1.2, 0.5, 2.6 + t * 1.2), (x * (rad + 0.7) / rad, y * (rad + 0.7) / rad, (2.6 + t * 1.2) / 2), "#7e786e", rot=(0, 0, a + math.pi / 2), bevel=0), skip=lambda a: gate_gap(a, 0.22))
    # gate: two towers, an arch and a raised portcullis
    for s in (-1, 1):
        box((1.6, 1.6, 6.2), (s * 2.6, -(R + 0.6), 3.1), "#8a847a")
        cyl(1.0, 0.8, (s * 2.6, -(R + 0.6), 6.6), "#6a4a8a", verts=4, r2=0.0)
    box((6.8, 1.4, 1.2), (0, -(R + 0.6), 5.0), "#9a948a")
    for i in range(7):
        box((0.12, 0.2, 1.4), (-1.8 + i * 0.6, -(R + 0.5), 4.0), "#3a3640", bevel=0)
    box((4.2, 0.2, 0.12), (0, -(R + 0.5), 3.4), "#3a3640", bevel=0)
    # broken columns for cover
    for a in (math.pi / 4, 3 * math.pi / 4, 5 * math.pi / 4, 7 * math.pi / 4):
        x, y = math.cos(a) * 6.5, math.sin(a) * 6.5
        h = 1.6 + (a % 1.0) * 1.2
        cyl(0.9, 0.35, (x, y, 0.2), "#a8a296", verts=10)
        cyl(0.6, h, (x, y, 0.35 + h / 2), "#c0bab0", verts=12)
        box((0.7, 0.5, 0.4), (x + 0.9, y - 0.3, 0.2), "#a8a296", rot=(0.3, 0.2, a))
    # braziers with fire, and banners between them
    def brazier(a, x, y):
        x, y = x * (R - 0.6) / R, y * (R - 0.6) / R
        cyl(0.12, 1.4, (x, y, 0.7), "#3a3640", verts=8)
        cyl(0.42, 0.3, (x, y, 1.5), "#3a3640", verts=12, r2=0.3)
        cyl(0.32, 0.7, (x, y, 1.95), "#ff8a2a", verts=8, r2=0.0, glow=8)
        bpy.ops.object.light_add(type="POINT", location=(x, y, 2.2))
        bpy.context.object.data.energy = 120
        bpy.context.object.data.color = (1.0, 0.6, 0.3)
    ring_of(8, R, brazier, skip=lambda a: gate_gap(a, 0.3))
    def banner(a, x, y):
        team = "#c8383a" if math.cos(a) > 0 else "#3a5ad8"
        x, y = x * (R - 0.08) / R, y * (R - 0.08) / R  # hung on the inner face of the wall
        box((1.0, 0.06, 1.6), (x, y, 1.55), team, rot=(0, 0, a + math.pi / 2), bevel=0)
        box((0.4, 0.07, 0.4), (x * (R - 0.12) / (R - 0.08), y * (R - 0.12) / (R - 0.08), 1.7), "#e0b450", rot=(0, 0, a + math.pi / 2), bevel=0)
    ring_of(8, R, banner, skip=lambda a: gate_gap(a, 0.5))
    # four spawn pads: glowing rings in team colours
    for i, a in enumerate((0, math.pi / 2, math.pi, 3 * math.pi / 2)):
        if i == 3:
            a = -math.pi / 2 + 0.6
        x, y = math.cos(a) * 10.5, math.sin(a) * 10.5
        bpy.ops.mesh.primitive_torus_add(major_radius=0.9, minor_radius=0.08, location=(x, y, 0.08))
        bpy.context.object.data.materials.append(mat("#5affc8", 6))
    # two heroes and a fireball
    for loc, rot, frame in (((-1.6, 0.4, 0), -math.pi / 2 + 0.3, 135), ((2.4, -0.6, 0), math.pi / 2 + 0.2, 104)):
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(HERO))
        new = [o for o in bpy.data.objects if o not in before]
        root = next(o for o in new if o.parent is None)
        root.location = loc
        root.rotation_euler = (0, 0, rot)
        root.scale = (1.15, 1.15, 1.15)
        arm = next((o for o in new if o.type == "ARMATURE"), None)
        if arm and arm.animation_data and arm.animation_data.action:
            # each hero gets its own pose: copy the action and offset it so one slashes while the other runs
            act = arm.animation_data.action.copy()
            arm.animation_data.action = act
            for fc in getattr(act, "fcurves", []):
                for kp in fc.keyframe_points:
                    kp.co.x += 40 - frame
                    kp.handle_left.x += 40 - frame
                    kp.handle_right.x += 40 - frame
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.28, location=(0.6, 0.0, 1.0))
    bpy.context.object.data.materials.append(mat("#ff7a2a", 25))
    for k in range(5):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.18 - k * 0.03, location=(-0.0 - k * 0.35, 0.12, 1.02))
        bpy.context.object.data.materials.append(mat("#ffb05a", 10 - k * 1.5))


def render():
    scene = bpy.context.scene
    scene.frame_set(40)
    scene.render.engine = "BLENDER_EEVEE"
    scene.view_settings.view_transform = "Standard"  # plain colours, like the game (no film look)
    scene.render.resolution_x, scene.render.resolution_y = 1280, 720
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = hexc("#9cc8f0")
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9
    scene.world = world
    bpy.ops.object.light_add(type="SUN", rotation=(math.radians(50), math.radians(10), math.radians(-35)))
    bpy.context.object.data.energy = 3.5
    cam_data = bpy.data.cameras.new("cam")
    cam = bpy.data.objects.new("cam", cam_data)
    bpy.context.collection.objects.link(cam)
    scene.camera = cam
    OUT.mkdir(parents=True, exist_ok=True)
    # the in-game chase-camera angle, from just inside the gate
    cam.location = (3.5, -16.5, 9.5)
    target = Vector((0, 0, 0.8))
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam_data.lens = 26
    scene.render.filepath = str(OUT / "arena_view.png")
    bpy.ops.render.render(write_still=True)
    # top-down layout
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 2 * (R + 7)
    cam.location = (0, 0, 40)
    cam.rotation_euler = (0, 0, 0)
    scene.render.resolution_x = scene.render.resolution_y = 900
    scene.render.filepath = str(OUT / "arena_plan.png")
    bpy.ops.render.render(write_still=True)


bpy.ops.wm.read_factory_settings(use_empty=True)
build()
render()
print("rendered to", OUT)
