# One-command dev startup (doc 15, Phase 0).
# Installs JS deps if missing, builds functions, starts the Firebase emulator suite
# against the offline demo project (until trivia-dev exists).

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

if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
    Write-Error 'Firebase CLI not found. Install with: npm i -g firebase-tools'
}
if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
    Write-Warning 'Java 17 not found - the Firestore emulator will not start (Functions/Auth emulators may still work).'
}

Write-Host 'Starting Firebase emulator suite (demo project, offline)...' -ForegroundColor Cyan
Push-Location (Join-Path $root 'firebase')
firebase emulators:start --project demo-trivia-dev
Pop-Location
