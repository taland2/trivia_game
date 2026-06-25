# One-command "run the app on my phone" (doc 15, dev loop).
#
# Does EVERYTHING needed end-to-end:
#   1. Picks a Java 21+ runtime (Firebase CLI now requires >= 21).
#   2. Builds the Cloud Functions.
#   3. Starts the Firebase emulator suite (auth + functions + firestore only;
#      Pub/Sub is skipped on purpose -- it crashes on this machine and is only
#      needed for the scheduled forfeit sweep, not for manual play).
#   4. Waits until the emulator ports are actually accepting connections.
#   5. Seeds the question bank + dev friend profiles (idempotent).
#   6. Sets up adb reverse so 'localhost' on the phone reaches this PC.
#   7. Launches the app on the connected device with the dev flavor.
#   8. Shuts the emulators down cleanly when you quit flutter (press q).
#
# Usage (from repo root):
#   .\scripts\run.ps1
#
# Prereqs: phone plugged in with USB debugging enabled & authorized.

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

# --- 1. Java 21+ -------------------------------------------------------------
Write-Step 'Locating a Java 21+ runtime'
$javaCandidates = @(
    $env:JAVA_HOME,
    (Join-Path ${env:ProgramFiles} 'Android\Android Studio\jbr'),
    (Join-Path ${env:LOCALAPPDATA} 'Programs\Android Studio\jbr'),
    (Join-Path ${env:ProgramFiles} 'Eclipse Adoptium\jdk-21'),
    'E:\dev\java\21'
) | Where-Object { $_ -and (Test-Path (Join-Path $_ 'bin\java.exe')) }

$javaHome = $null
foreach ($cand in $javaCandidates) {
    # Read the major version from the JDK's 'release' file (JAVA_VERSION="21.0.10")
    # instead of running `java -version`, whose stderr output trips $ErrorActionPreference.
    $releaseFile = Join-Path $cand 'release'
    if (-not (Test-Path $releaseFile)) { continue }
    $verLine = Get-Content $releaseFile | Where-Object { $_ -match '^JAVA_VERSION=' } | Select-Object -First 1
    if ($verLine -match 'JAVA_VERSION="(\d+)') {
        $major = [int]$Matches[1]
        if ($major -ge 21) { $javaHome = $cand; break }
    }
}
if (-not $javaHome) {
    Write-Error 'No Java 21+ runtime found. Install JDK 21 (or Android Studio, which bundles one) and re-run.'
}
$env:JAVA_HOME = $javaHome
$env:PATH = (Join-Path $javaHome 'bin') + [IO.Path]::PathSeparator + $env:PATH
Write-Host "  Using Java at $javaHome" -ForegroundColor Green

# --- 2. Install deps + build functions --------------------------------------
foreach ($pkg in @('packages\api_contract', 'functions')) {
    $dir = Join-Path $root $pkg
    if ((Test-Path $dir) -and -not (Test-Path (Join-Path $dir 'node_modules'))) {
        Write-Step "Installing deps in $pkg"
        Push-Location $dir; npm install; Pop-Location
    }
}
Write-Step 'Building Cloud Functions'
Push-Location (Join-Path $root 'functions'); npm run build; Pop-Location

# --- 3. Start emulators in the background -----------------------------------
Write-Step 'Starting Firebase emulators (auth, functions, firestore)'
$emuLog = Join-Path $root 'firebase\emulators.out.log'
if (Test-Path $emuLog) { Remove-Item $emuLog -Force }
# `firebase` is a .cmd shim (not a Win32 exe), so launch it via cmd.exe. The
# child node/java processes form a tree under this cmd, which taskkill /T tears down.
$emu = Start-Process -FilePath $env:ComSpec `
    -ArgumentList @('/c', 'firebase emulators:start --project demo-trivia-dev --only auth,functions,firestore') `
    -WorkingDirectory (Join-Path $root 'firebase') `
    -RedirectStandardOutput $emuLog -RedirectStandardError (Join-Path $root 'firebase\emulators.err.log') `
    -PassThru -NoNewWindow

try {
    # --- 4. Wait for the ports to accept connections ------------------------
    Write-Step 'Waiting for emulators to be ready'
    function Test-Port($port) {
        try {
            $c = New-Object Net.Sockets.TcpClient
            $c.Connect('127.0.0.1', $port); $c.Close(); return $true
        } catch { return $false }
    }
    $deadline = (Get-Date).AddSeconds(90)
    while ((Get-Date) -lt $deadline) {
        if ($emu.HasExited) { Write-Error "Emulators exited early. See $emuLog" }
        if ((Test-Port 9099) -and (Test-Port 8088) -and (Test-Port 5001)) { break }
        Start-Sleep -Milliseconds 800
    }
    if (-not ((Test-Port 9099) -and (Test-Port 8088) -and (Test-Port 5001))) {
        Write-Error "Emulators did not become ready in time. See $emuLog"
    }
    Write-Host '  Auth :9099, Functions :5001, Firestore :8088 ready' -ForegroundColor Green

    # --- 5. Seed data (idempotent) -----------------------------------------
    Write-Step 'Seeding questions + dev friends + daily sets'
    $env:NODE_PATH = Join-Path $root 'functions\node_modules'
    Push-Location $root
    npx tsx scripts/seed-questions.ts
    npx tsx scripts/seed-friends.ts
    npx tsx scripts/seed-daily.ts
    Pop-Location

    # --- 6. adb reverse (phone -> this PC) ----------------------------------
    Write-Step 'Forwarding emulator ports to the phone (adb reverse)'
    if (Get-Command adb -ErrorAction SilentlyContinue) {
        $devices = (adb devices) | Select-String -Pattern '\tdevice$'
        if (-not $devices) {
            Write-Warning 'No authorized device found by adb. Plug in the phone, unlock it,'
            Write-Warning 'set USB mode to File Transfer, and tap "Allow USB debugging". Then re-run.'
        } else {
            adb reverse tcp:9099 tcp:9099 | Out-Null
            adb reverse tcp:5001 tcp:5001 | Out-Null
            adb reverse tcp:8088 tcp:8088 | Out-Null
            Write-Host '  Ports forwarded over USB' -ForegroundColor Green
        }
    } else {
        Write-Warning 'adb not on PATH; skipping port forwarding.'
    }

    # --- 7. Run the app -----------------------------------------------------
    Write-Step 'Launching the app (dev flavor). Press q in this window to quit.'
    Push-Location (Join-Path $root 'app')
    flutter run --flavor dev -t lib/main_dev.dart
    Pop-Location
}
finally {
    # --- 8. Tear down emulators (and their child java procs) ----------------
    Write-Step 'Shutting down emulators'
    if ($emu -and -not $emu.HasExited) {
        taskkill /T /F /PID $emu.Id 2>$null | Out-Null
    }
}
