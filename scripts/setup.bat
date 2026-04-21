@echo off
REM ─────────────────────────────────────────────────────────────
REM SkyPath Analytics - Environment Setup (Windows)
REM Requires: Docker Desktop for Windows
REM Usage:    Double-click this file, or run in cmd/PowerShell
REM ─────────────────────────────────────────────────────────────

echo === SkyPath Analytics Setup ===
echo.

REM Navigate to project root (one level up from scripts/)
cd /d "%~dp0.."
echo Project root: %CD%
echo.

REM 1. Create directory structure
echo [1/3] Creating directory structure...
mkdir data\raw\flights 2>nul
mkdir data\raw\weather 2>nul
mkdir data\processed\flights_clean 2>nul
mkdir data\processed\weather_clean 2>nul
mkdir data\processed\flights_with_weather 2>nul
mkdir data\processed\features\ripple 2>nul
mkdir data\processed\features\historical 2>nul
mkdir data\processed\features\final 2>nul
mkdir notebooks 2>nul
mkdir results\analysis 2>nul
mkdir results\figures 2>nul
mkdir models 2>nul
echo   Done.

REM 2. Check Docker
echo [2/3] Checking Docker Desktop...
docker info >nul 2>&1
if errorlevel 1 (
    echo   ERROR: Docker Desktop is not running.
    echo   Please start Docker Desktop and wait until it says "Engine running".
    pause
    exit /b 1
)
echo   Docker is ready.

REM 3. Start containers
echo [3/3] Starting Docker containers...
docker compose up -d
if errorlevel 1 (
    echo   ERROR: docker compose failed.
    pause
    exit /b 1
)

echo.
echo === Setup Complete ===
echo.
echo Services:
echo   Jupyter Lab : http://localhost:8888  (token: bigdata2024)
echo   Spark UI    : http://localhost:4040  (visible while a Spark job is running)
echo.
echo Next steps:
echo   1. Download processed data (see README.md)
echo   2. Open http://localhost:8888 in browser
echo.
pause
