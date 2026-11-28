# Пересобирает модели персонажа: client/public/models/character_{m,f}.glb.
# Нужны Blender 5.x и набор «Human Base Meshes» (CC0) с blender.org.
param(
  [string]$Blender = 'D:\blender\blender.exe',
  [string]$Bundle = 'D:\blender\assets\hbm\human-base-meshes-bundle-v1.4.1\human_base_meshes_bundle.blend',
  [string]$Preview = ''
)
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$script = Join-Path $PSScriptRoot 'build_character.py'
$out = Join-Path $root 'client\public\models'
foreach ($sex in 'm', 'f') {
  $extra = @()
  if ($Preview) { $extra = @('--preview', $Preview) }
  & $Blender -b --factory-startup $Bundle -P $script -- --only $sex --out $out @extra
}
