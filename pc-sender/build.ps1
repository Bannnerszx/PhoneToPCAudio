# Builds the PCAudio Windows app into pc-sender\build\:
#   dist\PCAudio\PCAudio.exe   the app (PyInstaller; no Python needed to run it)
#   PCAudioSetup.exe           the installer (only if Inno Setup 6 is installed)
#
# Usage: powershell -ExecutionPolicy Bypass -File pc-sender\build.ps1

$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
$build = Join-Path $here 'build'
New-Item -ItemType Directory -Force $build | Out-Null

function Invoke-Checked {
    & $args[0] $args[1..($args.Count - 1)]
    if ($LASTEXITCODE -ne 0) { throw "Failed: $args" }
}

Invoke-Checked python -m pip install --disable-pip-version-check -r (Join-Path $here 'requirements.txt') pyinstaller
Invoke-Checked python (Join-Path $here 'icon.py') (Join-Path $build 'pcaudio.ico')

# --windowed: no console window. pystray picks its backend at runtime, so
# PyInstaller can't see it without the hidden import. numpy is excluded because
# Pillow would otherwise pull in 25 MB of it.
Invoke-Checked python -m PyInstaller --noconfirm --clean --windowed `
    --name PCAudio `
    --icon (Join-Path $build 'pcaudio.ico') `
    --hidden-import pystray._win32 `
    --exclude-module numpy `
    --distpath (Join-Path $build 'dist') `
    --workpath (Join-Path $build 'work') `
    --specpath $build `
    (Join-Path $here 'tray.py')

$iscc = @(
    (Get-Command iscc -ErrorAction SilentlyContinue).Source,
    "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
    "$env:ProgramFiles\Inno Setup 6\ISCC.exe",
    "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe"
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

if ($iscc) {
    Invoke-Checked $iscc /Qp (Join-Path $here 'installer.iss')
    Write-Host "Built $(Join-Path $build 'PCAudioSetup.exe')"
} else {
    Write-Host "Built $(Join-Path $build 'dist\PCAudio\PCAudio.exe')"
    Write-Host 'Inno Setup 6 not found, so no installer was built (CI installs it).'
}
