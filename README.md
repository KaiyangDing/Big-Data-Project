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
│   ├── setup.sh                # One-click environment setup
│   ├── download_data.sh        # Data download instructions & verification
│   └── run_etl.sh              # Run ETL pipeline inside container
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
├── api/                        # REST API for prediction serving
├── frontend/                   # React dashboard
├── results/
│   ├── analysis/               # Analysis output (JSON)
│   └── figures/                # Charts and plots
├── models/                     # Saved ML models
└── docs/
    └── data_dictionary.md      # Field definitions for all datasets
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

This starts three containers:
| Service | URL | Description |
|---------|-----|-------------|
| Jupyter Lab | http://localhost:8888 | Notebook environment (token: `bigdata2024`) |
| Spark Master | http://localhost:8080 | Cluster manager UI |
| Spark Worker | http://localhost:8081 | Worker status |

### 2. Get the Data

**Option A: Download pre-processed data (recommended)**

The cleaned Parquet datasets are hosted on Mega (~5 GB compressed):

> https://mega.nz/file/GR93WLxJ#1ZrVip0o4_IyUySZhk_vwzEj8ikQvN4W_djRNrXq_cs

Download and extract so that you have:
```
data/processed/flights_clean/   (Parquet, partitioned by Year/Month)
data/processed/weather_clean/   (Parquet, partitioned by Year/Month)
```

**Option B: Build from raw data**

```bash
# Enter the Jupyter container
docker exec -it jupyter bash

# Install download dependency
pip install requests

# Download raw CSVs (~20 GB flights + ~200 MB weather)
python /src/etl/download_flights.py
python /src/etl/download_weather.py

# Run ETL to produce Parquet
bash /src/../scripts/run_etl.sh
# Or run individually:
#   spark-submit --master local[*] --driver-memory 8g /src/etl/clean_flights.py
#   spark-submit --master local[*] --driver-memory 8g /src/etl/clean_weather.py
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

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Compute | Apache Spark 3.5.0 (PySpark) |
| Storage | Parquet on local filesystem (HDFS-compatible) |
| ML | Spark MLlib (GBT, Random Forest) |
| API | Python (Flask/FastAPI) |
| Frontend | React.js, ECharts, Mapbox GL JS |
| Infrastructure | Docker Compose |
