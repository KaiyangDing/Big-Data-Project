# SkyPath Analytics

A high-performance distributed system for multi-dimensional flight delay correlation and predictive intelligence.

The system ingests 37M+ U.S. domestic flight records (2019-2024) and meteorological observations, builds a "Ripple Effect" delay propagation model via Tail Number Tracking, and delivers predictive delay scoring through an interactive dashboard.

## Team

| Name | NetID | Role |
|------|-------|------|
| Kaiyang Ding | kd3375 | Data Engineering Lead |
| Zeshen Zhang | zz10740 | Feature Engineering |
| Runzhe Xu | rx2380 | Analytics & Modeling |
| Xingyu Li | xl5936 | ML & Prediction |
| Yiqi Zhang | yz12072 | Frontend Dashboard |

## Project Structure

```
Big-Data-Project/
├── docker-compose.yml          # Spark + Jupyter environment
├── scripts/
│   ├── setup.sh / setup.ps1 / setup.bat   # One-click environment setup (Docker + dirs)
│   ├── setup_data.sh / setup_data.ps1     # Extract team data.zip into data/
│   ├── download_data.sh                   # Manual download instructions & verification
│   └── run_etl.sh                         # Run ETL pipeline inside container
├── data/
│   ├── raw/
│   │   ├── flights/            # BTS monthly CSVs (72 files, ~20 GB)
│   │   ├── weather/            # IEM ASOS CSVs (16 state files)
│   │   └── airports.csv        # OurAirports metadata (IATA/ICAO mapping)
│   └── processed/
│       ├── flights_clean/      # Cleaned flight data (Parquet, partitioned by Year/Month)
│       ├── weather_clean/      # Cleaned weather data (Parquet, partitioned by Year/Month)
│       ├── flights_with_weather/   # Intermediate checkpoint from feature engineering
│       └── features/
│           └── final/          # Complete feature set for analysis & ML (57 cols)
├── src/
│   ├── etl/                    # Data download & cleaning scripts
│   │   ├── download_flights.py
│   │   ├── download_weather.py
│   │   ├── clean_flights.py
│   │   └── clean_weather.py
│   ├── features/               # Feature engineering code
│   ├── analysis/               # Statistical analysis code
│   └── models/                 # ML training & inference code
├── notebooks/                  # Jupyter notebooks (exploratory & pipeline)
│   ├── 04_feature_engineering.ipynb   # Zeshen: weather join + ripple + historical features ✅
│   ├── 05_analysis.ipynb              # Runzhe: statistical analysis + Spark SQL + Dask ✅
│   └── 06_modeling.ipynb              # Xingyu: ML training & evaluation (TBD)
├── api/                        # REST API for prediction serving
├── frontend/                   # React dashboard
├── results/
│   ├── analysis/               # Analysis output (JSON)
│   └── figures/                # Charts and plots
├── models/                     # Saved ML models
└── docs/
    ├── data_dictionary.md      # Field definitions for all datasets
    └── final_proposal.pdf      # Project proposal
```

## Quick Start

### Prerequisites

- **Docker Desktop** (Windows / macOS) or Docker Engine (Linux)
- 16 GB+ RAM recommended (Spark driver uses 8 GB)

### 1. Setup Environment

```bash
git clone git@github.com:KaiyangDing/Big-Data-Project.git
cd Big-Data-Project
```

| OS | Command |
|----|---------|
| **macOS / Linux** | `bash scripts/setup.sh` |
| **Windows (PowerShell)** | `powershell -ExecutionPolicy Bypass -File scripts\setup.ps1` |
| **Windows (CMD)** | Double-click `scripts\setup.bat` |

> **Windows note**: Make sure Docker Desktop is running and shows "Engine running" before running the script.

This starts one container with Jupyter Lab + PySpark (Spark runs in local mode):

| Service | URL | Description |
|---------|-----|-------------|
| Jupyter Lab | http://localhost:8888 | Notebook environment (token: `bigdata2024`) |
| Spark UI | http://localhost:4040 | Visible while a Spark job is running |

### 2. Get the Data

**Option A: One-click setup from team `data.zip` (recommended)**

