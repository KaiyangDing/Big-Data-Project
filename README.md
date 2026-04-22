# SkyPath Analytics

A high-performance distributed system for multi-dimensional flight delay correlation and predictive intelligence.

The system ingests 37M+ U.S. domestic flight records (2019-2024) and meteorological observations, builds a "Ripple Effect" delay propagation model via Tail Number Tracking, and delivers predictive delay scoring through an interactive dashboard.

## Team

| Name | NetID | Role |
|------|-------|------|
| Kaiyang Ding | kd3375 | Data Engineering Lead |
| Zeshen Zhang | zz10740 | Feature Engineering |
| Ruznhe Xu | rx2380 | Analytics & Modeling |
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
│       ├── flights_with_weather/   # Flights joined with weather features
│       └── features/
│           ├── ripple/         # Tail Number Tracking features
│           ├── historical/     # Route/carrier/airport historical stats
│           └── final/          # Complete feature set for ML
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
│   └── 04_feature_engineering.ipynb   # Zeshen: weather join + ripple + historical features
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

Open Jupyter Lab (http://localhost:8888, token: `bigdata2024`) and run:

```python
from pyspark.sql import SparkSession

spark = SparkSession.builder.appName("verify").getOrCreate()

flights = spark.read.parquet("/data/processed/flights_clean")
weather = spark.read.parquet("/data/processed/weather_clean")

print(f"Flights: {flights.count():,} rows, {len(flights.columns)} cols")
print(f"Weather: {weather.count():,} rows, {len(weather.columns)} cols")
```

Expected output:
```
Flights: 37,786,688 rows, 27 cols
Weather: 1,474,038 rows, 17 cols
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
                                   (GBT, RF)    (delay attribution)
                                        │           │
                                        ▼           ▼
                                   REST API     Analysis JSON
                                        │           │
                                        └─────┬─────┘
                                              ▼
                                      React Dashboard
```

## Pipeline Status & Team Handoff

Each stage reads from the previous stage's output. If you're picking up a task below, you only
need to run from your stage onward — upstream outputs are already in `data/` once you've run
`setup_data.{sh,ps1}`.

| Stage | Owner | Status | Reads from | Produces |
|-------|-------|--------|-----------|----------|
| 1. ETL | Kaiyang | ✅ done | `data/raw/flights/`, `data/raw/weather/`, `data/raw/airports.csv` | `data/processed/flights_clean/`, `data/processed/weather_clean/` |
| 2. Feature engineering | Zeshen | 🟡 notebook written, needs a run | `data/processed/flights_clean/`, `data/processed/weather_clean/` | `data/processed/flights_with_weather/`, `data/processed/features/final/` |
| 3. Statistical analysis | Ruznhe | 🔜 not started | `data/processed/features/final/` | `results/analysis/*.json`, `results/figures/*` |
| 4. ML training + API | Xingyu | 🔜 not started | `data/processed/features/final/` | `models/`, `api/` (REST service) |
| 5. Dashboard | Yiqi | 🔜 not started | `results/analysis/*.json`, REST API | `frontend/` (React app) |

### Per-member quick start

#### Zeshen — run the feature engineering notebook
```bash
# Start Docker env (if not already running)
docker compose up -d
# Open http://localhost:8888 (token: bigdata2024)
# Run notebooks/04_feature_engineering.ipynb top-to-bottom (~15-30 min on 8GB driver)
```
The notebook handles timezone alignment (UTC ← origin local time), hourly weather aggregation,
the weather left join, Tail-Number-based ripple features, and leak-safe historical aggregates.
Output parquet lands at `/data/processed/features/final/`.

#### Ruznhe — statistical analysis
Wait until `data/processed/features/final/` exists, then create
`notebooks/05_analysis.ipynb`. Expected outputs per the proposal:
- `results/analysis/overview.json` — total flights, on-time rate, monthly trend
- `results/analysis/carriers.json` — per-carrier on-time rate + delay-cause breakdown
  (use `CarrierDelay` / `WeatherDelay` / `NASDelay` / `SecurityDelay` / `LateAircraftDelay`)
- `results/analysis/airports.json` — per-airport delay stats for the map + ranking table
- `results/analysis/routes.json` — per-route stats (aggregated from `route_*` columns)

The dataset already has `LateAircraftDelay` (BTS's own ripple proxy) plus our derived
`inherited_delay` / `delay_recovery` / `cumulative_delay`, so causal-propagation analysis
doesn't need any extra computation.

#### Xingyu — ML & REST API
Wait until `data/processed/features/final/` exists. Create `notebooks/06_modeling.ipynb`
and put inference code in `api/`. Key points:

- **Don't leak 2024 into training.** Use `Year <= 2023` for train, `Year == 2024` for test.
  The `route_*` / `carrier_*` / `origin_*` columns in the feature table are already computed
  on 2019-2023 only, so they're safe to use as features.
- **Weather-null rows**: either filter to `has_weather_data == 1` (hub airports only), or
  impute and keep `has_weather_data` as a feature — up to you, but document the choice.
- Two task heads are in scope: binary classification (`ArrDelay > 15`) and regression
  (`ArrDelay` in minutes). GBT / Random Forest via Spark MLlib.
- API endpoints expected by the dashboard: `/predict` (POST flight info → delay prob + ETA),
  `/route/{origin}/{dest}` (historical stats for a route). See frontend spec in the proposal.

#### Yiqi — React Dashboard
You don't need the Docker / Spark environment. Work from `frontend/` with Node 18+.
Data contract:
- Page "Overview / Airlines / Airports / Routes" read the JSON files at
  `results/analysis/*.json` (committed once Ruznhe produces them — not huge, can go in git)
- Page "Predict" calls Xingyu's REST API. Coordinate the exact payload shape with him.
- Airport lat/lon for the map come from `data/raw/airports.csv` (already in repo) —
  filter by `iata_code` from the analysis JSONs.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Compute | Apache Spark 3.5.0 (PySpark) |
| Storage | Parquet on local filesystem (HDFS-compatible) |
| ML | Spark MLlib (GBT, Random Forest) |
| API | Python (Flask/FastAPI) |
| Frontend | React.js, ECharts, Mapbox GL JS |
| Infrastructure | Docker Compose |
