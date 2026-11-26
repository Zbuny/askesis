"""Сборка 3D-персонажа Askesis в Blender.

Запуск (Blender 5.x, в фоне):
    D:\\blender\\blender.exe -b --factory-startup <bundle.blend> -P scripts/blender/build_character.py -- \
        --out client/public/models [--preview <папка для рендеров>] [--only m|f]

<bundle.blend> — human_base_meshes_bundle.blend из официального набора Blender
"Human Base Meshes" (CC0). Скрипт пересобирает всё с нуля при каждом запуске.

Что делает:
1. Берёт реалистичное мужское и женское тело, применяет мультирез (уровень 1)
   и прореживает сетку до бюджета для веба.
2. Уточняет ориентиры суставов по сечениям конечностей.
3. Строит 12 морф-таргетов — по одному на группу мышц из
   client/src/utils/physique.js. Мышца — «отпечаток» на поверхности: область
   вдоль кости (или на корпусе), смещение по нормали с плавным спадом.
4. Одежда — оболочки, вырезанные из того же тела ПОСЛЕ создания морфов:
   они наследуют те же морфы и поэтому растут вместе с мышцами.
5. Экспортирует character_m.glb и character_f.glb.
"""

import bpy
import bmesh
import math
import os
import sys

import numpy as np
from mathutils import Vector

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def arg(name, default=None):
    return ARGS[ARGS.index(name) + 1] if name in ARGS else default


OUT_DIR = arg('--out', 'client/public/models')
PREVIEW = arg('--preview')
ONLY = arg('--only')
STAGE = arg('--stage', 'all')  # body | all

REGIONS = ['chest', 'shoulders', 'biceps', 'triceps', 'forearms', 'back',
           'traps', 'abs', 'glutes', 'quads', 'hamstrings', 'calves']

# Ориентиры в координатах Blender (вперёд — −Y, вверх — Z), левая сторона (+X).
# Суставы конечностей потом уточняются по сечениям.
BODIES = {
    'm': {
        'source': 'GEO-body_male_realistic',
        'eyes': ['GEO-body_male_realistic.eye.L', 'GEO-body_male_realistic.eye.R'],
        'amp': 1.0,
        'lm': {
            'shoulder': (0.205, 0.0, 1.32), 'elbow': (0.29, 0.015, 1.09), 'wrist': (0.36, -0.07, 0.865),
            'hip': (0.09, 0.0, 0.88), 'knee': (0.11, -0.01, 0.48), 'ankle': (0.12, 0.03, 0.1),
        },
    },
    'f': {
        'source': 'GEO-body_female_realistic',
        'eyes': ['GEO-body_female_realistic.eye.L', 'GEO-body_female_realistic.eye.R'],
        'amp': 0.62,
        'lm': {
            'shoulder': (0.18, 0.0, 1.27), 'elbow': (0.27, 0.015, 1.05), 'wrist': (0.34, -0.06, 0.84),
            'hip': (0.09, 0.0, 0.86), 'knee': (0.1, -0.01, 0.47), 'ankle': (0.11, 0.03, 0.09),
        },
    },
}

DECIMATE_RATIO = 0.5


# ---------------------------------------------------------------- утилиты

def clean_scene(keep):
    for o in list(bpy.data.objects):
        if o.name not in keep:
            bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials):
        for block in list(coll):
            if block.users == 0:
                coll.remove(block)


