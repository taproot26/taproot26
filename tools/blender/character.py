"""A fully modelled, rigged and animated Taproot hero, built in Blender (style test).

One chibi character in the default look (black spiky hair, red tee, blue
shorts, dark boots) at the same size as the game's code-built hero (about
1.5 tiles tall, feet at the origin, facing the street):

  model       body, clothes, boots, belt, ears, modelled anime eyes (whites,
              iris, pupil, shines), brows, mouth, blush and spiky hair tufts;
              colour and ambient occlusion baked into the vertices
  rig         root > hips > spine > chest > neck > head (> eyes, for blinks),
              arms (upper, fore, hand) and legs (thigh, shin, foot) per side
  animation   one timeline the game cuts into clips (24 fps):
                idle 1-48 · walk 60-84 · run 100-116 · attack 130-148

    blender -b -P tools/blender/character.py -- game/assets3d/hero_blender.glb [preview_dir]

With a preview_dir it also renders a few posed frames (Workbench) to check the rig.
"""
import math
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Euler, Vector

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = Path(ARGS[0] if ARGS else "hero_blender.glb").resolve()
PREVIEW = Path(ARGS[1]).resolve() if len(ARGS) > 1 else None

SKIN, SKIN_DK = "#e8b48a", "#c98c6a"
HAIR, HAIR_HI = "#2a2630", "#4a4458"
SHIRT, PANTS, BOOT, SOLE = "#d23c34", "#34509e", "#3b3640", "#1f1c24"
BELT, BUCKLE = "#5a4632", "#e0b450"
IRIS, INK, WHITE = "#6a4ad8", "#1c0c26", "#ffffff"


def hexc(h, a=1.0):
    """#rrggbb (sRGB, as on screen) -> linear RGBA, which is what Blender's colour inputs expect."""
    h = h.lstrip("#")
    lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return [lin(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4)] + [a]


MATS = {}


def mat(color):
    if color not in MATS:
        m = bpy.data.materials.new(color)
        m.use_nodes = True
        m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = hexc(color)
        m.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 1.0
        MATS[color] = m
    return MATS[color]


PARTS = []


def finish_part(o, color, bone, weights=None):
    """Material + skin weights. weights: optional fn(world co) -> {bone: w} for blended parts."""
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target="MESH")
    o.data.materials.append(mat(color))
    if weights is None:
        g = o.vertex_groups.new(name=bone)
        g.add([v.index for v in o.data.vertices], 1.0, "REPLACE")
    else:
        groups = {}
        for v in o.data.vertices:
            for b, w in weights(o.matrix_world @ v.co).items():
                if b not in groups:
                    groups[b] = o.vertex_groups.get(b) or o.vertex_groups.new(name=b)
                groups[b].add([v.index], w, "REPLACE")
    PARTS.append(o)
    return o


