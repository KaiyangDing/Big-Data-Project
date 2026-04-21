#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# SkyPath Analytics - Environment Setup
# Creates directory structure and starts Docker containers.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "=== SkyPath Analytics Setup ==="
echo "Project root: $PROJECT_ROOT"
echo ""

# 1. Create directory structure
echo "[1/3] Creating directory structure..."
mkdir -p data/raw/flights
mkdir -p data/raw/weather
mkdir -p data/processed/flights_clean
mkdir -p data/processed/weather_clean
mkdir -p data/processed/flights_with_weather
mkdir -p data/processed/features/{ripple,historical,final}
mkdir -p notebooks
mkdir -p results/{analysis,figures}
mkdir -p models
echo "  Done."

# 2. Check Docker
echo "[2/3] Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo "  ERROR: Docker is not installed. Please install Docker first."
    exit 1
fi
if ! docker info &> /dev/null; then
    echo "  ERROR: Docker daemon is not running. Please start Docker."
    exit 1
fi
echo "  Docker is ready."

# 3. Start containers
echo "[3/3] Starting Docker containers..."
docker compose up -d
echo ""
echo "=== Setup Complete ==="
echo ""
echo "Services:"
echo "  Jupyter Lab : http://localhost:8888  (token: bigdata2024)"
echo "  Spark UI    : http://localhost:4040  (visible while a Spark job is running)"
echo ""
echo "Next steps:"
echo "  1. Download processed data:  bash scripts/download_data.sh"
echo "     OR download raw data and run ETL (see README.md)"
echo "  2. Open Jupyter Lab and start working on notebooks"
