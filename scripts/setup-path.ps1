# One-time user PATH setup for all dev tools (doc 15 Phase 0).
# Run as the user (not admin) — modifies HKCU path only.
# Re-running is safe (idempotent).

$ErrorActionPreference = 'Stop'

$additions = @(
    'E:\dev\flutter\bin',
    'E:\dev\android-sdk\platform-tools',
    'E:\dev\android-sdk\cmdline-tools\latest\bin',
    'E:\dev\java\21\bin'
)

$currentUser = [System.Environment]::GetEnvironmentVariable('PATH', 'User')
$parts = $currentUser -split ';' | Where-Object { $_ -ne '' }

$added = @()
foreach ($p in $additions) {
    if ($parts -notcontains $p) {
        $parts += $p
        $added += $p
    }
}

if ($added.Count -gt 0) {
    [System.Environment]::SetEnvironmentVariable('PATH', ($parts -join ';'), 'User')
    Write-Host "Added to user PATH:" -ForegroundColor Green
    $added | ForEach-Object { Write-Host "  + $_" -ForegroundColor Cyan }
    Write-Host "Restart your terminal (or open a new PowerShell window) to pick up the changes." -ForegroundColor Yellow
} else {
    Write-Host "All paths already present — nothing changed." -ForegroundColor Green
}

# Also set ANDROID_HOME for this session and permanently
$androidHome = 'E:\dev\android-sdk'
[System.Environment]::SetEnvironmentVariable('ANDROID_HOME', $androidHome, 'User')
[System.Environment]::SetEnvironmentVariable('JAVA_HOME', 'E:\dev\java\21', 'User')
Write-Host "Set ANDROID_HOME=$androidHome and JAVA_HOME=E:\dev\java\17" -ForegroundColor Cyan
