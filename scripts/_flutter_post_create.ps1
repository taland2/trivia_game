# Internal script: run ONCE after `flutter create` to add the Phase 0 scaffolding.
# Called automatically from scripts/dev.ps1 setup flow.

param(
    [string]$AppDir = (Join-Path (Split-Path $PSScriptRoot -Parent) 'app')
)
$ErrorActionPreference = 'Stop'

if (-not (Test-Path (Join-Path $AppDir 'pubspec.yaml'))) {
    Write-Error "Flutter project not found at $AppDir — run flutter create first."
}

Write-Host "Applying Phase 0 scaffolding to $AppDir ..." -ForegroundColor Cyan

# --- 1. pubspec.yaml: add firebase_core dependency ---------------------
$pubspec = Join-Path $AppDir 'pubspec.yaml'
$content = Get-Content $pubspec -Raw
if ($content -notmatch 'firebase_core') {
    $content = $content -replace '(dependencies:\r?\n  flutter:\r?\n    sdk: flutter)', @'
dependencies:
  flutter:
    sdk: flutter
  firebase_core: ^3.0.0
'@
    Set-Content $pubspec $content -Encoding utf8NoBOM
    Write-Host "  [pubspec] Added firebase_core" -ForegroundColor Green
}

# --- 2. Android build.gradle: add productFlavors ----------------------
$gradle = Join-Path $AppDir 'android\app\build.gradle'
$gradleContent = Get-Content $gradle -Raw
if ($gradleContent -notmatch 'productFlavors') {
    $flavorBlock = @'

    flavorDimensions = ["environment"]
    productFlavors {
        dev {
            dimension "environment"
            applicationIdSuffix ".dev"
            versionNameSuffix "-dev"
            resValue "string", "app_name", "Trivia (dev)"
        }
        staging {
            dimension "environment"
            applicationIdSuffix ".staging"
            versionNameSuffix "-staging"
            resValue "string", "app_name", "Trivia (staging)"
        }
        prod {
            dimension "environment"
            resValue "string", "app_name", "Trivia"
        }
    }
'@
    # Insert before the closing brace of android { ... }
    $gradleContent = $gradleContent -replace '(\}\s*$)', "$flavorBlock`n}"
    Set-Content $gradle $gradleContent -Encoding utf8NoBOM
    Write-Host "  [gradle] Added productFlavors (dev/staging/prod)" -ForegroundColor Green
}

Write-Host "Phase 0 scaffolding applied. Run: flutter run --flavor dev -t lib/main_dev.dart" -ForegroundColor Cyan