def select_only(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def mesh_arrays(obj):
    me = obj.data
    n = len(me.vertices)
    co = np.empty(n * 3, dtype=np.float64)
    me.vertices.foreach_get('co', co)
    no = np.empty(n * 3, dtype=np.float64)
    me.vertices.foreach_get('normal', no)
    edges = np.empty(len(me.edges) * 2, dtype=np.int64)
    me.edges.foreach_get('vertices', edges)
    return co.reshape(-1, 3), no.reshape(-1, 3), edges.reshape(-1, 2)


def normalize(v):
    v = np.asarray(v, dtype=np.float64)
    return v / (np.linalg.norm(v, axis=-1, keepdims=True) + 1e-12)


def smooth_field(values, edges, n, iterations):
    """Лапласово сглаживание поля по рёбрам сетки (скаляр или вектор)."""
    v = values.copy()
    deg = np.bincount(edges.ravel(), minlength=n).astype(np.float64)
    deg[deg == 0] = 1
    for _ in range(iterations):
        acc = np.zeros_like(v)
        np.add.at(acc, edges[:, 0], v[edges[:, 1]])
        np.add.at(acc, edges[:, 1], v[edges[:, 0]])
        if v.ndim == 1:
            v = 0.5 * v + 0.5 * acc / deg
        else:
            v = 0.5 * v + 0.5 * acc / deg[:, None]
    return v


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def bump(u):
    """Колокол (1−u²)² на |u|<1."""
    u2 = np.minimum(u * u, 1.0)
    return (1 - u2) ** 2


# ------------------------------------------------------------- подготовка

def prepare_body(spec):
    src = bpy.data.objects[spec['source']]
    body = src.copy()
    body.data = src.data.copy()
    bpy.context.scene.collection.objects.link(body)
    body.name = 'body'
    body.data.name = 'body'
    body.location = (0, 0, 0)
    select_only(body)
    for mod in list(body.modifiers):
        if mod.type == 'MULTIRES':
            mod.levels = 1
            bpy.ops.object.modifier_apply(modifier=mod.name)
        else:
            body.modifiers.remove(mod)
    dec = body.modifiers.new('dec', 'DECIMATE')
    dec.ratio = DECIMATE_RATIO
    dec.use_symmetry = True
    dec.symmetry_axis = 'X'
    bpy.ops.object.modifier_apply(modifier=dec.name)
    # Симметричное прореживание оставляет дубли вершин по оси — без сварки
    # вдоль позвоночника виден шов.
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bm.to_mesh(body.data)
    bm.free()
    # Полигоны после прореживания — треугольники; гладкие нормали обязательны.
    for p in body.data.polygons:
        p.use_smooth = True
    for attr in [a.name for a in body.data.attributes]:
        if attr in ('sharp_face', 'sharp_edge', 'custom_normal', 'uv_seam', 'crease_edge'):
            body.data.attributes.remove(body.data.attributes[attr])
    while body.data.uv_layers:
        body.data.uv_layers.remove(body.data.uv_layers[0])
    body.data.update()

    eyes = []
    for name in spec['eyes']:
        src_eye = bpy.data.objects[name]
        eye = src_eye.copy()
        eye.data = src_eye.data.copy()
        bpy.context.scene.collection.objects.link(eye)
        # Глаза — потомки исходного тела: берём мировое положение.
        world = src_eye.matrix_world.copy()
        eye.parent = None
        eye.matrix_world = world
        eye.location = Vector(world.translation) - Vector(src.matrix_world.translation)
        eye.name = 'eye_' + name[-1]
        while eye.data.uv_layers:
            eye.data.uv_layers.remove(eye.data.uv_layers[0])
        for p in eye.data.polygons:
            p.use_smooth = True
        eyes.append(eye)
    return body, eyes


# -------------------------------------------------------------- ориентиры

def refine_joint(co, joint, axis, radius=0.085, slab=0.012):
    j = np.asarray(joint)
    a = normalize(axis)
    rel = co - j
    along = rel @ a
    radial = np.linalg.norm(rel - np.outer(along, a), axis=1)
    sel = (np.abs(along) < slab) & (radial < radius)
    if sel.sum() < 12:
        return j
    return co[sel].mean(axis=0)


def landmarks(spec, co):
    """Ориентиры отдельно для левой (L, +X) и правой (R, −X) стороны: поза в
    исходной модели не идеально симметрична, и зеркальные суставы промахиваются."""
    lm = {}
    for s, side in ((1, 'L'), (-1, 'R')):
        m = np.array([s, 1, 1], dtype=np.float64)
        j = {k: np.asarray(v, dtype=np.float64) * m for k, v in spec['lm'].items()}
        pts = co[co[:, 0] * s > 0]
        for _ in range(2):
            j['elbow'] = refine_joint(pts, j['elbow'], j['wrist'] - j['shoulder'])
            j['wrist'] = refine_joint(pts, j['wrist'], j['wrist'] - j['elbow'], radius=0.06)
            j['knee'] = refine_joint(pts, j['knee'], j['ankle'] - j['hip'], radius=0.09)
        # Лодыжку уточняем по голени выше стопы, иначе её тянет к пятке.
        j['ankle'] = refine_joint(pts, j['ankle'] + np.array([0, 0, 0.03]), j['ankle'] - j['knee'], radius=0.05)
        j['ankle'][2] -= 0.03
        j['hand'] = j['wrist'] + (j['wrist'] - j['elbow']) * 0.75
        j['toe'] = j['ankle'] + np.array([0.0, -0.16, -0.08])
        for k, v in j.items():
            lm[k + side] = v
    top = co[:, 2].max()
    sz = (lm['shoulderL'][2] + lm['shoulderR'][2]) / 2
    lm['shoulder'] = np.array([lm['shoulderL'][0], 0.0, sz])
    lm['hip'] = np.array([lm['hipL'][0], 0.0, (lm['hipL'][2] + lm['hipR'][2]) / 2])
    lm['top'] = np.array([0.0, 0.0, top])
    lm['neck'] = np.array([0.0, 0.03, sz + 0.11])
    lm['chin'] = np.array([0.0, -0.06, sz + 0.19])
    lm['headc'] = np.array([0.0, 0.0, top - 0.11])
    return lm


def segments(lm):
    """Отрезки «скелета» с радиусами — для разметки частей тела."""
    segs = {}
    sz, hz = lm['shoulder'][2], lm['hip'][2]
    segs['torso'] = [((0, 0.02, hz - 0.02), (0, 0.02, sz + 0.06), 0.125)]
    segs['head'] = [((0, -0.0, lm['chin'][2] + 0.02), (0, 0.0, lm['top'][2] - 0.09), 0.085)]
    for side in ('L', 'R'):
        j = {k: lm[k + side] for k in ('shoulder', 'elbow', 'wrist', 'hand', 'hip', 'knee', 'ankle', 'toe')}
        segs['upperArm' + side] = [(j['shoulder'], j['elbow'], 0.045)]
        segs['forearm' + side] = [(j['elbow'], j['wrist'], 0.037)]
        segs['hand' + side] = [(j['wrist'], j['hand'], 0.03)]
        segs['thigh' + side] = [(j['hip'], j['knee'], 0.075)]
        segs['shin' + side] = [(j['knee'], j['ankle'], 0.05)]
        segs['foot' + side] = [(j['ankle'], j['toe'], 0.035)]
    return segs


def seg_coords(co, a, b):
    a = np.asarray(a, dtype=np.float64)
    b = np.asarray(b, dtype=np.float64)
    ab = b - a
    L = np.linalg.norm(ab)
    axis = ab / L
    rel = co - a
    t = (rel @ axis) / L
    closest = a + np.outer(np.clip(t, 0, 1), ab)
    radial_vec = co - (a + np.outer(t, ab))
    dist = np.linalg.norm(co - closest, axis=1)
    return t, dist, radial_vec, axis, L


def part_weights(co, segs, temperature=0.012):
    names = list(segs)
    scores = []
    for name in names:
        best = None
        for a, b, r in segs[name]:
            _, dist, _, _, _ = seg_coords(co, a, b)
            d = dist - r
            best = d if best is None else np.minimum(best, d)
        scores.append(best)
    scores = np.stack(scores, axis=1)
    w = np.exp(-(scores - scores.min(axis=1, keepdims=True)) / temperature)
    w /= w.sum(axis=1, keepdims=True)
    return names, w


# ------------------------------------------------------------------ мышцы

def build_muscle_deltas(co, no, edges, lm, amp_scale):
    n = len(co)
    segs = segments(lm)
    names, pw = part_weights(co, segs)
    W = {name: pw[:, i] for i, name in enumerate(names)}

    sz, hz, sx = lm['shoulder'][2], lm['hip'][2], lm['shoulder'][0]

    deltas = {r: np.zeros(n) for r in REGIONS}
    owner = np.zeros((n, len(REGIONS)))

    def add(region, weight, amount):
        w = weight * amount * amp_scale
        deltas[region] += w
        owner[:, REGIONS.index(region)] += weight

    def torso(region, fx, fz, rx, rz, facing, amount, angle=0.0, power=1.0, side=None, extra=()):
        for s in ((1, -1) if side is None else (side,)):
            cx = fx * sx * s
            cz = hz + fz * (sz - hz)
            dx = co[:, 0] - cx
            dz = co[:, 2] - cz
            ca, sa = math.cos(angle * s), math.sin(angle * s)
            u = (dx * ca - dz * sa) / rx
            v = (dx * sa + dz * ca) / rz
            fp = bump(np.sqrt(u * u + v * v))
            o = normalize(np.array([facing[0] * s, facing[1], facing[2]]))
            face = np.clip(no @ o, 0, 1) ** power
            part = W['torso'] + sum(W[p + ('L' if s > 0 else 'R')] for p in extra)
            add(region, fp * face * part, amount)

    def limb(region, part, t0, half_len, direction, amount, cover=0.0, power=1.0):
        for s, side in ((1, 'L'), (-1, 'R')):
            a, b, _ = segs[part + side][0]
            t, _, radial, axis, L = seg_coords(co, a, b)
            along = bump((t - t0) * L / half_len)
            d = np.array([direction[0] * s, direction[1], direction[2]], dtype=np.float64)
            d = normalize(d - axis * (d @ axis))
            ang = np.clip((normalize(radial) @ d - cover) / (1 - cover), 0, 1) ** power
            add(region, along * ang * W[part + side], amount)

    # Корпус. fx — доля ширины плеч, fz — от линии бедра (0) до плеч (1).
    # Грудные: широкие и плоские, толще у грудины и у нижнего края.
    torso('chest', 0.42, 0.8, 0.13, 0.085, (0.2, -1, 0.05), 0.009, power=1.5)
    torso('chest', 0.3, 0.72, 0.08, 0.05, (0.1, -1, -0.2), 0.004, power=2)
    for fz in (0.62, 0.46, 0.30):
        torso('abs', 0.16, fz, 0.028, 0.03, (0, -1, 0), 0.008, power=2)
    torso('abs', 0.62, 0.36, 0.05, 0.09, (0.8, -0.6, 0), 0.005)
    torso('back', 0.64, 0.6, 0.06, 0.15, (0.75, 0.65, 0), 0.024, angle=0.35)
    torso('back', 0.34, 0.9, 0.08, 0.08, (0.2, 1, 0.2), 0.012)
    torso('back', 0.17, 0.26, 0.025, 0.11, (0, 1, 0), 0.011)
    torso('traps', 0.45, 1.2, 0.08, 0.045, (0.5, 0.6, 1), 0.009)
    torso('glutes', 0.45, -0.02, 0.085, 0.09, (0.25, 1, -0.1), 0.022, extra=('thigh',))

    # Зоны только для разметки (подсветка и подсказка при наведении): мышца
    # видна целиком, а не одними пиками рельефа. Смещения не дают.
    torso('abs', 0.0, 0.45, 0.11, 0.15, (0, -1, 0), 0.0, side=1)
    torso('chest', 0.45, 0.78, 0.17, 0.11, (0.2, -1, 0.05), 0.0)
    torso('back', 0.5, 0.65, 0.2, 0.3, (0.3, 1, 0), 0.0)

    # Конечности. t — доля длины кости от проксимального сустава.
    limb('shoulders', 'upperArm', 0.08, 0.11, (1, 0, 0.3), 0.02, cover=-0.55)
    limb('biceps', 'upperArm', 0.55, 0.1, (-0.2, -1, 0), 0.016, cover=0.1, power=1.5)
    limb('triceps', 'upperArm', 0.45, 0.12, (0.1, 1, 0), 0.015, power=1.3)
    limb('forearms', 'forearm', 0.3, 0.12, (1, -0.4, 0), 0.01, cover=-0.6)
    limb('quads', 'thigh', 0.45, 0.22, (0.3, -1, 0), 0.02, cover=-0.1, power=1.2)
    limb('quads', 'thigh', 0.84, 0.065, (-0.6, -1, 0), 0.009, cover=0.3)
    limb('hamstrings', 'thigh', 0.5, 0.2, (0, 1, 0), 0.016, power=1.3)
    limb('calves', 'shin', 0.28, 0.12, (0, 1, 0), 0.018, cover=-0.2, power=1.2)

    out = {}
    for region in REGIONS:
        d = smooth_field(deltas[region], edges, n, 4)
        out[region] = no * d[:, None]
    # Хозяин вершины — для подсказки при наведении и подсветки.
    owner = smooth_field(owner, edges, n, 3)
    strength = owner.max(axis=1)
    region_index = np.where(strength > 0.08, owner.argmax(axis=1), -1)
    return out, region_index, names, pw, segs


def add_shape_keys(obj, deltas):
    obj.shape_key_add(name='Basis', from_mix=False)
    base = np.empty(len(obj.data.vertices) * 3)
    obj.data.vertices.foreach_get('co', base)
    base = base.reshape(-1, 3)
    for region in REGIONS:
        key = obj.shape_key_add(name=region, from_mix=False)
        key.data.foreach_set('co', (base + deltas[region]).ravel())
        key.slider_min = -1.0
        key.slider_max = 1.0


# ---------------------------------------------------------------- рендер

def preview_material(name, color):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    return mat


def render_previews(body, folder, tag):
    sys.path.append(os.path.dirname(__file__))
    import rutil_render as R  # noqa: E402
    H = body.dimensions.z
    R.setup_render((640, 900))
    keys = body.data.shape_keys.key_blocks
    for label, value in (('min', -0.5), ('zero', 0.0), ('max', 1.0)):
        for region in REGIONS:
            keys[region].value = value
        for az, view in ((0.0, 'f'), (math.pi, 'b'), (math.pi / 2, 's')):
            R.shoot(os.path.join(folder, f'{tag}_{label}_{view}.png'), target=(0, 0, H / 2), azimuth=az, ortho=H * 1.06)
    for region in REGIONS:
        keys[region].value = 0.0


# ---------------------------------------------------------------- одежда

MATERIALS = {
    # имя: (цвет, шероховатость, металличность). skin/cloth/hair перекрашивает
    # приложение (gltfFigure.js), остальные идут как есть.
    'skin': ((0.8, 0.62, 0.5), 0.55, 0.0),
    'cloth': ((0.35, 0.35, 0.37), 0.85, 0.0),
    'hair': ((0.18, 0.12, 0.08), 0.9, 0.0),
    'sole': ((0.92, 0.91, 0.88), 0.9, 0.0),
    'gold': ((0.79, 0.64, 0.39), 0.32, 0.85),
    'eye': ((0.12, 0.09, 0.07), 0.25, 0.0),
    'ribbon': ((0.56, 0.18, 0.2), 0.8, 0.0),
}


def material(name):
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    color, rough, metal = MATERIALS[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    mat.diffuse_color = (*color, 1)
    return mat


def vertex_normals(P, tris):
    a, b, c = P[tris[:, 0]], P[tris[:, 1]], P[tris[:, 2]]
    fn = np.cross(b - a, c - a)
    vn = np.zeros_like(P)
    for k in range(3):
        np.add.at(vn, tris[:, k], fn)
    return normalize(vn)


def const(value):
    return lambda P: np.full(len(P), value)


def drop_islands(bm, share=0.04):
    """Удаляет обрывки после выреза: куски меньше доли самого большого."""
    seen = set()
    islands = []
    for f in bm.faces:
        if f in seen:
            continue
        stack, island = [f], []
        seen.add(f)
        while stack:
            cur = stack.pop()
            island.append(cur)
            for e in cur.edges:
                for nf in e.link_faces:
                    if nf not in seen:
                        seen.add(nf)
                        stack.append(nf)
        islands.append(island)
    if not islands:
        return
    biggest = max(len(i) for i in islands)
    junk = [f for i in islands if len(i) < biggest * share for f in i]
    if junk:
        bmesh.ops.delete(bm, geom=junk, context='FACES')
    loose = [v for v in bm.verts if not v.link_faces]
    if loose:
        bmesh.ops.delete(bm, geom=loose, context='VERTS')


def make_shell(body, field, name, thickness, mat_name='cloth', taper=0.0,
               face_material=None, keep_keys=True, smooth=0, inflate_after_smooth=0.0):
    """Оболочка из части тела, вырезанная по изолинии поля.

    field(P) → «запас» для точек P: > 0 — вещь здесь есть, < 0 — нет. Рёбра,
    которые пересекает граница, режутся точно в нуле поля (морфы
    интерполируются вместе с вершиной), поэтому край вещи ровный, а не
    ступенькой по треугольникам. Оболочка наследует морфы тела и растёт
    вместе с мышцами.

    thickness(P) → толщина по нормали; taper — на сколько метров от края
    толщина плавно сходит на нет (волосы у линии роста)."""
    obj = body.copy()
    obj.data = body.data.copy()
    bpy.context.scene.collection.objects.link(obj)
    obj.name = name
    obj.data.name = name

    bm = bmesh.new()
    bm.from_mesh(obj.data)
    co = np.array([v.co[:] for v in bm.verts])
    f = field(co)
    # Сначала выкидываем то, что заведомо далеко от вещи, — меньше резать.
    margin = np.zeros(len(co), dtype=bool)
    margin[f > -0.03] = True
    bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not margin[v.index]], context='VERTS')
    if len(bm.verts) == 0:
        bm.free()
        bpy.data.objects.remove(obj)
        return None

    # Только треугольники: у четырёхугольника граница может пройти через две
    # точки, которые connect_verts не соединит, и на краю остаётся зазубрина.
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    value = bm.verts.layers.float.new('cut')
    vals = field(np.array([v.co[:] for v in bm.verts]))
    for v, fv in zip(bm.verts, vals):
        v[value] = float(fv)
    # Вершины ровно на нуле сдвигаем, чтобы знак был однозначным.
    for v in bm.verts:
        if abs(v[value]) < 1e-7:
            v[value] = 1e-7

    fresh = []
    for e in list(bm.edges):
        a, b = e.verts
        fa, fb = a[value], b[value]
        if (fa < 0) != (fb < 0):
            t = fa / (fa - fb)
            _, nv = bmesh.utils.edge_split(e, a, t)
            nv[value] = 0.0
            fresh.append(nv)
    fresh_set = set(fresh)
    for face in list(bm.faces):
        cut = [v for v in face.verts if v in fresh_set]
        if len(cut) == 2 and not any(e for e in face.edges if set(e.verts) == set(cut)):
            bmesh.ops.connect_verts(bm, verts=cut)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v[value] < 0], context='VERTS')
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    # Срез по изолинии иногда оставляет вырожденные треугольники — на
    # рендере это тёмные точки.
    bmesh.ops.dissolve_degenerate(bm, dist=1e-5, edges=bm.edges[:])
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    drop_islands(bm)
    bm.verts.index_update()
    edge_dist = np.array([v[value] for v in bm.verts])
    bm.verts.layers.float.remove(value)
    bm.to_mesh(obj.data)
    bm.free()

    me = obj.data
    if len(me.vertices) == 0:
        bpy.data.objects.remove(obj)
        return None
    if not keep_keys and me.shape_keys:
        obj.shape_key_clear()

    me.calc_loop_triangles()
    tris = np.empty(len(me.loop_triangles) * 3, dtype=np.int64)
    me.loop_triangles.foreach_get('vertices', tris)
    tris = tris.reshape(-1, 3)
    m = len(me.vertices)
    edges_arr = np.empty(len(me.edges) * 2, dtype=np.int64)
    me.edges.foreach_get('vertices', edges_arr)
    edges_arr = edges_arr.reshape(-1, 2)

    def read(key=None):
        P = np.empty(m * 3)
        (key.data if key else me.vertices).foreach_get('co', P)
        return P.reshape(-1, 3)

    base = read(me.shape_keys.key_blocks['Basis']) if me.shape_keys else read()
    thick = thickness(base)
    if taper > 0:
        thick = thick * (0.25 + 0.75 * smoothstep(0.0, taper, edge_dist))

    def offset(P):
        if smooth:
            # Обувь: сглаживаем форму, чтобы под ней не читались пальцы.
            boundary = np.zeros(m, dtype=bool)
            P = smooth_field(P, edges_arr, m, smooth)
            P = P + vertex_normals(P, tris) * inflate_after_smooth
            del boundary
        return P + vertex_normals(P, tris) * thick[:, None]

    if me.shape_keys:
        for key in me.shape_keys.key_blocks:
            moved = offset(read(key))
            key.data.foreach_set('co', moved.ravel())
            if key.name == 'Basis':
                me.vertices.foreach_set('co', moved.ravel())
        basis = read(me.shape_keys.key_blocks['Basis'])
        for key in list(me.shape_keys.key_blocks)[1:]:
            if np.abs(read(key) - basis).max() < 2e-4:
                obj.shape_key_remove(key)
        if len(me.shape_keys.key_blocks) == 1:
            obj.shape_key_clear()
    else:
        me.vertices.foreach_set('co', offset(base).ravel())

    me.materials.clear()
    me.materials.append(material(mat_name))
    if face_material:
        me.materials.append(material(face_material[0]))
        P = read()
        idx = np.array([1 if face_material[1](P[list(poly.vertices)]) else 0 for poly in me.polygons])
        me.polygons.foreach_set('material_index', idx)
    for p in me.polygons:
        p.use_smooth = True
    me.update()
    return obj