def sphere(loc, scale, color, bone, seg=24, rings=16, rot=(0, 0, 0), weights=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = scale
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    return finish_part(o, color, bone, weights)


def capsule(a, b, r, color, bone, weights=None, r2=None):
    """Rounded limb from point a to b (a sphere swept along the segment)."""
    a, b = Vector(a), Vector(b)
    d = b - a
    L = d.length
    bm = bmesh.new()
    seg, rings = 16, 12
    r2 = r if r2 is None else r2
    rows = []
    for i in range(rings + 1):  # bottom cap, straight middle, top cap
        t = i / rings
        if t < 0.25:
            ang = -math.pi / 2 + (t / 0.25) * math.pi / 2
            z, rr = r * math.sin(ang), r * math.cos(ang)
        elif t > 0.75:
            ang = ((t - 0.75) / 0.25) * math.pi / 2
            z, rr = L + r2 * math.sin(ang), r2 * math.cos(ang)
        else:
            k = (t - 0.25) / 0.5
            z, rr = L * k, r + (r2 - r) * k
        rows.append([bm.verts.new((math.cos(2 * math.pi * j / seg) * max(rr, 1e-4), math.sin(2 * math.pi * j / seg) * max(rr, 1e-4), z)) for j in range(seg)])
    for p, q in zip(rows, rows[1:]):
        for j in range(seg):
            bm.faces.new((p[j], p[(j + 1) % seg], q[(j + 1) % seg], q[j]))
    me = bpy.data.meshes.new("cap")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("cap", me)
    bpy.context.collection.objects.link(o)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    o.location = a
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    o.select_set(False)
    return finish_part(o, color, bone, weights)


def revolve(profile, color, bone, sy=1.0, seg=36, weights=None):
    """Smooth body of revolution around Z from (radius, z) pairs, depth squashed by sy."""
    bm = bmesh.new()
    rings = [[bm.verts.new((math.cos(2 * math.pi * j / seg) * r, math.sin(2 * math.pi * j / seg) * r * sy, z)) for j in range(seg)] for r, z in profile]
    for p, q in zip(rings, rings[1:]):
        for j in range(seg):
            bm.faces.new((p[j], p[(j + 1) % seg], q[(j + 1) % seg], q[j]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    me = bpy.data.meshes.new("rev")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("rev", me)
    bpy.context.collection.objects.link(o)
    sub = o.modifiers.new("s", "SUBSURF")
    sub.levels = 1
    return finish_part(o, color, bone, weights)


def cone(loc, r, depth, color, bone, rot=(0, 0, 0), verts=10):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=0.0, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object
    bpy.ops.object.transform_apply(rotation=True)
    return finish_part(o, color, bone)


def disc(loc, r, color, bone, sx=1.0, sz=1.0, normal=(0, -1, 0), thick=0.004):
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=r, depth=thick, location=loc)
    o = bpy.context.object
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(Vector(normal))
    o.scale = (sx, sz, 1)
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    return finish_part(o, color, bone)


def torus(loc, R, r, color, bone, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=28, minor_segments=8, location=loc)
    o = bpy.context.object
    o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    return finish_part(o, color, bone)


# ------------------------------------------------------------------ the model (front = -Y)

HIP, CHEST, NECK, HEAD_C = 0.5, 0.7, 0.845, 1.06


def build_model():
    # legs: shorts over the thigh, skin knee, boots
    for s, side in ((1, "L"), (-1, "R")):
        x = 0.075 * s
        capsule((x, 0, HIP - 0.04), (x, 0, 0.29), 0.06, PANTS, f"thigh.{side}", r2=0.055)
        capsule((x, 0, 0.29), (x, 0, 0.1), 0.05, SKIN, f"shin.{side}", r2=0.045)
        sphere((x, -0.04, 0.045), (0.06, 0.1, 0.05), BOOT, f"foot.{side}")
        sphere((x, -0.105, 0.035), (0.052, 0.05, 0.04), BOOT, f"foot.{side}")
        sphere((x, 0, 0.12), (0.056, 0.056, 0.07), BOOT, f"shin.{side}")
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -0.035, 0.008))
        sole = bpy.context.object
        sole.scale = (0.12, 0.21, 0.02)
        bpy.ops.object.transform_apply(scale=True)
        b = sole.modifiers.new("b", "BEVEL"); b.width = 0.008; b.segments = 2
        finish_part(sole, SOLE, f"foot.{side}")
        torus((x, 0, 0.165), 0.055, 0.012, BOOT, f"shin.{side}")

    # hips (shorts) and the torso, which bends between spine and chest
    sphere((0, 0, HIP + 0.01), (0.145, 0.105, 0.09), PANTS, "hips")
    torso_w = lambda co: {"spine": 1 - min(1, max(0, (co.z - 0.66) / 0.08)), "chest": min(1, max(0, (co.z - 0.66) / 0.08))}
    revolve([(0.0, 0.53), (0.138, 0.53), (0.146, 0.56), (0.15, 0.62), (0.16, 0.7), (0.164, 0.75), (0.155, 0.79), (0.12, 0.825), (0.07, 0.84), (0.0, 0.845)],
            SHIRT, "spine", sy=0.82, weights=torso_w)
    torus((0, 0, 0.545), 0.15, 0.022, BELT, "spine", scale=(1, 0.8, 1))
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.122, 0.545))
    buckle = bpy.context.object
    buckle.scale = (0.05, 0.02, 0.04)
    bpy.ops.object.transform_apply(scale=True)
    finish_part(buckle, BUCKLE, "spine")
    torus((0, 0, 0.84), 0.065, 0.016, SHIRT, "chest")  # collar
    capsule((0, 0, 0.82), (0, 0, 0.9), 0.045, SKIN_DK, "neck")

    # arms: short red sleeve, skin arm, mitten hand
    for s, side in ((1, "L"), (-1, "R")):
        x = 0.185 * s
        sphere((x, 0, 0.8), (0.062, 0.06, 0.065), SHIRT, f"upperarm.{side}")
        capsule((x, 0, 0.79), (x, 0, 0.66), 0.044, SKIN, f"upperarm.{side}", r2=0.04)
        capsule((x, 0, 0.66), (x, 0, 0.54), 0.04, SKIN, f"forearm.{side}", r2=0.037)
        sphere((x, -0.005, 0.5), (0.05, 0.048, 0.056), SKIN, f"hand.{side}")
        sphere((x - 0.03 * s, -0.03, 0.52), (0.02, 0.022, 0.026), SKIN, f"hand.{side}")

    # head: skull, ears, modelled eyes, brows, mouth, blush
    sphere((0, 0, HEAD_C), (0.27, 0.26, 0.255), SKIN, "head", seg=40, rings=28)
    for s in (1, -1):
        sphere((0.262 * s, 0.0, HEAD_C - 0.01), (0.035, 0.03, 0.05), SKIN, "head")
    for s in (1, -1):
        ex, ez, ey = 0.095 * s, HEAD_C - 0.02, -0.222
        sphere((ex, ey, ez), (0.062, 0.03, 0.075), WHITE, "eyes", rot=(0, 0, 0))
        sphere((ex, ey - 0.018, ez - 0.006), (0.046, 0.02, 0.058), IRIS, "eyes")
        sphere((ex, ey - 0.03, ez - 0.004), (0.024, 0.012, 0.032), INK, "eyes")
        sphere((ex - 0.018 * s, ey - 0.04, ez + 0.022), (0.014, 0.008, 0.014), WHITE, "eyes")
        sphere((ex + 0.016 * s, ey - 0.04, ez - 0.028), (0.007, 0.005, 0.007), WHITE, "eyes")
        capsule((ex - 0.06 * s, ey - 0.02, ez + 0.07), (ex + 0.055 * s, ey - 0.03, ez + 0.082), 0.011, INK, "eyes")  # upper lash
        capsule((ex - 0.045 * s, ey - 0.02, ez + 0.125), (ex + 0.045 * s, ey - 0.03, ez + 0.13), 0.009, HAIR, "head")  # brow
        disc((ex + 0.02 * s, -0.235, ez - 0.095), 0.034, "#f08a96", "head", sx=1.5, sz=0.6, normal=(0.15 * s, -1, -0.25))
    capsule((-0.022, -0.252, HEAD_C - 0.165), (0.022, -0.252, HEAD_C - 0.165), 0.008, "#8a3a3a", "head")
    sphere((0, -0.262, HEAD_C - 0.095), (0.012, 0.01, 0.01), SKIN_DK, "head")

    # hair: a cap over the skull, then spiky tufts on top and at the back, and bangs over the forehead
    cap = sphere((0, 0.012, HEAD_C + 0.035), (0.288, 0.285, 0.27), HAIR, "head", seg=40, rings=28)
    bm = bmesh.new()
    bm.from_mesh(cap.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if (v.co.y < -0.02 and v.co.z < HEAD_C + 0.1) or (v.co.z < HEAD_C - 0.03 and v.co.y < 0.06)], context="VERTS")
    bm.to_mesh(cap.data)
    bm.free()
    for i in range(9):
        a = -math.pi * 0.85 + i * math.pi * 1.7 / 8
        x, y = math.sin(a) * 0.17, math.cos(a) * 0.17 + 0.03
        cone((x, y, HEAD_C + 0.27), 0.08, 0.22, HAIR, "head", rot=(-math.cos(a) * 0.75 + 0.35, math.sin(a) * 0.75, 0))
    for i in range(7):  # tufts hanging down the back of the head, fanned around it
        a = -1.25 + i * 2.5 / 6
        x, y = math.sin(a) * 0.235, math.cos(a) * 0.235 + 0.02
        cone((x, y, HEAD_C - 0.04), 0.075, 0.26, HAIR, "head", rot=(-(math.pi - 0.45), 0, -a))
    for s in (1, -1):  # side locks in front of the ears
        cone((0.255 * s, -0.01, HEAD_C - 0.03), 0.045, 0.2, HAIR, "head", rot=(math.pi - 0.1, -0.15 * s, 0))
    for i in range(6):
        x = -0.15 + i * 0.06
        cone((x, -0.225, HEAD_C + 0.12), 0.05, 0.16, HAIR, "head", rot=(math.radians(165), x * 1.5, 0))
    cone((0.02, 0.0, HEAD_C + 0.35), 0.03, 0.16, HAIR, "head", rot=(-0.4, 0.3, 0))  # ahoge


