import bpy, math, mathutils
def setup_render(res=(700, 900)):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'
    sc.display.shading.color_type = 'MATERIAL'
    sc.display.shading.show_cavity = True
    sc.display.shading.cavity_type = 'BOTH'
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.film_transparent = False
    sc.world = sc.world or bpy.data.worlds.new('W')
def shoot(path, target=(0, 0, 0.9), dist=3.2, azimuth=0.0, elev=0.05, ortho=1.95):
    sc = bpy.context.scene
    cam = bpy.data.objects.get('RCam')
    if not cam:
        cam = bpy.data.objects.new('RCam', bpy.data.cameras.new('RCam'))
        sc.collection.objects.link(cam)
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = ortho
    t = mathutils.Vector(target)
    d = mathutils.Vector((math.sin(azimuth), -math.cos(azimuth), elev)).normalized()
    cam.location = t + d * dist
    cam.rotation_euler = (t - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