def make_shoe(name, points, lifter=False):
    """Кроссовок — выпуклая оболочка стопы: гладкий верх без пальцев,
    подошва — грани у пола вторым материалом."""
    bm = bmesh.new()
    for p in points:
        bm.verts.new(p)
    result = bmesh.ops.convex_hull(bm, input=bm.verts[:])
    junk = {g for g in result['geom_interior'] + result['geom_unused'] if isinstance(g, bmesh.types.BMVert)}
    bmesh.ops.delete(bm, geom=list(junk), context='VERTS')
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=2, use_grid_fill=True, smooth=0.0)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)

    m = len(me.vertices)
    P = np.empty(m * 3)
    me.vertices.foreach_get('co', P)
    P = P.reshape(-1, 3)
    me.calc_loop_triangles()
    tris = np.empty(len(me.loop_triangles) * 3, dtype=np.int64)
    me.loop_triangles.foreach_get('vertices', tris)
    tris = tris.reshape(-1, 3)
    edges = np.empty(len(me.edges) * 2, dtype=np.int64)
    me.edges.foreach_get('vertices', edges)
    edges = edges.reshape(-1, 2)
    # Сглаживание скругляет рёбра оболочки, раздув возвращает объём.
    P = smooth_field(P, edges, m, 6)
    P = P + vertex_normals(P, tris) * 0.007
    # Подошва — ровно на полу; у штангеток каблук выше спереди назад.
    floor = 0.0
    P[:, 2] = np.maximum(P[:, 2], floor)
    me.vertices.foreach_set('co', P.ravel())

    me.materials.append(material('cloth'))
    me.materials.append(material('sole'))
    sole_top = 0.028 if lifter else 0.018
    idx = np.array([1 if P[list(poly.vertices), 2].mean() < sole_top else 0 for poly in me.polygons])
    me.polygons.foreach_set('material_index', idx)
    for poly in me.polygons:
        poly.use_smooth = True
    me.update()

    if lifter:
        # Ремешок через подъём — полоса граней вторым материалом.
        cy = P[:, 1].mean()
        band = []
        for poly in me.polygons:
            c = P[list(poly.vertices)].mean(axis=0)
            band.append(1 if (cy - 0.04 < c[1] < cy - 0.01 and c[2] > 0.035) else idx[poly.index])
        me.polygons.foreach_set('material_index', np.array(band))
        me.update()
    return obj