# ------------------------------------------------------------------ the rig

BONES = [  # name, head, tail, parent
    ("root", (0, 0, 0), (0, 0.15, 0), None),
    ("hips", (0, 0, HIP), (0, 0, 0.56), "root"),
    ("spine", (0, 0, 0.56), (0, 0, CHEST), "hips"),
    ("chest", (0, 0, CHEST), (0, 0, NECK), "spine"),
    ("neck", (0, 0, NECK), (0, 0, 0.9), "chest"),
    ("head", (0, 0, 0.9), (0, 0, 1.3), "neck"),
    ("eyes", (0, -0.2, HEAD_C - 0.02), (0, -0.3, HEAD_C - 0.02), "head"),
]
for s, side in ((1, "L"), (-1, "R")):
    BONES += [
        (f"thigh.{side}", (0.075 * s, 0, HIP - 0.04), (0.075 * s, 0, 0.29), "hips"),
        (f"shin.{side}", (0.075 * s, 0, 0.29), (0.075 * s, 0, 0.09), f"thigh.{side}"),
        (f"foot.{side}", (0.075 * s, 0, 0.09), (0.075 * s, -0.12, 0.03), f"shin.{side}"),
        (f"upperarm.{side}", (0.185 * s, 0, 0.8), (0.185 * s, 0, 0.66), "chest"),
        (f"forearm.{side}", (0.185 * s, 0, 0.66), (0.185 * s, 0, 0.54), f"upperarm.{side}"),
        (f"hand.{side}", (0.185 * s, 0, 0.54), (0.185 * s, 0, 0.46), f"forearm.{side}"),
    ]


