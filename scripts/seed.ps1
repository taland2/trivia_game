# Seed the running emulator with dev data (Phase 6a).
# Run this in a SECOND terminal AFTER `.\scripts\dev.ps1` has the emulator suite
# up — it writes the question bank and the dev friend profiles the duel flow
# needs. Both seeders are idempotent (stable doc ids), so re-running is safe.
#
# Usage:
#   .\scripts\seed.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
# The seeders import firebase-admin, which is only installed under functions/.
# There is no root-level node install, so point Node's module resolver there.
$env:NODE_PATH = Join-Path $root 'functions\node_modules'
Push-Location $root
try {
    Write-Host 'Seeding questions...' -ForegroundColor Cyan
    npx tsx scripts/seed-questions.ts

    Write-Host 'Seeding friend profiles...' -ForegroundColor Cyan
    npx tsx scripts/seed-friends.ts

    Write-Host 'Seed complete.' -ForegroundColor Green
} finally {
    Pop-Location
}