def static_object(name, make, mat_name):
    """Неморфящаяся деталь (козырёк, венок, медаль) из примитива bpy."""
    bpy.ops.object.select_all(action='DESELECT')
    make()
    obj = bpy.context.active_object
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.name = name
    obj.data.materials.clear()
    obj.data.materials.append(material(mat_name))
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def join(objects, name):
    """Склеивает детали одной вещи. Морфы оболочки сохраняются: у
    приклеенных статичных деталей их значения просто равны базе."""
    objects = [o for o in objects if o]
    if not objects:
        return None
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    if len(objects) > 1:
        bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = name
    return obj


def build_clothes(sex, body, co, edges, lm, names, pw, segs):
    sz, hz, sx = lm['shoulder'][2], lm['hip'][2], lm['shoulder'][0]
    female = sex == 'f'
    waist = hz + (0.11 if female else 0.12)
    hem = hz - 0.03
    NO = -1.0

    def classify(P):
        """Часть тела и параметр вдоль кости для произвольных точек."""
        part_names, w = part_weights(P, segs)
        # Кисти висят у бёдер: всё, что дальше 4 см от оси кисти, кистью не
        # считаем — иначе на шортах у бока появляются зазубрины.
        for side in ('L', 'R'):
            a, b, _ = segs['hand' + side][0]
            dist = seg_coords(P, a, b)[1]
            col = part_names.index('hand' + side)
            w[dist > 0.04, col] = 0
        part = np.array(part_names)[w.argmax(axis=1)]
        info = {'part': part}
        for prefix in ('upperArm', 'forearm', 'thigh', 'shin'):
            t = np.zeros(len(P))
            length = np.zeros(len(P))
            for side in ('L', 'R'):
                a, b, _ = segs[prefix + side][0]
                ts, _, _, _, L = seg_coords(P, a, b)
                sel = part == prefix + side
                t[sel] = ts[sel]
                length[sel] = L
            info[prefix] = (t, length)
        return info

    def in_part(info, *prefixes):
        return np.isin(info['part'], [p + s for p in prefixes for s in ('', 'L', 'R')])

    def along(info, prefix, t0, keep_below=True):
        """Запас до среза кости на доле t0 (в метрах вдоль кости)."""
        t, L = info[prefix]
        return (t0 - t) * L if keep_below else (t - t0) * L

    # Ворот: плоскость ниже спереди, выше сзади, и только вокруг шеи.
    def neck_keep(P):
        x, y, z = P[:, 0], P[:, 1], P[:, 2]
        plane = (sz - 0.005 + 0.56 * y) - z
        ring = np.hypot(x, y - 0.015) - 0.095
        # Выше основания шеи ткани нет вовсе.
        return np.minimum(np.maximum(plane, ring), (sz + 0.07) - z)

    def shirt_torso(P):
        return np.minimum(P[:, 2] - hem, neck_keep(P))

    def tank_torso(P, scoop_x=0.085, scoop_z=0.12, scoop_c=0.01, arm_w=0.5, arm_h=0.17):
        x, y, z = P[:, 0], P[:, 1], P[:, 2]
        arm = (np.hypot((np.abs(x) - sx * 0.98) / (arm_w * sx), (z - sz - 0.02) / arm_h) - 1) * 0.08
        scoop_front = (np.hypot(x / scoop_x, (z - sz - scoop_c) / scoop_z) - 1) * 0.08
        scoop = np.minimum(np.where(y < 0, scoop_front, neck_keep(P)), (sz + 0.07) - z)
        return np.minimum.reduce([P[:, 2] - hem, arm, scoop])

    def garment(torso_fn=None, parts=None, default=NO):
        """Поле из кусков: для корпуса — torso_fn, для конечностей — parts.

        Значение части — число, функция (info, P) или 'torso': тогда для неё
        действует то же правило, что и для корпуса. Это нужно там, где край
        вещи проходит по стыку частей (подол на бёдрах): одно правило с обеих
        сторон стыка даёт ровный край, а не ступеньку по границе частей."""
        parts = parts or {}

        def field(P):
            info = classify(P)
            f = np.full(len(P), default)
            if torso_fn is not None:
                sel = in_part(info, 'torso')
                f[sel] = torso_fn(P[sel])
            for prefix, rule in parts.items():
                sel = in_part(info, prefix)
                if rule == 'torso':
                    f[sel] = torso_fn(P[sel])
                elif callable(rule):
                    f[sel] = rule(info, P)[sel]
                else:
                    f[sel] = rule
            return f
        return field

    made = {}

    def shell(name, field, th, **kw):
        made[name] = make_shell(body, field, name, th, **kw)
        return made[name]

    # --- верх. Подол может заходить на бёдра — там то же правило, что у корпуса.
    # Верх толще низа: где футболка заходит на шорты, она должна лежать поверх.
    if female:
        # Женской майке — вырез выше и проймы уже, иначе открыта грудь.
        tank_rule = lambda P: tank_torso(P, scoop_x=0.07, scoop_z=0.09, scoop_c=0.03, arm_w=0.42, arm_h=0.14)  # noqa: E731
    else:
        tank_rule = tank_torso
    shell('top_tank', garment(tank_rule, {'thigh': 'torso'}), const(0.0065))
    if female:
        def bra(P):
            # Спортивный топ: высокий вырез, узкие проймы, низ под грудью.
            return np.minimum(tank_torso(P, scoop_x=0.06, scoop_z=0.075, scoop_c=0.035, arm_w=0.42, arm_h=0.15),
                              P[:, 2] - (sz - 0.3))
        shell('top_bra', garment(bra), const(0.0065))
    shell('top_tee', garment(shirt_torso, {'thigh': 'torso', 'upperArm': lambda i, P: along(i, 'upperArm', 0.5)}),
          const(0.0065))
    sleeves = {'thigh': 'torso', 'upperArm': 1.0, 'forearm': lambda i, P: along(i, 'forearm', 0.93)}
    shell('top_longsleeve', garment(shirt_torso, sleeves), const(0.0068))
    shell('top_hoodie', garment(shirt_torso, sleeves), const(0.011))

    # --- низ
    def below_waist(P):
        return waist - P[:, 2]

    # Подол ниже ягодичной складки: горизонтальный срез через саму складку
    # выхватывал бы из неё кусок, и сзади на краю появлялись зазубрины.
    leg_hem_z = hz - 0.62 * (hz - lm['kneeL'][2])

    def shorts_rule(P):
        return np.minimum(waist - P[:, 2], P[:, 2] - leg_hem_z)

    # Подол шорт — по горизонтали и на корпусе, и на бёдрах: иначе сзади, у
    # ягодичной складки, край ступенькой идёт по стыку частей.
    shell('bottom_shorts', garment(shorts_rule, {'thigh': 'torso'}), const(0.0038))
    legs = {'thigh': 1.0, 'shin': lambda i, P: along(i, 'shin', 0.93)}
    shell('bottom_joggers', garment(below_waist, legs), const(0.0045))
    shell('bottom_tights', garment(below_waist, legs), const(0.0022))

    # --- обувь: выпуклая оболочка стопы — гладкая форма без пальцев.
    feet_field = garment(parts={'foot': 1.0, 'shin': lambda i, P: along(i, 'shin', 0.94, keep_below=False)})
    feet_mask = feet_field(co) > 0
    for name, lifter in (('shoes_sneakers', False), ('shoes_lifters', True)):
        pieces = [make_shoe(f'{name}_{side}', co[feet_mask & (co[:, 0] * s > 0)], lifter)
                  for s, side in ((1, 'L'), (-1, 'R'))]
        join(pieces, name)

    # --- аксессуары на руках и поясе
    shell('extra_gloves', garment(parts={'hand': 1.0, 'forearm': lambda i, P: along(i, 'forearm', 0.97, keep_below=False)}),
          const(0.0025))
    shell('extra_wristbands', garment(parts={'forearm': lambda i, P: np.minimum(
        along(i, 'forearm', 0.8, keep_below=False), along(i, 'forearm', 0.92))}), const(0.007))
    shell('extra_belt', garment(lambda P: np.minimum(P[:, 2] - (waist - 0.055), (waist + 0.012) - P[:, 2])),
          const(0.012))

    # --- голова. «up» — от уровня глаз, «fwd» — вперёд от центра головы.
    head_sel = np.isin(np.array(names)[pw.argmax(axis=1)], ['head'])
    hc = co[head_sel].mean(axis=0)
    top = co[:, 2].max()
    eye_z = top - 0.11

    def head_field(front0, front_k, back0, back_k, upper=None):
        def line(P, f0, fk, b0, bk):
            fwd = -(P[:, 1] - hc[1])
            blend = smoothstep(-0.03, 0.03, fwd)
            return (b0 + bk * fwd) * (1 - blend) + (f0 + fk * fwd) * blend

        def torso_like(info, P):
            up = P[:, 2] - eye_z
            f = up - line(P, front0, front_k, back0, back_k)
            if upper:
                f = np.minimum(f, line(P, *upper) - up)
            return f
        return garment(parts={'head': torso_like})

    scalp = head_field(0.035, 0.5, 0.035, 1.05)

    def head_up(P):
        return P[:, 2] - eye_z

    shell('hair_buzz', scalp, const(0.0025), mat_name='hair', taper=0.008)
    shell('hair_short', scalp, lambda P: 0.006 + 0.012 * smoothstep(0.02, 0.1, head_up(P)), mat_name='hair', taper=0.02)
    shell('hair_mohawk', scalp, lambda P: 0.002 + 0.04 * bump(P[:, 0] / 0.022) * smoothstep(0.0, 0.05, head_up(P)),
          mat_name='hair', taper=0.008)
    bun_base = make_shell(body, scalp, 'hair_bun', const(0.004), mat_name='hair', taper=0.015)
    tail_base = make_shell(body, scalp, 'hair_ponytail', const(0.004), mat_name='hair', taper=0.015)

    back_y = co[head_sel][:, 1].max()
    front_y = co[head_sel & (co[:, 2] > eye_z + 0.05) & (co[:, 2] < eye_z + 0.08)][:, 1].min()
    bun = static_object('bun_ball', lambda: bpy.ops.mesh.primitive_uv_sphere_add(
        radius=0.042, location=(0, back_y - 0.02, eye_z + 0.085)), 'hair')
    # Хвост: основание на затылке, свисает вниз и чуть назад. Ось конуса
    # после поворота на 20° вокруг X — (0, −sin, cos): вершина-основание вверху.
    tilt = math.radians(20)
    axis = Vector((0, -math.sin(tilt), math.cos(tilt)))
    root = Vector((0, back_y - 0.005, eye_z + 0.055))
    tail = static_object('tail', lambda: bpy.ops.mesh.primitive_cone_add(
        vertices=24, radius1=0.011, radius2=0.03, depth=0.22,
        location=root - axis * 0.11, rotation=(tilt, 0, 0)), 'hair')
    tie = static_object('tie', lambda: bpy.ops.mesh.primitive_torus_add(
        major_radius=0.026, minor_radius=0.007, location=root - axis * 0.018,
        rotation=(tilt, 0, 0)), 'cloth')
    join([bun_base, bun], 'hair_bun')
    join([tail_base, tail, tie], 'hair_ponytail')

    shell('head_headband', head_field(0.035, 0.45, 0.015, 0.4, upper=(0.062, 0.45, 0.042, 0.4)), const(0.006))
    cap_shell = make_shell(body, head_field(0.03, 0.45, 0.0, 0.4), 'head_cap', const(0.011))

    def make_brim():
        bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=1, depth=0.007,
                                            location=(0, front_y + 0.005, eye_z + 0.072))
        obj = bpy.context.active_object
        obj.scale = (0.095, 0.075, 1)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y > 0.004], context='VERTS')
        bm.to_mesh(obj.data)
        bm.free()
        obj.rotation_euler = (math.radians(8), 0, 0)

    brim = static_object('brim', make_brim, 'cloth')
    join([cap_shell, brim], 'head_cap')
    shell('head_beanie', head_field(0.0, 0.45, -0.03, 0.4), lambda P: 0.012 + 0.006 * smoothstep(0.03, 0.1, head_up(P)))

    leaves = []
    ring_z = eye_z + 0.045
    ring = co[head_sel & (np.abs(co[:, 2] - ring_z) < 0.006)]
    radius = (np.hypot(ring[:, 0], ring[:, 1] - hc[1]).mean() + 0.008) if len(ring) else 0.1
    for i in range(24):
        # 0° — затылок (+Y), 180° — лоб: венок открыт спереди.
        ang = math.radians(210 + i * (300 / 23))
        for layer in (-1, 1):
            loc = (math.sin(ang) * radius, hc[1] + math.cos(ang) * radius, ring_z + layer * 0.007)
            leaves.append(static_object(f'leaf{i}{layer}', lambda: bpy.ops.mesh.primitive_uv_sphere_add(
                segments=10, ring_count=6, radius=1, location=loc,
                rotation=(layer * 0.5, 0, -ang + math.pi / 2), scale=(0.024, 0.009, 0.005)), 'gold'))
    join(leaves, 'head_laurel')

    # --- медаль у грудины.
    torso_sel = np.isin(np.array(names)[pw.argmax(axis=1)], ['torso'])
    x, z = co[:, 0], co[:, 2]
    chest_z = sz - 0.17
    sternum_y = co[torso_sel & (np.abs(x) < 0.02) & (np.abs(z - chest_z) < 0.02)][:, 1].min()
    disc = static_object('disc', lambda: bpy.ops.mesh.primitive_cylinder_add(
        vertices=32, radius=0.03, depth=0.006, location=(0, sternum_y - 0.022, chest_z),
        rotation=(math.pi / 2, 0, 0)), 'gold')
    ribbons = []
    neck_front_y = co[torso_sel & (np.abs(np.abs(x) - 0.05) < 0.015) & (np.abs(z - (sz + 0.02)) < 0.02)][:, 1].min()
    for s in (1, -1):
        a = Vector((s * 0.05, neck_front_y - 0.006, sz + 0.02))
        b = Vector((s * 0.008, sternum_y - 0.02, chest_z + 0.025))
        mid, d = (a + b) / 2, (b - a)
        rot = d.to_track_quat('Z', 'Y').to_euler()
        ribbons.append(static_object(f'ribbon{s}', lambda: bpy.ops.mesh.primitive_cube_add(
            size=1, location=mid, rotation=rot, scale=(0.016, 0.003, d.length)), 'ribbon'))
    join([disc, *ribbons], 'extra_medal')

    # --- пряжка пояса и капюшон худи.
    buckle_y = co[torso_sel & (np.abs(x) < 0.02) & (np.abs(z - (waist - 0.02)) < 0.015)][:, 1].min()
    buckle = static_object('buckle', lambda: bpy.ops.mesh.primitive_cube_add(
        size=1, location=(0, buckle_y - 0.022, waist - 0.022), scale=(0.055, 0.008, 0.045)), 'gold')
    join([made['extra_belt'], buckle], 'extra_belt')
    neck_back_y = co[torso_sel & (np.abs(x) < 0.02) & (np.abs(z - (sz + 0.02)) < 0.02)][:, 1].max()
    hood_center_y = neck_back_y - 0.045

    def make_hood():
        bpy.ops.mesh.primitive_torus_add(major_radius=0.085, minor_radius=0.03,
                                         location=(0, hood_center_y, sz + 0.03))
        obj = bpy.context.active_object
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y < 0.01], context='VERTS')
        bm.to_mesh(obj.data)
        bm.free()
        obj.rotation_euler = (math.radians(-25), 0, 0)

    hood = static_object('hood', make_hood, 'cloth')
    join([made['top_hoodie'], hood], 'top_hoodie')