def build_rig():
    arm_data = bpy.data.armatures.new("rig")
    arm = bpy.data.objects.new("hero", arm_data)
    bpy.context.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm_data.edit_bones
    for name, h, t, parent in BONES:
        b = eb.new(name)
        b.head, b.tail = h, t
        b.roll = 0
        if parent:
            b.parent = eb[parent]
            b.use_connect = False
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm


# ------------------------------------------------------------------ animation
# Rotations are in each bone's local frame. Leg and arm bones point down, so +X swings them backward
# and -X forward; for the spine/head bones (pointing up) +X tips them forward.

FPS = 24
CLIPS = {"idle": (1, 48), "walk": (60, 84), "run": (100, 116), "attack": (130, 148)}


def key(arm, frame, poses, hips_z=0.0):
    for name, (rx, ry, rz) in poses.items():
        pb = arm.pose.bones[name]
        pb.rotation_mode = "XYZ"
        pb.rotation_euler = (rx, ry, rz)
        pb.keyframe_insert("rotation_euler", frame=frame)
    hb = arm.pose.bones["hips"]
    hb.location = (0, hips_z, 0)  # bone-local Y = up for the hips bone
    hb.keyframe_insert("location", frame=frame)
    for name in ("eyes",):
        eb = arm.pose.bones[name]
        eb.keyframe_insert("scale", frame=frame)


