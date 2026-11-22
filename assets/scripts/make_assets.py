"""
星屑デリバリー - プロシージャルアセット生成スクリプト
使い方:
  blender -b -P assets/scripts/make_assets.py
プロジェクトルート基準で public/models/*.glb, assets/source/*.blend,
preview.png (プロジェクトルート) を生成する。
"""
import bpy, math, os, sys
from mathutils import Vector

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
MODELS = os.path.join(ROOT, "public", "models")
SOURCE = os.path.join(ROOT, "assets", "source")
os.makedirs(MODELS, exist_ok=True)
os.makedirs(SOURCE, exist_ok=True)

def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for m in list(bpy.data.materials):
        bpy.data.materials.remove(m)

def mat(name, color, roughness=0.85, metallic=0.0, emission=None, emission_strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission is not None:
        try:
            bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
            bsdf.inputs["Emission Strength"].default_value = emission_strength
        except Exception:
            pass
    return m

GRASS = (0.32, 0.68, 0.33); SAND = (0.93, 0.80, 0.55); ROCKC = (0.45, 0.45, 0.5)
BROWN = (0.42, 0.26, 0.13); GREEN = (0.10, 0.48, 0.28); WHITE = (0.96, 0.96, 0.97)
RED = (0.85, 0.22, 0.22); ORANGE = (1.0, 0.55, 0.15)

def apply(obj, material):
    if material: obj.data.materials.append(material)
    return obj

def cube(name, loc, scale, material, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    o = bpy.context.object; o.name = name; o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    return apply(o, material)

def cyl(name, loc, radius, depth, material, vertices=20, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object; o.name = name
    return apply(o, material)

def cone(name, loc, r1, depth, material, vertices=16, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r1, radius2=0, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object; o.name = name
    return apply(o, material)

def sphere(name, loc, radius, material, scale=(1,1,1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=loc)
    o = bpy.context.object; o.name = name; o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    return apply(o, material)

def export(name):
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SOURCE, name + ".blend"))
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=os.path.join(MODELS, name + ".glb"),
        export_format='GLB', use_selection=True, export_apply=True)
    print(f"EXPORTED {name}.glb")

# ---------- builders (return list of objects; positioned around origin, ground y=0 in Blender Z-up) ----------
# Note: Blender is Z-up; glTF export converts to Y-up for Three.js.

def build_island():
    clear()
    sand = mat("Sand", SAND); grass = mat("Grass", GRASS); rockm = mat("Rock", ROCKC); hillm = mat("HillGrass", (0.26,0.6,0.3))
    cyl("SandDisc", (0,0,-0.6), 32, 1.6, sand, 36)
    cyl("GrassDisc", (0,0,0.3), 29, 1.4, grass, 36)
    cone("Hill", (10,8,1.8), 8, 3.0, hillm, 24)
    cone("Hill2", (-14,-6,1.4), 6, 2.2, hillm, 24)
    # underside rock cone (floating island bottom)
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=26, radius2=0, depth=12, location=(0,0,-8), rotation=(math.pi,0,0))
    apply(bpy.context.object, rockm); bpy.context.object.name = "IslandBottom"
    return "island"

def build_drone():
    clear()
    white = mat("DroneWhite", WHITE, 0.35, 0.1); orange = mat("DroneOrange", ORANGE, 0.4)
    glass = mat("Glass", (0.35,0.8,1.0), 0.15, 0.2, emission=(0.2,0.6,1.0), emission_strength=0.6)
    dark = mat("Dark", (0.08,0.08,0.1), 0.5)
    sphere("Body", (0,0,0.6), 0.85, white, (1.15,1.0,0.62))
    sphere("Cockpit", (0,0.45,0.78), 0.42, glass)
    sphere("EyeL", (-0.18,0.86,0.72), 0.07, dark); sphere("EyeR", (0.18,0.86,0.72), 0.07, dark)
    cyl("BellyLight", (0,0,0.12), 0.28, 0.12, mat("Glow", (1,0.85,0.3), 0.4, 0, emission=(1,0.8,0.25), emission_strength=2.0))
    for sx in (-1,1):
        for sy in (-1,1):
            cube("Arm", (sx*0.95, sy*0.75, 0.72), (0.42,0.10,0.07), orange)
            cyl("Motor", (sx*1.35, sy*1.05, 0.78), 0.14, 0.18, dark)
            cyl("Rotor", (sx*1.35, sy*1.05, 0.92), 0.48, 0.04, mat("Rotor", (0.7,0.7,0.75), 0.4, 0.3), 20)
    cube("SkidL", (-0.5,0,-0.08), (0.06,0.62,0.06), dark); cube("SkidR", (0.5,0,-0.08), (0.06,0.62,0.06), dark)
    return "drone"

def build_lighthouse():
    clear()
    white = mat("LHWhite", WHITE, 0.6); red = mat("LHRed", RED, 0.6); dark = mat("Dark", (0.1,0.1,0.12), 0.5)
    lampm = mat("Lamp", (1,0.9,0.4), 0.3, 0, emission=(1,0.85,0.3), emission_strength=3.0)
    cyl("Base", (0,0,0.5), 2.6, 1.0, mat("Rock", ROCKC))
    for i, m in enumerate([white, red, white, red, white]):
        cyl(f"Tower{i}", (0,0,1.75 + i*1.5), 1.55 - i*0.09, 1.5, m, 18)
    cyl("Gallery", (0,0,9.35), 1.55, 0.3, dark, 18)
    cyl("LampRoom", (0,0,10.3), 1.0, 1.6, lampm, 12)
    cone("Roof", (0,0,11.9), 1.5, 1.6, red, 18)
    cube("Door", (0,1.85,1.4), (0.45,0.12,0.8), dark)
    return "lighthouse"

def build_tree():
    clear()
    trunk = mat("Trunk", BROWN); leaf = mat("Leaf", GREEN)
    cyl("Trunk", (0,0,1.0), 0.28, 2.0, trunk, 10)
    cone("Leaf1", (0,0,3.0), 1.7, 2.6, leaf, 10)
    cone("Leaf2", (0,0,4.4), 1.3, 2.2, leaf, 10)
    cone("Leaf3", (0,0,5.6), 0.9, 1.8, leaf, 10)
    return "tree"

def build_rock():
    clear()
    rockm = mat("Rock", ROCKC, 0.95)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1.4, location=(0,0,0.7))
    o = bpy.context.object; o.name = "Rock"; o.scale = (1.2,0.95,0.75); bpy.ops.object.transform_apply(scale=True)
    apply(o, rockm)
    for p in o.data.polygons: p.use_smooth = False
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.8, location=(1.0,0.4,0.4))
    o2 = bpy.context.object; o2.name = "RockSmall"; apply(o2, rockm)
    return "rock"

