#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# SkyPath Analytics - Extract pre-processed data from data.zip
#
# Takes the team-shared data.zip (cleaned Parquet + raw CSVs) and
# places its contents at the layout expected by docker-compose.yml:
#
#   Big-Data-Project/data/processed/flights_clean/
#   Big-Data-Project/data/processed/weather_clean/
#   Big-Data-Project/data/raw/flights/
#   Big-Data-Project/data/raw/weather/
#
# Usage:
#   bash scripts/setup_data.sh                 # auto-detect data.zip
#   bash scripts/setup_data.sh /path/to/data.zip
# ─────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="$PROJECT_ROOT/data"

echo "=== SkyPath Analytics - Data Setup ==="
echo "Repo root: $PROJECT_ROOT"

# ─── 1. Locate data.zip ───
if [ $# -ge 1 ]; then
    ZIP_PATH="$1"
elif [ -f "$PROJECT_ROOT/../data.zip" ]; then
    ZIP_PATH="$(cd "$PROJECT_ROOT/.." && pwd)/data.zip"
elif [ -f "$PROJECT_ROOT/data.zip" ]; then
    ZIP_PATH="$PROJECT_ROOT/data.zip"
else
    echo "ERROR: data.zip not found."
    echo "  Looked for:"
    echo "    $PROJECT_ROOT/../data.zip"
    echo "    $PROJECT_ROOT/data.zip"
    echo "  Download from Mega (see README), then either place it next to the repo"
    echo "  or pass its path:  bash scripts/setup_data.sh /path/to/data.zip"
    exit 1
fi
echo "Using archive: $ZIP_PATH"

command -v unzip >/dev/null 2>&1 || { echo "ERROR: unzip not found (git-bash ships it; on Linux: sudo apt install unzip)"; exit 1; }

# ─── 2. Extract to temp dir ───
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
echo "[1/4] Extracting to temp dir..."
unzip -q "$ZIP_PATH" -d "$TMP_DIR"

# Auto-detect nested "data/" wrapper
if [ -d "$TMP_DIR/data" ] && [ ! -d "$TMP_DIR/processed" ]; then
    SRC="$TMP_DIR/data"
else
    SRC="$TMP_DIR"
fi
echo "  Source layout: $SRC"

# ─── 3. Move content into place ───
echo "[2/4] Moving data into $DATA_DIR ..."
mkdir -p "$DATA_DIR/processed" "$DATA_DIR/raw"

move_if_absent() {
    local src="$1" dst="$2" name="$3"
    if [ ! -d "$src" ]; then
        echo "  SKIP $name (not in archive)"
        return
    fi
    if [ -d "$dst" ] && [ -n "$(ls -A "$dst" 2>/dev/null)" ]; then
        echo "  SKIP $name (destination already has data: $dst)"
        return
    fi
    rmdir "$dst" 2>/dev/null || true
    mv "$src" "$dst"
    echo "  OK   $name -> $dst"
}

move_if_absent "$SRC/processed/flights_clean" "$DATA_DIR/processed/flights_clean" "processed/flights_clean"
move_if_absent "$SRC/processed/weather_clean" "$DATA_DIR/processed/weather_clean" "processed/weather_clean"
move_if_absent "$SRC/raw/flights"             "$DATA_DIR/raw/flights"             "raw/flights"
move_if_absent "$SRC/raw/weather"             "$DATA_DIR/raw/weather"             "raw/weather"

# Prefer the repo-tracked airports.csv, so only copy if missing
if [ -f "$SRC/raw/airports.csv" ] && [ ! -f "$DATA_DIR/raw/airports.csv" ]; then
    mv "$SRC/raw/airports.csv" "$DATA_DIR/raw/airports.csv"
    echo "  OK   raw/airports.csv -> $DATA_DIR/raw/airports.csv"
else
    echo "  SKIP raw/airports.csv (using repo-tracked copy)"
fi

# Drop Kaiyang's private verification.py scripts if present
find "$DATA_DIR/processed" -maxdepth 2 -name 'verification.py' -delete 2>/dev/null || true

# ─── 4. Verify ───
echo "[3/4] Verifying layout..."
ok=1
check_parquet() {
    local dir="$1" label="$2"
    if [ -d "$dir" ]; then
        n=$(find "$dir" -name '*.parquet' | wc -l)
        echo "  $label : $n parquet files"
        [ "$n" -gt 0 ] || ok=0
    else
        echo "  $label : MISSING"
        ok=0
    fi
}
check_parquet "$DATA_DIR/processed/flights_clean" "flights_clean"
check_parquet "$DATA_DIR/processed/weather_clean" "weather_clean"

if [ -f "$DATA_DIR/raw/airports.csv" ]; then
    rows=$(wc -l < "$DATA_DIR/raw/airports.csv")
    echo "  airports.csv  : $rows rows"
else
    echo "  airports.csv  : MISSING"
    ok=0
fi

echo "[4/4] Done."
if [ "$ok" -eq 1 ]; then
    echo ""
    echo "=== Data setup complete ==="
    echo "Expected counts (team-shared dataset):"
    echo "  flights_clean : 37,786,688 rows (162 parquet files across Year=2019..2024)"
    echo "  weather_clean : 1,474,038 rows  (covers 24 hub airports)"
else
    echo ""
    echo "WARNING: one or more datasets are missing. Re-run or rebuild via ETL."
    exit 1
fi
