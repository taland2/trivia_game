# One-command dev startup (doc 15, Phase 1).
# Installs JS deps if missing, builds functions, sets up adb port-forwarding for
# the physical Android device, then starts the Firebase emulator suite.
#
# Usage:
#   1. In terminal A: .\scripts\dev.ps1          <- starts emulators (blocking)
#   2. In terminal B: cd app && flutter run --flavor dev -t lib/main_dev.dart

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent

foreach ($pkg in @('packages\api_contract', 'functions')) {
    $dir = Join-Path $root $pkg
    if (-not (Test-Path (Join-Path $dir 'node_modules'))) {
        Write-Host "Installing deps in $pkg..." -ForegroundColor Cyan
        Push-Location $dir; npm install; Pop-Location
    }
}

Write-Host 'Building functions...' -ForegroundColor Cyan
Push-Location (Join-Path $root 'functions'); npm run build; Pop-Location

# Forward emulator ports to the physical Android device over USB.
# Without this, 'localhost' on the device can't reach the dev machine.
# Safe to skip if the device isn't connected (adb exits silently).
if (Get-Command adb -ErrorAction SilentlyContinue) {
    Write-Host 'Setting up adb reverse for physical device...' -ForegroundColor Cyan
    adb reverse tcp:9099 tcp:9099 2>$null
    adb reverse tcp:5001 tcp:5001 2>$null
    adb reverse tcp:8088 tcp:8088 2>$null
    Write-Host '  Auth :9099, Functions :5001, Firestore :8088 forwarded' -ForegroundColor Green
} else {
    Write-Warning 'adb not found — skipping port forwarding. Add android-sdk/platform-tools to PATH.'
}

if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
    Write-Error 'Firebase CLI not found. Install with: npm i -g firebase-tools'
}
if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
    Write-Warning 'Java 17 not found - the Firestore emulator will not start.'
}

Write-Host 'Starting Firebase emulator suite (demo project, offline)...' -ForegroundColor Cyan
Write-Host '  Emulator UI: http://localhost:4000' -ForegroundColor DarkGray
Push-Location (Join-Path $root 'firebase')
firebase emulators:start --project demo-trivia-dev
Pop-Location
