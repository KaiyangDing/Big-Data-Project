# ─────────────────────────────────────────────────────────────
# SkyPath Analytics - Extract pre-processed data from data.zip (Windows)
#
# Takes the team-shared data.zip and places its contents at the layout
# expected by docker-compose.yml.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\setup_data.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\setup_data.ps1 C:\path\to\data.zip
# ─────────────────────────────────────────────────────────────
param([string]$ZipPath)

$ErrorActionPreference = "Stop"

$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$DATA_DIR = Join-Path $PROJECT_ROOT "data"

Write-Host "=== SkyPath Analytics - Data Setup ===" -ForegroundColor Cyan
Write-Host "Repo root: $PROJECT_ROOT"

# 1. Locate data.zip
if (-not $ZipPath) {
    $candidate1 = Join-Path (Split-Path -Parent $PROJECT_ROOT) "data.zip"
    $candidate2 = Join-Path $PROJECT_ROOT "data.zip"
    if (Test-Path $candidate1)       { $ZipPath = $candidate1 }
    elseif (Test-Path $candidate2)   { $ZipPath = $candidate2 }
    else {
        Write-Host "ERROR: data.zip not found." -ForegroundColor Red
        Write-Host "  Looked for:"
        Write-Host "    $candidate1"
        Write-Host "    $candidate2"
        Write-Host "  Download from Mega (see README) then re-run, or pass the path:"
        Write-Host "    powershell -ExecutionPolicy Bypass -File scripts\setup_data.ps1 C:\path\to\data.zip"
        exit 1
    }
}
Write-Host "Using archive: $ZipPath"

# 2. Extract to temp dir
$TMP_DIR = Join-Path ([System.IO.Path]::GetTempPath()) ("skypath_" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $TMP_DIR | Out-Null
try {
    Write-Host "[1/4] Extracting to temp dir..." -ForegroundColor Yellow
    Expand-Archive -Path $ZipPath -DestinationPath $TMP_DIR -Force

    # Auto-detect nested "data\" wrapper
    $nested = Join-Path $TMP_DIR "data"
    if ((Test-Path $nested) -and -not (Test-Path (Join-Path $TMP_DIR "processed"))) {
        $SRC = $nested
    } else {
        $SRC = $TMP_DIR
    }
    Write-Host "  Source layout: $SRC"

    # 3. Move content into place
    Write-Host "[2/4] Moving data into $DATA_DIR ..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path (Join-Path $DATA_DIR "processed") -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $DATA_DIR "raw")       -Force | Out-Null

    function Move-IfAbsent($srcDir, $dstDir, $label) {
        if (-not (Test-Path $srcDir)) {
            Write-Host "  SKIP $label (not in archive)"
            return
        }
        if ((Test-Path $dstDir) -and (Get-ChildItem $dstDir -Force -ErrorAction SilentlyContinue)) {
            Write-Host "  SKIP $label (destination already has data: $dstDir)"
            return
        }
        if (Test-Path $dstDir) { Remove-Item $dstDir -Force -Recurse }
        Move-Item -Path $srcDir -Destination $dstDir
        Write-Host "  OK   $label -> $dstDir"
    }

    Move-IfAbsent (Join-Path $SRC "processed\flights_clean") (Join-Path $DATA_DIR "processed\flights_clean") "processed\flights_clean"
    Move-IfAbsent (Join-Path $SRC "processed\weather_clean") (Join-Path $DATA_DIR "processed\weather_clean") "processed\weather_clean"
    Move-IfAbsent (Join-Path $SRC "raw\flights")             (Join-Path $DATA_DIR "raw\flights")             "raw\flights"
    Move-IfAbsent (Join-Path $SRC "raw\weather")             (Join-Path $DATA_DIR "raw\weather")             "raw\weather"

    # Prefer repo-tracked airports.csv
    $srcCsv = Join-Path $SRC "raw\airports.csv"
    $dstCsv = Join-Path $DATA_DIR "raw\airports.csv"
    if ((Test-Path $srcCsv) -and -not (Test-Path $dstCsv)) {
        Move-Item $srcCsv $dstCsv
        Write-Host "  OK   raw\airports.csv -> $dstCsv"
    } else {
        Write-Host "  SKIP raw\airports.csv (using repo-tracked copy)"
    }

    # Drop stray verification.py scripts
    Get-ChildItem -Path (Join-Path $DATA_DIR "processed") -Filter verification.py -Recurse -ErrorAction SilentlyContinue |
        Remove-Item -Force -ErrorAction SilentlyContinue

    # 4. Verify
    Write-Host "[3/4] Verifying layout..." -ForegroundColor Yellow
    $ok = $true
    function Check-Parquet($dir, $label) {
        if (Test-Path $dir) {
            $n = (Get-ChildItem -Path $dir -Filter *.parquet -Recurse -ErrorAction SilentlyContinue).Count
            Write-Host ("  {0,-14}: {1} parquet files" -f $label, $n)
            if ($n -eq 0) { $script:ok = $false }
        } else {
            Write-Host "  $label : MISSING" -ForegroundColor Red
            $script:ok = $false
        }
    }
    Check-Parquet (Join-Path $DATA_DIR "processed\flights_clean") "flights_clean"
    Check-Parquet (Join-Path $DATA_DIR "processed\weather_clean") "weather_clean"
    if (Test-Path $dstCsv) {
        $rows = (Get-Content $dstCsv | Measure-Object -Line).Lines
        Write-Host ("  {0,-14}: {1} rows" -f "airports.csv", $rows)
    } else {
        Write-Host "  airports.csv  : MISSING" -ForegroundColor Red
        $ok = $false
    }

    Write-Host "[4/4] Done." -ForegroundColor Yellow
    if ($ok) {
        Write-Host ""
        Write-Host "=== Data setup complete ===" -ForegroundColor Green
        Write-Host "Expected counts (team-shared dataset):"
        Write-Host "  flights_clean : 37,786,688 rows (162 parquet files across Year=2019..2024)"
        Write-Host "  weather_clean : 1,474,038 rows  (covers 24 hub airports)"
    } else {
        Write-Host ""
        Write-Host "WARNING: one or more datasets are missing. Re-run or rebuild via ETL." -ForegroundColor Yellow
        exit 1
    }
}
finally {
    if (Test-Path $TMP_DIR) { Remove-Item $TMP_DIR -Force -Recurse -ErrorAction SilentlyContinue }
}
