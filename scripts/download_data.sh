#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# SkyPath Analytics - Download Pre-processed Data
#
# Downloads the cleaned Parquet datasets from cloud storage.
# If you want to rebuild from raw CSVs instead, see README.md.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="$PROJECT_ROOT/data"

echo "=== SkyPath Analytics Data Download ==="
echo ""

# ─── Option A: Download pre-processed data from Mega ───
MEGA_URL="https://mega.nz/file/GR93WLxJ#1ZrVip0o4_IyUySZhk_vwzEj8ikQvN4W_djRNrXq_cs"

echo "The pre-processed datasets (flights_clean + weather_clean) are hosted on Mega."
echo ""
echo "  URL: $MEGA_URL"
echo ""
echo "Please download the file manually and extract it:"
echo ""
echo "  1. Open the URL above in your browser"
echo "  2. Download the archive"
echo "  3. Extract into: $DATA_DIR/processed/"
echo "     so that you have:"
echo "       $DATA_DIR/processed/flights_clean/  (Parquet files)"
echo "       $DATA_DIR/processed/weather_clean/  (Parquet files)"
echo ""

# ─── Option B: Download raw data and run ETL ───
echo "Alternatively, download raw data and run the ETL pipeline yourself:"
echo ""
echo "  # Inside the Jupyter container:"
echo "  docker exec -it jupyter bash"
echo "  pip install requests"
echo "  python /src/etl/download_flights.py   # ~15-20 GB, takes a while"
echo "  python /src/etl/download_weather.py   # ~200 MB"
echo "  python /src/etl/clean_flights.py"
echo "  python /src/etl/clean_weather.py"
echo ""

# ─── Verify existing data ───
echo "--- Current data status ---"
if [ -d "$DATA_DIR/processed/flights_clean" ] && [ "$(ls -A "$DATA_DIR/processed/flights_clean" 2>/dev/null)" ]; then
    echo "  flights_clean: FOUND"
    echo "    $(find "$DATA_DIR/processed/flights_clean" -name '*.parquet' | wc -l) parquet files"
else
    echo "  flights_clean: NOT FOUND"
fi

if [ -d "$DATA_DIR/processed/weather_clean" ] && [ "$(ls -A "$DATA_DIR/processed/weather_clean" 2>/dev/null)" ]; then
    echo "  weather_clean: FOUND"
    echo "    $(find "$DATA_DIR/processed/weather_clean" -name '*.parquet' | wc -l) parquet files"
else
    echo "  weather_clean: NOT FOUND"
fi

if [ -f "$DATA_DIR/raw/airports.csv" ]; then
    echo "  airports.csv:  FOUND ($(wc -l < "$DATA_DIR/raw/airports.csv") rows)"
else
    echo "  airports.csv:  NOT FOUND"
fi