def export(sex, folder):
    os.makedirs(folder, exist_ok=True)
    path = os.path.abspath(os.path.join(folder, f'character_{sex}.glb'))
    for o in bpy.data.objects:
        o.select_set(o.type == 'MESH')
    opts = dict(filepath=path, export_format='GLB', use_selection=True, export_apply=False,
                export_morph=True, export_morph_normal=False, export_attributes=True,
                export_texcoords=False, export_normals=True, export_yup=True,
                export_animations=False, export_skins=False, export_cameras=False, export_lights=False)
    try:
        bpy.ops.export_scene.gltf(export_try_sparse_sk=True, **opts)
    except TypeError:
        bpy.ops.export_scene.gltf(**opts)
    print('EXPORT', path, round(os.path.getsize(path) / 1e6, 2), 'MB')
    return path


OUTFITS = [
    ('a', ['top_tee', 'bottom_shorts', 'shoes_sneakers', 'head_cap', 'extra_wristbands']),
    ('b', ['top_tank', 'bottom_joggers', 'shoes_lifters', 'hair_mohawk', 'extra_belt']),
    ('c', ['top_hoodie', 'bottom_tights', 'shoes_sneakers', 'head_beanie', 'extra_gloves']),
    ('d', ['top_longsleeve', 'bottom_shorts', 'hair_ponytail', 'head_headband', 'extra_medal']),
    ('e', ['top_bra', 'bottom_tights', 'hair_bun', 'head_laurel']),
]


