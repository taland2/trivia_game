# Extract Android cmdline-tools and install required SDK packages via sdkmanager.
# Run after cmdline-tools zip is fully downloaded.
# Idempotent: re-running is safe.

param(
    [string]$ZipPath = 'E:\dev\cmdline-tools.zip',
    [string]$AndroidHome = 'E:\dev\android-sdk'
)
$ErrorActionPreference = 'Stop'

if (-not (Test-Path $ZipPath)) {
    # Try curl download
    $ZipPath = 'E:\dev\cmdtools_curl.zip'
    if (-not (Test-Path $ZipPath)) { Write-Error "cmdline-tools zip not found"; return }
}
$expectedMB = 136
$actualMB = [math]::Round((Get-Item $ZipPath).Length/1MB, 1)
if ($actualMB -lt ($expectedMB * 0.95)) { Write-Error "Zip looks incomplete: ${actualMB}MB (expected ~${expectedMB}MB)"; return }

Write-Host "Extracting cmdline-tools from $ZipPath ..." -ForegroundColor Cyan
$tmpDir = 'E:\dev\_cmdtools_extract'
if (Test-Path $tmpDir) { Remove-Item $tmpDir -Recurse -Force }
Expand-Archive -Path $ZipPath -DestinationPath $tmpDir -Force

# Google zips cmdline-tools as: cmdline-tools/  (not versioned at root)
# Target layout: $ANDROID_HOME/cmdline-tools/latest/
$latestDir = Join-Path $AndroidHome 'cmdline-tools\latest'
if (Test-Path $latestDir) { Remove-Item $latestDir -Recurse -Force }
Move-Item (Join-Path $tmpDir 'cmdline-tools') $latestDir
Remove-Item $tmpDir -Recurse -Force -EA SilentlyContinue
Write-Host "cmdline-tools extracted to $latestDir" -ForegroundColor Green

# Accept licenses non-interactively
$sdkmanager = Join-Path $latestDir 'bin\sdkmanager.bat'
if (-not (Test-Path $sdkmanager)) { Write-Error "sdkmanager not found at $sdkmanager"; return }

Write-Host "Accepting Android licenses ..." -ForegroundColor Cyan
$env:JAVA_HOME = 'E:\dev\java\17'
"y`ny`ny`ny`ny`ny`ny`ny" | & $sdkmanager --licenses --sdk_root=$AndroidHome 2>&1 | Select-Object -Last 5

# Install required SDK packages (doc 06 §1: min Android 10 = API 29)
$packages = @('platform-tools', 'build-tools;34.0.0', 'platforms;android-29', 'platforms;android-35')
Write-Host "Installing SDK packages: $($packages -join ', ') ..." -ForegroundColor Cyan
& $sdkmanager --sdk_root=$AndroidHome @packages 2>&1

Write-Host "Android SDK setup complete at $AndroidHome" -ForegroundColor Green
Write-Host "  - platform-tools (adb)" -ForegroundColor Cyan
Write-Host "  - build-tools;34.0.0" -ForegroundColor Cyan
Write-Host "  - platforms;android-29 (min API)" -ForegroundColor Cyan
Write-Host "  - platforms;android-35 (latest)" -ForegroundColor Cyan
