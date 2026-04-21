# ─────────────────────────────────────────────────────────────
# SkyPath Analytics - Environment Setup (Windows PowerShell)
# Requires: Docker Desktop for Windows
# Usage:    Right-click -> "Run with PowerShell"
#           or in terminal: powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
# ─────────────────────────────────────────────────────────────
$ErrorActionPreference = "Stop"

$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $PROJECT_ROOT

Write-Host "=== SkyPath Analytics Setup ===" -ForegroundColor Cyan
Write-Host "Project root: $PROJECT_ROOT"
Write-Host ""

# 1. Create directory structure
Write-Host "[1/3] Creating directory structure..." -ForegroundColor Yellow
$dirs = @(
    "data\raw\flights",
    "data\raw\weather",
    "data\processed\flights_clean",
    "data\processed\weather_clean",
    "data\processed\flights_with_weather",
    "data\processed\features\ripple",
    "data\processed\features\historical",
    "data\processed\features\final",
    "notebooks",
    "results\analysis",
    "results\figures",
    "models"
)
foreach ($d in $dirs) {
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
}
Write-Host "  Done."

# 2. Check Docker Desktop
Write-Host "[2/3] Checking Docker Desktop..." -ForegroundColor Yellow
try {
    $null = docker info 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Docker not responding" }
    Write-Host "  Docker is ready."
} catch {
    Write-Host "  ERROR: Docker Desktop is not running." -ForegroundColor Red
    Write-Host "  Please start Docker Desktop and wait until it says 'Engine running'."
    Read-Host "Press Enter to exit"
    exit 1
}

# 3. Start containers
Write-Host "[3/3] Starting Docker containers..." -ForegroundColor Yellow
docker compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: docker compose failed. Make sure Docker Desktop is running." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Services:"
Write-Host "  Jupyter Lab : http://localhost:8888  (token: bigdata2024)"
Write-Host "  Spark UI    : http://localhost:4040  (visible while a Spark job is running)"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Download processed data (see README.md)"
Write-Host "  2. Open http://localhost:8888 in browser"
Write-Host ""
Read-Host "Press Enter to close"