def render_outfits(sex, folder):
    sys.path.append(os.path.dirname(__file__))
    import rutil_render as R  # noqa: E402
    R.setup_render((640, 900))
    body = bpy.data.objects['body']
    H = body.dimensions.z
    wear = [o for o in bpy.data.objects if o.type == 'MESH' and o.name not in ('body', 'eye_L', 'eye_R')]
    for tag, items in OUTFITS:
        for o in wear:
            o.hide_render = o.name not in items
        for value in (0.0, 1.0):
            for o in bpy.data.objects:
                if o.type == 'MESH' and o.data.shape_keys:
                    for k in o.data.shape_keys.key_blocks[1:]:
                        k.value = value
            for az, view in ((0.0, 'f'), (math.pi * 0.8, 'b')):
                R.shoot(os.path.join(folder, f'{sex}_outfit_{tag}_{int(value)}_{view}.png'),
                        target=(0, 0, H / 2), azimuth=az, ortho=H * 1.06)


# ---------------------------------------------------------------- main

def build(sex):
    spec = BODIES[sex]
    keep = set(o.name for o in bpy.data.objects)
    body, eyes = prepare_body(spec)
    # Исходники больше не нужны: остаются только собранные объекты.
    for o in list(bpy.data.objects):
        if o not in (body, *eyes):
            bpy.data.objects.remove(o, do_unlink=True)
    co, no, edges = mesh_arrays(body)
    lm = landmarks(spec, co)
    print('LANDMARKS', sex, {k: [round(float(x), 3) for x in v] for k, v in lm.items() if k[-1] in 'LR' and k[:-1] in ('elbow','wrist','knee','ankle')})
    deltas, region_index, names, pw, segs = build_muscle_deltas(co, no, edges, lm, spec['amp'])
    add_shape_keys(body, deltas)
    attr = body.data.attributes.new('_region', 'FLOAT', 'POINT')
    attr.data.foreach_set('value', region_index.astype(np.float64))
    body.data.materials.clear()
    body.data.materials.append(material('skin'))
    for eye in eyes:
        eye.data.materials.clear()
        eye.data.materials.append(material('eye'))
    print('BODY', sex, 'verts', len(body.data.vertices), 'faces', len(body.data.polygons), 'H', round(body.dimensions.z, 3))
    if PREVIEW:
        os.makedirs(PREVIEW, exist_ok=True)
        render_previews(body, PREVIEW, sex)
    if STAGE == 'all':
        build_clothes(sex, body, co, edges, lm, names, pw, segs)
        export(sex, OUT_DIR)
        if PREVIEW:
            render_outfits(sex, PREVIEW)
    return body, eyes, lm, keep


if __name__ == '__main__':
    # Один пол за запуск: сборка удаляет из сцены всё лишнее, включая второе
    # тело. Оба собирает scripts/blender/build_all.ps1.
    build(ONLY or 'm')