1. Download `data.zip` from Mega (~2.4 GB):

   > https://mega.nz/file/GR93WLxJ#1ZrVip0o4_IyUySZhk_vwzEj8ikQvN4W_djRNrXq_cs

2. Place `data.zip` **next to this repo** (as a sibling folder), so the layout is:
   ```
   your_workspace/
   ├── Big-Data-Project/      <-- this repo
   └── data.zip               <-- put it here (or inside the repo, also works)
   ```

3. Run the setup script:

   | OS | Command |
   |----|---------|
   | **macOS / Linux / Git Bash** | `bash scripts/setup_data.sh` |
   | **Windows (PowerShell)** | `powershell -ExecutionPolicy Bypass -File scripts\setup_data.ps1` |

   The script will:
   - Auto-detect `data.zip` at `../data.zip` or `./data.zip` (or pass a path explicitly)
   - Extract to a temp dir and move contents into `data/processed/` and `data/raw/`
   - Skip targets that already have data (won't overwrite your work)
   - Preserve the repo-tracked `data/raw/airports.csv` (the zip's copy is ignored)
   - Verify parquet file counts at the end

   After it runs you should have:
   ```
   data/processed/flights_clean/     (162 parquet files, 37,786,688 rows)
   data/processed/weather_clean/     (Parquet, 1,474,038 rows, 24 hub airports)
   data/raw/flights/                 (72 monthly CSVs, ~20 GB)
   data/raw/weather/                 (16 state CSVs, ~200 MB)
   data/raw/airports.csv             (already in repo)
   ```

**Option A+: skip feature engineering too (recommended for Runzhe / Xingyu)**

If you're picking up from Stage 3+ and don't want to run Zeshen's feature engineering
notebook (15-30 min on 8 GB driver), also grab the pre-computed feature table:

1. Download `features.zip` from Mega (~3 GB, contains `processed/features/final/` only):

   > https://mega.nz/file/Lm513YZI#yVipg-JgrCyvGj3dxJMrz162kpxx_Wf6yw2SIiNeuhw

2. The zip's top-level entries are `Year=2019/` ... `Year=2024/` (no wrapper folders),
   so extract it **into `data/processed/features/final/`**:

   | OS | Command |
   |----|---------|
   | **Windows (PowerShell, 10+)** | `mkdir data\processed\features\final -Force; tar -xf features.zip -C data\processed\features\final` |
   | **macOS / Linux** | `mkdir -p data/processed/features/final && unzip features.zip -d data/processed/features/final` |
   | **GUI fallback** | Create the folder `Big-Data-Project\data\processed\features\final\`, then extract `features.zip` into it |

3. Verify:
   ```
   data/processed/features/final/   (should contain Year=2019..2024 subfolders, 37,786,688 rows × 57 cols)
   ```

You still need `data.zip` (Option A) if you want the raw CSVs or the clean flight/weather
parquet — but for analysis and ML those aren't strictly required.

**Option B: Build from raw data (rerun ETL)**

```bash
# Enter the Jupyter container
docker exec -it skypath-jupyter bash

# If you don't have raw CSVs yet, download them first:
pip install requests
python /src/etl/download_flights.py   # ~15-20 GB, takes a while
python /src/etl/download_weather.py   # ~200 MB

# Run ETL to produce Parquet:
spark-submit --master local[*] --driver-memory 8g /src/etl/clean_flights.py
spark-submit --master local[*] --driver-memory 8g /src/etl/clean_weather.py
```

### 3. Verify Data

Open Jupyter Lab (http://localhost:8888, token: `bigdata2024`) and run the cell that
matches what you downloaded:

```python
import os
from pyspark.sql import SparkSession

spark = SparkSession.builder.appName("verify").getOrCreate()

# If you downloaded data.zip (Option A) — verify Kaiyang's outputs:
if os.path.isdir("/data/processed/flights_clean"):
    flights = spark.read.parquet("/data/processed/flights_clean")
    weather = spark.read.parquet("/data/processed/weather_clean")
    print(f"Flights: {flights.count():,} rows, {len(flights.columns)} cols")
    print(f"Weather: {weather.count():,} rows, {len(weather.columns)} cols")

# If you downloaded features.zip (Option A+) — verify Zeshen's feature table:
if os.path.isdir("/data/processed/features/final"):
    features = spark.read.parquet("/data/processed/features/final")
    print(f"Features: {features.count():,} rows, {len(features.columns)} cols")
```

Expected output (any combination depending on what you downloaded):
```
Flights:  37,786,688 rows, 27 cols
Weather:   1,474,038 rows, 17 cols
Features: 37,786,688 rows, 57 cols
```

### 4. Stop Environment

```bash
docker compose down
```

## Data Sources

| Dataset | Source | Records | Description |
|---------|--------|---------|-------------|
| BTS On-Time Performance | [transtats.bts.gov](https://www.transtats.bts.gov/DL_SelectFields.aspx?gnoyr_VQ=FGJ) | 37.8M | U.S. domestic flights, 2019-2024 |
| IEM ASOS/METAR | [mesonet.agron.iastate.edu](https://mesonet.agron.iastate.edu/request/download.phtml) | 1.5M | Hourly weather at 24 hub airports |
| Airport Metadata | [ourairports.com](https://ourairports.com/data/) | 85K | IATA/ICAO codes, coordinates |

### Data Schema Summary

**flights_clean** (27 columns) - see [docs/data_dictionary.md](docs/data_dictionary.md) for full details

| Key Fields | Type | Description |
|------------|------|-------------|
| FlightDate | Date | Flight date (2019-01-01 to 2024-12-31) |
| Reporting_Airline | String | Carrier IATA code (AA, DL, UA, WN, ...) |
| Tail_Number | String | Aircraft tail number, used for Ripple Effect tracking |
| Origin / Dest | String | Airport IATA codes |
| DepDelay / ArrDelay | Float | Delay in minutes (negative = early) |
| CarrierDelay, WeatherDelay, NASDelay, SecurityDelay, LateAircraftDelay | Float | Delay cause breakdown (null when no delay) |
| Year, Month, DayOfWeek, DepHour | Int | Derived time features, Year/Month also serve as partition keys |

**weather_clean** (17 columns)

| Key Fields | Type | Description |
|------------|------|-------------|
| iata_code | String | Airport IATA code (matches flights Origin/Dest) |
| obs_time | Timestamp | Observation time in **UTC** |
| obs_date / obs_hour | Date / Int | Derived from obs_time, used for join |
| tmpf, dwpf, relh | Float | Temperature (F), dewpoint (F), relative humidity (%) |
| sknt, drct | Float | Wind speed (knots), direction (degrees) |
| vsby | Float | Visibility (miles, max 10.0) |
| wxcodes | String | Weather phenomena (RA, SN, FG, TS, ...; null = clear) |

> **Note on timezone**: Weather `obs_hour` is in UTC. Flight `DepHour`/`CRSDepTime` is in **local time**. The feature engineering step handles timezone conversion before joining.

> **Note on weather coverage**: Weather data covers 24 major hub airports (ATL, ORD, DFW, DEN, LAX, JFK, LGA, EWR, SFO, SEA, MIA, MCO, FLL, CLT, PHX, LAS, BOS, MSP, DTW, IAH, AUS, PHL, MDW, SAN). Flights from other airports will have null weather fields after the join. Tail Number Tracking and historical features are computed on the full 37.8M dataset regardless of weather coverage.

**features/final** (57 columns, 37,786,688 rows) — the main feature table Runzhe and Xingyu read from. Full derivation logic lives in [notebooks/04_feature_engineering.ipynb](notebooks/04_feature_engineering.ipynb); the 57 columns break down by purpose:

| Group | # cols | Key fields | Source |
|-------|-------:|------------|--------|
| Original flight fields | 23 | `FlightDate`, `Reporting_Airline`, `Tail_Number`, `Origin`, `Dest`, `ArrDelay`, `DepDelay`, `CarrierDelay` / `WeatherDelay` / `NASDelay` / `SecurityDelay` / `LateAircraftDelay` | Kaiyang's `flights_clean` |
| Derived time | 4 | `Year`, `Month`, `DayOfWeek`, `DepHour` | Kaiyang |
| Timezone alignment | 4 | `origin_tz`, `dep_utc_ts`, `dep_utc_date`, `dep_utc_hour` | Zeshen — flight local time → UTC via IATA→IANA map for 24 hubs |
| Weather (joined) | 8 | `temperature`, `dewpoint`, `humidity`, `wind_direction`, `wind_speed`, `visibility`, `precipitation`, `weather_codes` | Zeshen — UTC-aligned hourly left join |
| Weather derived | 4 | `has_weather_data` (0/1), `is_low_visibility`, `is_high_wind`, `has_precipitation` (null-safe — null = unknown, not "clear") | Zeshen |
| Ripple (safe for prediction) | 5 | `flight_leg`, `prev_arr_delay`, `prev_origin`, `prev_dest`, `inherited_delay` | Zeshen — window over `(Tail_Number, FlightDate)` ordered by `CRSDepTime` |
| Ripple ⚠️ **analysis-only** | 2 | `cumulative_delay`, `delay_recovery` | Zeshen — **these two include the current row's `ArrDelay` in their formula, so using them as features for an `ArrDelay` prediction model is leakage.** Use them for Runzhe's descriptive statistics only. If Xingyu wants a "prior cumulative" signal, derive it inline: `cumulative_delay - ArrDelay`. |
| Historical aggregates (leak-safe) | 7 | `route_total_flights`, `route_avg_delay`, `route_on_time_rate`, `carrier_avg_delay`, `carrier_on_time_rate`, `origin_avg_dep_delay`, `origin_std_dep_delay` | Zeshen — computed on `Year <= 2023` subset only, so 2024 predictions don't leak |

Two caveats that affect downstream code:

- **Weather columns are null for non-hub origin airports** (~43.8% of rows). Use the `has_weather_data` flag to decide whether to filter or impute.
- **Historical aggregates are computed on 2019-2023 only.** Safe to use as features when training on the same years; they intentionally omit 2024 so it stays a clean test set.

## Pipeline Architecture

```
BTS Flight CSVs ──→ clean_flights.py ──→ flights_clean (Parquet)
                                              │
IEM Weather CSVs ──→ clean_weather.py ──→ weather_clean (Parquet)
                                              │
OurAirports CSV ──────────────────────────────┤
                                              ▼
                                   Feature Engineering
                                   ├─ Weather Join (timezone-aware)
                                   ├─ Tail Number Tracking (Ripple Effect)
                                   └─ Historical Features
                                              │
                                              ▼
                                      features/final (Parquet)
                                        │           │
                                        ▼           ▼
                                  ML Training   Statistical Analysis
                                   (Spark MLlib)  (Spark SQL; Dask benchmark)
                                        │           │
                                        ▼           ▼
                                   Model metrics   Analysis JSON
                                        │           │
                                        └─────┬─────┘
                                              ▼
                                          MongoDB
                                              │
                                              ▼
                                        FastAPI (REST)
                                              │
                                              ▼
                                      React Dashboard
```

The full pipeline (ETL → feature engineering → training) is orchestrated via a Prefect
flow (`src/etl/pipeline.py`) — parallel tasks for the two cleaning jobs, sequential downstream.
Phase 1 stores Parquet on the local filesystem; Phase 2 moves it to HDFS
(`hdfs://namenode:9000/...`) without touching any Spark code other than path prefixes.

## Pipeline Status & Team Handoff

Each stage reads from the previous stage's output. If you're picking up a task below, you only
need to run from your stage onward — upstream outputs are already in `data/` once you've run
`setup_data.{sh,ps1}`.

> **Note on HDFS paths.** The shared task document specifies HDFS paths
> (`hdfs://namenode:9000/...`) for storage. **We're deferring HDFS setup — for now, read and
> write using local paths `/data/processed/...`.** The data is already on local disk in the
> expected layout. When HDFS is brought up later, Kaiyang will `hdfs dfs -put` the existing
> parquet into HDFS and each member swaps one path prefix in their code; no re-run needed.
> Don't wait for HDFS, just start.

| Stage | Owner | Status | Reads from | Produces |
|-------|-------|--------|-----------|----------|
| 1. ETL | Kaiyang | ✅ done | `data/raw/flights/`, `data/raw/weather/`, `data/raw/airports.csv` | `data/processed/flights_clean/`, `data/processed/weather_clean/` |
| 2. Feature engineering | Zeshen | ✅ done | `data/processed/flights_clean/`, `data/processed/weather_clean/` | `data/processed/features/final/` (37.8M rows, 57 cols) |
| 3. Statistical analysis | Runzhe | ✅ done | `data/processed/features/final/` | `results/analysis/*.json`, `results/figures/*` |
| 4. ML training + API | Xingyu | ✅ done | `data/processed/features/final/` | `models/`, `api/` (REST service) |
| 5. Dashboard | Yiqi | 🔜 not started | `results/analysis/*.json`, REST API | `frontend/` (React app) |

### Per-member quick start

#### Zeshen — ✅ done
The feature notebook has been run. `data/processed/features/final/` has 37,786,688 rows × 57
columns, with 56.2% weather-matched (≈100% on hub-origin flights) and 100% ripple feature
coverage. Downstream can proceed.

#### Runzhe — ✅ done
All 8 analysis tasks completed on the full 37,786,688-row dataset. Outputs in `results/analysis/`:

| File | Content |
|------|---------|
| `overview.json` | 37.8M flights, 81.99% on-time rate, avg arrival delay 4.65 min |
| `carriers.json` | Per-airline on-time rate & delay cause breakdown (all carriers) |
| `airports.json` | Per-airport departure / arrival delay rate (382 airports) |
| `temporal.json` | Delay patterns by month, day-of-week, and departure hour |
| `attribution.json` | Delay cause shares: Late Aircraft 38.3%, Carrier 36.4%, NAS 19.2%, Weather 5.8% |
| `ripple.json` | Propagation rate & avg recovery speed, overall and per airline |
| `routes.json` | Per-route stats for 8,403 Origin-Dest pairs |
| `spark_vs_dask.json` | Spark SQL 218 s vs Dask 380 s on the same aggregation query (1.74× speedup) |

Charts (PNG) also in `results/analysis/`: `carrier_ontime.png`, `monthly_delay.png`, `attribution_pie.png`, `spark_vs_dask.png`.

#### Xingyu — ✅ done (ML & REST API)

Two GBT model versions trained on 30.8M flights (2019–2023) and evaluated on 6.96M held-out 2024 flights:

- **Post-departure model** (with `DepDelay`): classifier AUC 0.9345, F1 0.8876; regressor RMSE 20.70 min, R² 0.9199
- **Pre-departure model** (without `DepDelay`): classifier AUC 0.8102, F1 0.7633; regressor RMSE 64.62 min, R² 0.2192

A FastAPI service (`api/app.py`) loads both models at startup and exposes prediction + analysis endpoints on port 8000. On first startup the API automatically seeds MongoDB from the JSON files in `results/` — no manual initialization step is needed.

**Detailed documentation:**
- [docs/ml_modeling.md](docs/ml_modeling.md) — feature selection rationale, two-model design, hyperparameters, evaluation metrics, feature importance
- [docs/api_reference.md](docs/api_reference.md) — all 7 endpoints with request/response schemas, example `curl` calls, and test results
- [docs/how_to_run.md](docs/how_to_run.md) — Docker startup sequence, automatic MongoDB seeding, and troubleshooting

#### Yiqi — React Dashboard
You don't need the Docker / Spark environment. Work from `frontend/` with Node 18+. Data
contract is the REST API (Xingyu) + the analysis JSONs (Runzhe). Airport lat/lon for the map
come from `data/raw/airports.csv` (already in repo).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Compute | Apache Spark 3.5.0 (PySpark + Spark SQL); Dask as a benchmark comparison on one analysis query |
| Bulk storage | Parquet on local filesystem (Phase 1) → HDFS via namenode + datanode (Phase 2) |
| Serving storage | MongoDB — `skypath.model_metrics`, `skypath.analysis`, `skypath.predictions` collections |
| ML | Spark MLlib (GBT, Random Forest) |
| API | FastAPI (Python, reads from MongoDB) |
| Orchestration | Prefect (`@flow` / `@task`) — one-command end-to-end pipeline |
| Frontend | React.js, ECharts, Mapbox GL JS |
| Infrastructure | Docker Compose |