def build_house():
    clear()
    wall = mat("Wall", (1.0,0.9,0.72), 0.8); roofm = mat("Roof", (0.75,0.32,0.22), 0.8); dark = mat("Door", BROWN)
    winm = mat("Window", (1,0.85,0.45), 0.4, 0, emission=(1,0.8,0.35), emission_strength=1.2)
    cube("Walls", (0,0,1.3), (1.7,1.5,1.3), wall)
    cone("Roof", (0,0,3.55), 2.65, 1.9, roofm, 4, rot=(0,0,math.radians(45)))
    cube("Door", (0,1.52,0.95), (0.42,0.06,0.95), dark)
    cube("WinL", (-0.95,1.52,1.65), (0.38,0.06,0.42), winm); cube("WinR", (0.95,1.52,1.65), (0.38,0.06,0.42), winm)
    cyl("Chimney", (0.8,-0.5,3.9), 0.22, 1.0, mat("Rock", ROCKC), 8)
    return "house"

def build_crystal():
    clear()
    cm = mat("Crystal", (0.45,0.9,1.0), 0.15, 0.1, emission=(0.3,0.8,1.0), emission_strength=2.5)
    bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.55, radius2=0, depth=1.9, location=(0,0,1.15))
    o = bpy.context.object; o.name = "CrystalTop"; apply(o, cm)
    bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.55, radius2=0, depth=0.8, location=(0,0,-0.2), rotation=(math.pi,0,0))
    o2 = bpy.context.object; o2.name = "CrystalBottom"; apply(o2, cm)
    sphere("Core", (0,0,0.65), 0.22, mat("Core", (1,1,1), 0.2, 0, emission=(0.8,0.95,1), emission_strength=3))
    return "crystal"

BUILDERS = [build_island, build_drone, build_lighthouse, build_tree, build_rock, build_house, build_crystal]
for b in BUILDERS:
    name = b()
    export(name)

# ---------- preview scene ----------
clear()
# rebuild island manually via builder logic by importing exported GLBs is complex;
# instead rebuild simple assembled scene using the builder functions with offsets.
def place(builder, loc, scale=1.0, rotz=0.0):
    before = set(bpy.data.objects)
    builder()
    new = [o for o in bpy.data.objects if o not in before]
    # builders call clear(), so instead handle below
    return new

# Simpler preview: load GLBs back in
clear()
import mathutils
def load_glb(fname, loc, scale=1.0, rotz=0.0):
    path = os.path.join(MODELS, fname)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        o.location = (o.location[0]*scale + loc[0], o.location[1]*scale + loc[1], o.location[2]*scale + loc[2])
        o.scale = (scale, scale, scale)
        o.rotation_euler[2] += rotz
    return new

load_glb("island.glb", (0,0,0))
load_glb("lighthouse.glb", (0,-22,0.8))
for x,z in [(-14,-8),(10,-14),(18,4),(-20,6),(-8,16),(14,16)]:
    load_glb("tree.glb", (x,z,0.8))
for x,z in [(-10,-16),(16,-4),(-22,14)]:
    load_glb("rock.glb", (x,z,0.8))
load_glb("house.glb", (-12,10,0.8)); load_glb("house.glb", (16,10,0.8))
load_glb("drone.glb", (0,14,2.2))
for x,z in [(-18,-10),(12,-18),(20,8)]:
    load_glb("crystal.glb", (x,z,1.2))

world = bpy.data.worlds['World'] if bpy.data.worlds else bpy.data.worlds.new("World")
bpy.context.scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.16, 0.10, 0.30, 1.0); bg.inputs[1].default_value = 1.0

bpy.ops.object.light_add(type='SUN', location=(-20, -15, 30))
sun = bpy.context.object; sun.data.energy = 3; sun.rotation_euler = (math.radians(50), 0, math.radians(-30))
bpy.ops.object.camera_add(location=(52, -58, 40))
cam = bpy.context.object
direction = Vector((0,0,2)) - cam.location
cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
bpy.context.scene.camera = cam
scene = bpy.context.scene
try:
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 32
    scene.cycles.device = 'CPU'
except Exception as e:
    print("render engine fallback", e)
scene.render.resolution_x = 800; scene.render.resolution_y = 600
scene.render.filepath = os.path.join(ROOT, "preview.png")
bpy.ops.render.render(write_still=True)
print("PREVIEW", scene.render.filepath)
print("ALL DONE")
