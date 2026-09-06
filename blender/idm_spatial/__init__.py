bl_info = {
    "name": "InstantDrama Spatial",
    "author": "YSK Limited",
    "version": (1, 0, 0),
    "blender": (3, 6, 0),
    "location": "View3D > Sidebar > IDM",
    "description": "Read/write idm-spatial-package via instant-drama CLI (not a video backend).",
    "category": "Import-Export",
    "doc_url": "https://github.com/yanshekki/instant-drama-magician/blob/main/docs/blender.md",
}

import json
import os
import subprocess
import bpy
from bpy.props import StringProperty, BoolProperty
from mathutils import Vector


ADDON_ID = __name__


def _prefs():
    return bpy.context.preferences.addons[ADDON_ID].preferences


def invoke_idm(channel, payload, extra_args=None):
    prefs = _prefs()
    cli = prefs.cli_path.strip() or "instant-drama"
    args = [
        cli,
        "invoke",
        channel,
        "--args",
        json.dumps([payload], ensure_ascii=False),
        "--json",
        "--local",
    ]
    data_dir = prefs.data_dir.strip()
    if data_dir:
        args.extend(["--data-dir", data_dir])
    if extra_args:
        args.extend(extra_args)
    env = os.environ.copy()
    completed = subprocess.run(
        args,
        check=False,
        capture_output=True,
        text=True,
        env=env,
    )
    if completed.returncode != 0:
        raise RuntimeError(
            completed.stderr.strip() or completed.stdout.strip() or "instant-drama failed"
        )
    raw = completed.stdout.strip()
    data = json.loads(raw)
    if isinstance(data, dict) and "result" in data:
        return data["result"]
    return data


def blocking_from_scene(scene):
    markers = []
    cam = scene.camera
    camera = {
        "x": 0.5,
        "y": 0.18,
        "z": 0.08,
        "fov": 35,
        "lookAtX": 0.5,
        "lookAtY": 0.12,
        "lookAtZ": 0.55,
    }
    for obj in scene.objects:
        name = obj.name
        if not name.startswith("IDM|"):
            continue
        parts = name.split("|")
        if len(parts) < 3:
            continue
        kind, entity_id = parts[1], parts[2]
        loc = obj.location
        markers.append(
            {
                "id": "{}:{}".format(kind, entity_id),
                "entityId": entity_id,
                "kind": kind,
                "name": obj.get("idm_name", entity_id),
                "x": max(0.0, min(1.0, loc.x / 8.0 + 0.5)),
                "z": max(0.0, min(1.0, loc.y / 8.0 + 0.5)),
                "y": loc.z,
                "yaw": obj.rotation_euler.z,
            }
        )
    if cam:
        camera["x"] = max(0.0, min(1.0, cam.location.x / 8.0 + 0.5))
        camera["z"] = max(0.0, min(1.0, cam.location.y / 8.0 + 0.5))
        camera["y"] = cam.location.z
        if cam.data and getattr(cam.data, "angle", None):
            import math

            camera["fov"] = max(12, min(90, math.degrees(cam.data.angle)))
    return {
        "version": 1,
        "aspect": scene.idm_aspect if hasattr(scene, "idm_aspect") else "16:9",
        "markers": markers,
        "camera": camera,
    }


