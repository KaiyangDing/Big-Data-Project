# SkyPath Analytics

> *Big Data — Spring 2026 — Final Project*

A distributed analytics platform for U.S. flight delay prediction. The system ingests 37.8 million BTS flight records (2019–2024) and 1.5 million hourly weather observations from 24 hub airports, builds a 57-column feature table that captures the **Ripple Effect** of delay propagation across aircraft tails, trains two Gradient-Boosted Tree models (pre- and post-departure), and serves predictions and pre-computed analytics through a FastAPI service consumed by a React dashboard.

On a held-out 2024 test set the post-departure model reaches **AUC 0.9345 / RMSE 20.7 min**, and the pre-departure model — built without observed `DepDelay` — reaches **AUC 0.8102**. Statistical analysis surfaces a 20-point spread in delay-propagation rate across carriers (Southwest 35.8% vs. SkyWest 15.7%), which is larger than the spread on any individual BTS cause.

> *Note: this README was drafted with the help of an AI assistant.*

---

## Team

| Name | NetID | Role |
|------|-------|------|
| Kaiyang Ding | kd3375 | Data Engineering Lead |
| Zeshen Zhang | zz10740 | Feature Engineering |
| Runzhe Xu | rx2380 | Analytics & Modeling |
| Xingyu Li | xl5936 | ML & Prediction API |
| Yiqi Zhang | yz12072 | Frontend Dashboard |

---

## What you can see when it's running

| Service | URL | Purpose |
|---------|-----|---------|
| **React Dashboard** | http://localhost:3000 | 5 pages — Overview, Airlines, Airports (interactive U.S. map), Routes, Predict |
| **FastAPI Service** | http://localhost:8000 | REST endpoints for prediction + analysis JSON |
| **Jupyter Lab** | http://localhost:8888 | Notebooks (token: `bigdata2024`) — only needed if you want to retrain |
| **Spark UI** | http://localhost:4040 | Visible while a Spark job is running |
| **MongoDB** | localhost:27017 | Serving store for analysis results, predictions, model metrics |

---

## Quick start

### Prerequisites

- **Docker Desktop** (Windows / macOS) or Docker Engine (Linux)
- **Node.js 18+** if you want to run the frontend
- ~16 GB RAM recommended (Spark driver uses 8 GB)

### 1. Clone the repo

```bash
git clone https://github.com/KaiyangDing/Big-Data-Project.git
cd Big-Data-Project
```

### 2. Start the backend (Docker)

The `docker-compose.yml` defines three services that come up together:

- `skypath-jupyter` — Jupyter Lab + PySpark on Spark 3.5.0
- `skypath-mongo` — MongoDB 7
- `skypath-api` — FastAPI service on port 8000

```bash
docker compose up -d
```

The API container automatically seeds MongoDB from the JSON files in `results/` on first startup — there is no manual init step. Pre-trained models are checked in under `models/` so you don't need to train anything to run the demo.

Verify the API is up:

```bash
curl http://localhost:8000/health
# {"status":"healthy","spark":true}
```

### 3. Start the frontend (Node)

```bash
cd frontend
npm install
npm run dev
```

The dashboard opens at http://localhost:3000 and talks to the API on `:8000`.

### 4. Stop everything

```bash
docker compose down
```

---

## Getting the data

If you only want to run the demo (use the dashboard, hit the API), you **don't need to download any data** — the pre-trained models in `models/` and the pre-computed JSONs in `results/` are enough.

If you want to re-run notebooks or rebuild the feature table, you have two options.

### Option A: download the team's pre-built data (recommended, ~2.4 GB)

1. Download `data.zip` from this Mega link:

   > https://mega.nz/file/GR93WLxJ#1ZrVip0o4_IyUySZhk_vwzEj8ikQvN4W_djRNrXq_cs

2. Drop `data.zip` next to (or inside) the repo and run:

   | OS | Command |
   |----|---------|
   | macOS / Linux / Git Bash | `bash scripts/setup_data.sh` |
   | Windows (PowerShell) | `powershell -ExecutionPolicy Bypass -File scripts\setup_data.ps1` |

   This extracts the cleaned `flights_clean/` and `weather_clean/` Parquet (and the original raw CSVs) into `data/processed/` and `data/raw/` without overwriting anything already there.

If you also want the 57-column feature table (skip the feature engineering notebook), grab the additional `features.zip` (~3 GB):

> https://mega.nz/file/Lm513YZI#yVipg-JgrCyvGj3dxJMrz162kpxx_Wf6yw2SIiNeuhw

Extract it into `data/processed/features/final/` — the zip's top level is `Year=2019/ ... Year=2024/`.

### Option B: rebuild from raw data (slow, full ETL)

```bash
docker exec -it skypath-jupyter bash
pip install requests
python /src/etl/download_flights.py    # ~15–20 GB, takes a while
python /src/etl/download_weather.py    # ~200 MB
spark-submit --master local[*] --driver-memory 8g /src/etl/clean_flights.py
spark-submit --master local[*] --driver-memory 8g /src/etl/clean_weather.py
```

