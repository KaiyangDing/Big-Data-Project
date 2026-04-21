#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# SkyPath Analytics - Run ETL Pipeline
# Executes inside the Jupyter container via spark-submit.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

echo "=== Running ETL Pipeline ==="
echo ""

echo "[1/2] Cleaning flight data..."
spark-submit --master local[*] --driver-memory 8g /src/etl/clean_flights.py
echo ""

echo "[2/2] Cleaning weather data..."
spark-submit --master local[*] --driver-memory 8g /src/etl/clean_weather.py
echo ""

echo "=== ETL Complete ==="
echo "Output:"
echo "  /data/processed/flights_clean/"
echo "  /data/processed/weather_clean/"