def apply_blocking(blocking):
    col_name = "IDM Spatial"
    col = bpy.data.collections.get(col_name)
    if col is None:
        col = bpy.data.collections.new(col_name)
        bpy.context.scene.collection.children.link(col)
    for obj in list(col.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for marker in blocking.get("markers") or []:
        kind = marker.get("kind") or "prop"
        entity_id = marker.get("entityId") or "id"
        empty = bpy.data.objects.new(
            "IDM|{}|{}".format(kind, entity_id), None
        )
        empty.empty_display_type = "PLAIN_AXES"
        empty.location = Vector(
            (
                (float(marker.get("x", 0.5)) - 0.5) * 8.0,
                (float(marker.get("z", 0.5)) - 0.5) * 8.0,
                float(marker.get("y") or 0.0),
            )
        )
        empty["idm_name"] = marker.get("name") or entity_id
        col.objects.link(empty)
    cam_data = bpy.data.cameras.new("IDM Camera")
    cam_obj = bpy.data.objects.new("IDM Camera", cam_data)
    cam = blocking.get("camera") or {}
    cam_obj.location = Vector(
        (
            (float(cam.get("x", 0.5)) - 0.5) * 8.0,
            (float(cam.get("z", 0.08)) - 0.5) * 8.0,
            float(cam.get("y") or 1.4),
        )
    )
    col.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj


class IDMSpatialPrefs(bpy.types.AddonPreferences):
    bl_idname = ADDON_ID
    cli_path: StringProperty(
        name="instant-drama CLI",
        subtype="FILE_PATH",
        default="instant-drama",
    )
    data_dir: StringProperty(
        name="IDM data directory",
        subtype="DIR_PATH",
        default="",
    )

    def draw(self, context):
        layout = self.layout
        layout.prop(self, "cli_path")
        layout.prop(self, "data_dir")
        layout.label(text="The add-on is a client of spatial:* channels. It does not render final video.")


class IDM_OT_compile_beat(bpy.types.Operator):
    bl_idname = "idm.compile_beat"
    bl_label = "Compile beat from InstantDrama"
    bl_options = {"REGISTER", "UNDO"}

    def execute(self, context):
        scene = context.scene
        try:
            payload = {
                "storyId": scene.idm_story_id,
                "entryId": scene.idm_entry_id,
            }
            dest = scene.idm_package_dir.strip() if scene.idm_package_dir else ""
            if dest:
                payload["destDir"] = dest
            result = invoke_idm("spatial:compileBeat", payload)
        except Exception as exc:
            self.report({"ERROR"}, str(exc))
            return {"CANCELLED"}
        blocking = result.get("blocking") if isinstance(result, dict) else None
        if blocking:
            apply_blocking(blocking)
        self.report({"INFO"}, "Compiled idm-spatial-package")
        return {"FINISHED"}


class IDM_OT_import_package(bpy.types.Operator):
    bl_idname = "idm.import_package"
    bl_label = "Import spatial package directory"
    bl_options = {"REGISTER", "UNDO"}

    directory: StringProperty(subtype="DIR_PATH")

    def invoke(self, context, event):
        context.window_manager.fileselect_add(self)
        return {"RUNNING_MODAL"}

    def execute(self, context):
        scene = context.scene
        package_dir = self.directory.rstrip(os.sep)
        try:
            result = invoke_idm(
                "spatial:importPackage",
                {
                    "storyId": scene.idm_story_id,
                    "entryId": scene.idm_entry_id,
                    "packageDir": package_dir,
                },
            )
        except Exception as exc:
            self.report({"ERROR"}, str(exc))
            return {"CANCELLED"}
        blocking = result.get("blocking") if isinstance(result, dict) else None
        if blocking:
            apply_blocking(blocking)
        man_path = os.path.join(package_dir, "manifest.json")
        if os.path.isfile(man_path):
            with open(man_path, "r", encoding="utf-8") as fh:
                man = json.load(fh)
            if man.get("blocking"):
                apply_blocking(man["blocking"])
        self.report({"INFO"}, "Imported spatial package")
        return {"FINISHED"}


class IDM_OT_export_blocking(bpy.types.Operator):
    bl_idname = "idm.export_blocking"
    bl_label = "Push blocking to InstantDrama"
    bl_options = {"REGISTER"}

    use_playblast_as_first_frame: BoolProperty(default=False)

    def execute(self, context):
        scene = context.scene
        blocking = blocking_from_scene(scene)
        payload = {
            "storyId": scene.idm_story_id,
            "entryId": scene.idm_entry_id,
            "blocking": blocking,
            "usePlayblastAsFirstFrame": self.use_playblast_as_first_frame,
        }
        play_path = scene.idm_playblast_path.strip()
        if play_path:
            payload["playblastPath"] = play_path
        try:
            invoke_idm("spatial:attachRef", payload)
        except Exception as exc:
            self.report({"ERROR"}, str(exc))
            return {"CANCELLED"}
        self.report({"INFO"}, "Pushed blocking / playblast")
        return {"FINISHED"}


class IDM_OT_render_playblast(bpy.types.Operator):
    bl_idname = "idm.render_playblast"
    bl_label = "OpenGL playblast PNG then attach"
    bl_options = {"REGISTER"}

    def execute(self, context):
        scene = context.scene
        out = scene.idm_playblast_path.strip()
        if not out:
            out = os.path.join(bpy.app.tempdir, "idm-playblast.png")
            scene.idm_playblast_path = out
        scene.render.filepath = out
        scene.render.image_settings.file_format = "PNG"
        bpy.ops.render.opengl(write_still=True)
        try:
            invoke_idm(
                "spatial:attachRef",
                {
                    "storyId": scene.idm_story_id,
                    "entryId": scene.idm_entry_id,
                    "playblastPath": out,
                    "blocking": blocking_from_scene(scene),
                },
            )
        except Exception as exc:
            self.report({"ERROR"}, str(exc))
            return {"CANCELLED"}
        self.report({"INFO"}, "Attached playblast {}".format(out))
        return {"FINISHED"}


class IDM_OT_generate_mesh(bpy.types.Operator):
    bl_idname = "idm.generate_mesh"
    bl_label = "Generate textured-plane glTF proxy"
    bl_options = {"REGISTER"}

    def execute(self, context):
        scene = context.scene
        try:
            result = invoke_idm(
                "spatial:generateMesh",
                {
                    "storyId": scene.idm_story_id,
                    "entryId": scene.idm_entry_id,
                    "entityType": scene.idm_mesh_entity_type or "prop",
                    "entityId": scene.idm_mesh_entity_id,
                },
            )
        except Exception as exc:
            self.report({"ERROR"}, str(exc))
            return {"CANCELLED"}
        mesh = result.get("mesh") if isinstance(result, dict) else None
        path = mesh.get("path") if isinstance(mesh, dict) else None
        if path and os.path.isfile(path):
            try:
                bpy.ops.import_scene.gltf(filepath=path)
            except Exception:
                self.report({"WARNING"}, "Wrote {} (import glTF add-on may be off)".format(path))
                return {"FINISHED"}
        self.report({"INFO"}, "Proxy mesh ready")
        return {"FINISHED"}


class IDM_PT_spatial(bpy.types.Panel):
    bl_label = "InstantDrama Spatial"
    bl_idname = "IDM_PT_spatial"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "IDM"

    def draw(self, context):
        layout = self.layout
        scene = context.scene
        layout.prop(scene, "idm_story_id")
        layout.prop(scene, "idm_entry_id")
        layout.prop(scene, "idm_package_dir")
        layout.prop(scene, "idm_playblast_path")
        col = layout.column(align=True)
        col.operator("idm.compile_beat")
        col.operator("idm.import_package")
        col.operator("idm.export_blocking")
        col.operator("idm.render_playblast")
        layout.separator()
        layout.prop(scene, "idm_mesh_entity_type")
        layout.prop(scene, "idm_mesh_entity_id")
        layout.operator("idm.generate_mesh")
        layout.label(text="Proxies are billboards. Costumes are dressed stills, not cloth.")


classes = (
    IDMSpatialPrefs,
    IDM_OT_compile_beat,
    IDM_OT_import_package,
    IDM_OT_export_blocking,
    IDM_OT_render_playblast,
    IDM_OT_generate_mesh,
    IDM_PT_spatial,
)


def register():
    for cls in classes:
        bpy.utils.register_class(cls)
    bpy.types.Scene.idm_story_id = StringProperty(name="Story ID")
    bpy.types.Scene.idm_entry_id = StringProperty(name="Beat / entry ID")
    bpy.types.Scene.idm_package_dir = StringProperty(
        name="Package directory", subtype="DIR_PATH"
    )
    bpy.types.Scene.idm_playblast_path = StringProperty(
        name="Playblast PNG", subtype="FILE_PATH"
    )
    bpy.types.Scene.idm_mesh_entity_type = StringProperty(
        name="Mesh entity type", default="prop"
    )
    bpy.types.Scene.idm_mesh_entity_id = StringProperty(name="Mesh entity ID")
    bpy.types.Scene.idm_aspect = StringProperty(name="Aspect", default="16:9")


def unregister():
    del bpy.types.Scene.idm_story_id
    del bpy.types.Scene.idm_entry_id
    del bpy.types.Scene.idm_package_dir
    del bpy.types.Scene.idm_playblast_path
    del bpy.types.Scene.idm_mesh_entity_type
    del bpy.types.Scene.idm_mesh_entity_id
    del bpy.types.Scene.idm_aspect
    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)


if __name__ == "__main__":
    register()