ALL = [b[0] for b in BONES]


def rest():
    return {n: (0.0, 0.0, 0.0) for n in ALL}


def animate(arm):
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="POSE")
    # idle: breathing, arms hang slightly out, a slow head tilt
    for f, k in ((1, 0.0), (13, 1.0), (25, 0.0), (37, -1.0), (48, 0.0)):
        p = rest()
        p["chest"] = (0.03 * k, 0, 0)
        p["head"] = (-0.02 * k, 0, 0.03 * k)
        p["upperarm.L"] = (0.02 * k, 0, 0.12)
        p["upperarm.R"] = (0.02 * k, 0, -0.12)
        p["forearm.L"] = p["forearm.R"] = (-0.15, 0, 0)
        key(arm, f, p, 0.004 * k)
    # walk and run: legs swing opposite to arms, knees fold on the back swing, hips bob twice a cycle
    for clip, amp, knee, arm_amp, lean, bob in (("walk", 0.55, 0.9, 0.5, 0.06, 0.025), ("run", 0.95, 1.5, 0.9, 0.28, 0.045)):
        f0, f1 = CLIPS[clip]
        n = f1 - f0
        for i in range(0, n + 1, 2):
            ph = 2 * math.pi * i / n
            s, c = math.sin(ph), math.cos(ph)
            p = rest()
            p["thigh.L"] = (-s * amp, 0, 0)
            p["thigh.R"] = (s * amp, 0, 0)
            p["shin.L"] = (max(0, c) * knee + 0.05, 0, 0)
            p["shin.R"] = (max(0, -c) * knee + 0.05, 0, 0)
            p["foot.L"] = (-(-s * amp + max(0, c) * knee) * 0.5, 0, 0)
            p["foot.R"] = (-(s * amp + max(0, -c) * knee) * 0.5, 0, 0)
            p["upperarm.L"] = (s * arm_amp, 0, 0.12)
            p["upperarm.R"] = (-s * arm_amp, 0, -0.12)
            fold = -0.3 - (0.9 if clip == "run" else 0.2)
            p["forearm.L"] = p["forearm.R"] = (fold, 0, 0)
            p["spine"] = (lean, s * 0.12, 0)
            p["chest"] = (0.0, -s * 0.12, 0)
            p["head"] = (-lean * 0.6, 0, 0)
            key(arm, f0 + i, p, abs(c) * bob - bob * 0.5)
    # attack: wind up the right arm overhead, then slash down and across with a body twist
    f0, _ = CLIPS["attack"]
    for f, wind, slash in ((0, 0, 0), (5, 1, 0), (9, 1, 1), (13, 0.4, 1), (18, 0, 0)):
        p = rest()
        p["upperarm.R"] = (-2.4 * wind + 1.6 * slash * wind, 0, -0.3 * wind + 0.5 * slash)
        p["forearm.R"] = (-0.6 * wind + 0.4 * slash, 0, 0)
        p["chest"] = (0.1 * slash, -0.5 * wind + 1.0 * slash * wind, 0)
        p["spine"] = (0.08 * slash, -0.2 * wind + 0.35 * slash * wind, 0)
        p["upperarm.L"] = (-0.4 * wind, 0, 0.35)
        p["forearm.L"] = (-0.8 * wind, 0, 0)
        p["thigh.L"] = (-0.35 * slash, 0, 0)
        p["shin.L"] = (0.3 * slash, 0, 0)
        p["thigh.R"] = (0.25 * slash, 0, 0)
        key(arm, f0 + f, p, -0.02 * slash)
    bpy.ops.object.mode_set(mode="OBJECT")
    act = arm.animation_data.action
    act.name = "all"
    scene = bpy.context.scene
    scene.render.fps = FPS
    scene.frame_start, scene.frame_end = 1, CLIPS["attack"][1]