Then run `notebooks/04_feature_engineering.ipynb` to produce `data/processed/features/final/`.

### Sanity check

Inside the Jupyter container, this should print the expected row counts:

```python
from pyspark.sql import SparkSession
spark = SparkSession.builder.appName("verify").getOrCreate()

flights  = spark.read.parquet("/data/processed/flights_clean")     # 37,786,688 rows x 27 cols
weather  = spark.read.parquet("/data/processed/weather_clean")     #  1,474,038 rows x 17 cols
features = spark.read.parquet("/data/processed/features/final")    # 37,786,688 rows x 57 cols
```

---

## Project structure

```
Big-Data-Project/
├── docker-compose.yml          # Spark + MongoDB + API stack
├── scripts/                    # Setup helpers (bash + PowerShell)
├── data/
│   ├── raw/                    # BTS / IEM CSVs + airports.csv
│   └── processed/              # flights_clean, weather_clean, features/final (Parquet)
├── src/etl/                    # Data download + cleaning Spark jobs
├── notebooks/
│   ├── 04_feature_engineering.ipynb   # Weather join + ripple + historical features
│   ├── 05_analysis.ipynb              # 8 Spark SQL analyses + Spark vs Dask benchmark
│   ├── ml.ipynb                       # GBT training (pre- and post-departure models)
│   └── ml_data_validation.ipynb       # Quick data sanity check
├── api/
│   └── app.py                  # FastAPI service (predictions + analysis endpoints)
├── frontend/                   # React 19 + Vite + ECharts dashboard
├── models/                     # Saved Spark MLlib pipelines (pre/post variants)
├── results/
│   ├── analysis/               # 8 analysis JSONs + airport_coords.json
│   ├── figures/                # PNG charts
│   └── model_evaluation.json   # Final model metrics
└── docs/
    ├── api_reference.md        # All 7 REST endpoints, request/response schemas
    ├── data_dictionary.md      # Field-by-field definitions
    ├── how_to_run.md           # Detailed startup + troubleshooting
    └── ml_modeling.md          # Modeling methodology, feature selection, evaluation
```

---

## Pipeline