# ------------------------------------------------------------------ bake, bind, export

def bake_and_bind(arm):
    bpy.ops.object.select_all(action="DESELECT")
    for o in PARTS:
        o.select_set(True)
    bpy.context.view_layer.objects.active = PARTS[0]
    bpy.ops.object.join()
    body = bpy.context.object
    body.name = "hero_mesh"
    bpy.ops.object.shade_auto_smooth(angle=math.radians(50))
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 64
    scene.render.bake.target = "VERTEX_COLORS"

    def bake(kind, attr, **kw):
        a = body.data.color_attributes.new(attr, "FLOAT_COLOR", "CORNER")
        body.data.color_attributes.active_color = a
        bpy.ops.object.bake(type=kind, **kw)
        return np.array([c.color[:] for c in body.data.color_attributes[attr].data])

    arm.hide_render = True
    ao = bake("AO", "ao")[:, :1]
    diff = bake("DIFFUSE", "diff", pass_filter={"COLOR"})
    col = diff.copy()
    col[:, :3] = diff[:, :3] * (0.6 + 0.4 * ao)
    out = body.data.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    for i, c in enumerate(out.data):
        c.color = col[i].tolist()
    for n in ("ao", "diff"):
        body.data.color_attributes.remove(body.data.color_attributes[n])
    body.data.color_attributes.active_color = body.data.color_attributes["Col"]
    body.data.color_attributes.render_color_index = body.data.color_attributes.active_color_index
    body.data.materials.clear()
    body.data.materials.append(mat("#ffffff"))
    arm.hide_render = False

    body.parent = arm
    mod = body.modifiers.new("rig", "ARMATURE")
    mod.object = arm
    return body


def preview(arm):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.color_type = "VERTEX"
    scene.display.shading.light = "STUDIO"
    scene.render.resolution_x, scene.render.resolution_y = 360, 420
    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 1.9
    cam = bpy.data.objects.new("cam", cam_data)
    bpy.context.collection.objects.link(cam)
    scene.camera = cam
    PREVIEW.mkdir(parents=True, exist_ok=True)
    for view, loc, rot in (("front", (0.9, -3, 0.75), (math.radians(90), 0, math.radians(17))), ("side", (3, 0, 0.75), (math.radians(90), 0, math.radians(90)))):
        cam.location, cam.rotation_euler = loc, rot
        for name, f in (("idle", 1), ("walk", 66), ("run", 104), ("attack", 135), ("attack2", 139)):
            scene.frame_set(f)
            scene.render.filepath = str(PREVIEW / f"{view}_{name}.png")
            bpy.ops.render.render(write_still=True)


bpy.ops.wm.read_factory_settings(use_empty=True)
build_model()
arm = build_rig()
body = bake_and_bind(arm)
animate(arm)
if PREVIEW:
    preview(arm)
bpy.ops.object.select_all(action="DESELECT")
arm.select_set(True)
body.select_set(True)
OUT.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(OUT), export_format="GLB", use_selection=True, export_yup=True, export_apply=False,
                          export_vertex_color="ACTIVE", export_normals=True, export_skins=True, export_animations=True,
                          export_animation_mode="ACTIVE_ACTIONS", export_force_sampling=True)
print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB, {len(body.data.polygons)} faces, {len(arm.data.bones)} bones)")