```
BTS Flight CSVs ──→ clean_flights.py ──→ flights_clean (Parquet)
                                              │
IEM Weather CSVs ──→ clean_weather.py ──→ weather_clean (Parquet)
                                              │
OurAirports CSV ──────────────────────────────┤
                                              ▼
                                   Feature Engineering
                                   ├─ Timezone-aware weather join
                                   ├─ Tail Number Tracking (Ripple Effect)
                                   └─ Leak-safe historical aggregates
                                              │
                                              ▼
                                      features/final (Parquet, 57 cols)
                                        │           │
                                        ▼           ▼
                                  ML Training   Statistical Analysis
                                   (Spark MLlib  (Spark SQL;
                                    GBT × 2)     Dask benchmark)
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

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Distributed compute | Apache Spark 3.5.0 (PySpark + Spark SQL); Dask used as a benchmark comparison on one analysis query |
| Bulk storage | Parquet on local filesystem, partitioned by Year/Month |
| Serving store | MongoDB 7 — `skypath.analysis`, `skypath.model_metrics`, `skypath.predictions` collections |
| ML | Spark MLlib — Gradient Boosted Trees (classifier + regressor) |
| API | FastAPI + Uvicorn (Python) — port 8000 |
| Frontend | React 19 + Vite 8 + ECharts 6 + Ant Design 6 |
| Infrastructure | Docker Compose |

---

## Data sources

| Dataset | Source | Records | Description |
|---------|--------|---------|-------------|
| BTS On-Time Performance | [transtats.bts.gov](https://www.transtats.bts.gov/DL_SelectFields.aspx?gnoyr_VQ=FGJ) | 37.8 M | U.S. domestic flights, 2019–2024 |
| IEM ASOS / METAR | [mesonet.agron.iastate.edu](https://mesonet.agron.iastate.edu/request/download.phtml) | 1.5 M | Hourly weather at 24 hub airports |
| OurAirports | [ourairports.com](https://ourairports.com/data/) | 85 K | IATA / ICAO mapping, lat/lon |

See [`docs/data_dictionary.md`](docs/data_dictionary.md) for full schema details.

---

## The feature table (`features/final`, 37,786,688 rows × 57 columns)

The columns fall into seven groups, derived in `notebooks/04_feature_engineering.ipynb`:

| Group | # cols | Highlights |
|-------|-------:|-----------|
| Original BTS flight fields | 23 | `FlightDate`, `Reporting_Airline`, `Tail_Number`, `Origin`, `Dest`, `DepDelay`, `ArrDelay`, the five BTS cause fields |
| Derived time | 4 | `Year`, `Month`, `DayOfWeek`, `DepHour` |
| Timezone alignment | 4 | `origin_tz`, `dep_utc_ts`, `dep_utc_date`, `dep_utc_hour` — flight local time converted to UTC via an IATA → IANA map for the 24 hubs |
| Weather (joined) | 8 | `temperature`, `dewpoint`, `humidity`, `wind_direction`, `wind_speed`, `visibility`, `precipitation`, `weather_codes` |
| Weather derived | 4 | `has_weather_data`, `is_low_visibility`, `is_high_wind`, `has_precipitation` (null-safe: null means unknown, not "clear") |
| Ripple (prediction-safe) | 5 | `flight_leg`, `prev_arr_delay`, `prev_origin`, `prev_dest`, `inherited_delay` — computed via a Spark window over `(Tail_Number, FlightDate)` ordered by `CRSDepTime` |
| Ripple ⚠ analysis-only | 2 | `cumulative_delay`, `delay_recovery` — include the current row's `ArrDelay`; **never use as ML features**, only for descriptive stats |
| Historical aggregates (leak-safe) | 7 | Route / airport / carrier averages computed on `Year ≤ 2023` only, so 2024 stays a clean test set |

**Coverage caveats:**
- Weather fields are null for non-hub origins (~43.8% of rows). Use the `has_weather_data` flag to filter or impute.
- Historical aggregates are only computed on 2019–2023, so they're safe to use as features when training on those years.

---

## Results

### Analytics (Spark SQL on the full 37.8 M dataset)

| File (`results/analysis/`) | What it contains |
|----------------------------|------------------|
| `overview.json` | 81.99% on-time rate · avg arrival delay 4.65 min · avg departure delay 10.44 min |
| `carriers.json` | Per-airline on-time rate, cause breakdown (all U.S. domestic carriers) |
| `airports.json` | Departure / arrival delay rate for all 382 airports in the dataset |
| `temporal.json` | Delay patterns by month, day-of-week, and departure hour |
| `attribution.json` | Late Aircraft 38.3% · Carrier 36.4% · NAS 19.2% · Weather 5.8% · Security 0.2% |
| `ripple.json` | Overall 27.0% propagation rate; per-carrier ranking (WN 35.8% → OO 15.7%) |
| `routes.json` | Stats for 8,403 Origin–Dest pairs |
| `spark_vs_dask.json` | Same Top-20 aggregation: Spark SQL 218 s vs Dask 380 s (1.74× speedup) |

Charts (PNG) are saved alongside the JSONs.

### Models

Both trained on 30.8 M flights (2019–2023) and evaluated on 6.96 M held-out 2024 flights.

| Model | Classifier AUC | Classifier F1 | Regressor RMSE | Regressor R² | Use case |
|-------|:--------------:|:-------------:|:--------------:|:------------:|----------|
| Post-departure (uses `DepDelay`) | 0.9345 | 0.8876 | 20.7 min | 0.9199 | Operational rebooking |
| Pre-departure (no `DepDelay`) | 0.8102 | 0.7633 | 64.6 min | 0.2192 | Booking-time prediction |

See `docs/ml_modeling.md` for feature selection, hyperparameters, leakage controls, and feature importance.

---

## API in 30 seconds

```bash
# Pre-departure prediction (passenger-facing — no DepDelay)
curl -X POST http://localhost:8000/predict/pre \
  -H "Content-Type: application/json" \
  -d '{"Reporting_Airline":"AA","Origin":"JFK","Dest":"LAX",
       "Month":7,"DayOfWeek":3,"DepHour":14,"CRSDepTime":1430}'

# Post-departure prediction (DepDelay observed)
curl -X POST http://localhost:8000/predict/post \
  -H "Content-Type: application/json" \
  -d '{"Reporting_Airline":"AA","Origin":"JFK","Dest":"LAX",
       "Month":7,"DayOfWeek":3,"DepHour":14,"CRSDepTime":1430,"DepDelay":15}'

# Pre-computed analyses
curl http://localhost:8000/api/analysis/attribution
curl http://localhost:8000/api/analysis/ripple
curl http://localhost:8000/api/carriers
curl http://localhost:8000/api/airports?limit=20
curl http://localhost:8000/route/JFK/LAX
curl http://localhost:8000/health
```

Full request / response schemas are in [`docs/api_reference.md`](docs/api_reference.md).

---

## More documentation

- [`docs/how_to_run.md`](docs/how_to_run.md) — Detailed startup, MongoDB seeding, troubleshooting
- [`docs/api_reference.md`](docs/api_reference.md) — All seven REST endpoints with request/response schemas and example `curl` calls
- [`docs/ml_modeling.md`](docs/ml_modeling.md) — Feature selection rationale, two-model design, hyperparameters, evaluation, feature importance
- [`docs/data_dictionary.md`](docs/data_dictionary.md) — Every column in `flights_clean` and `weather_clean`
