# SkyPath — How to Run

This guide covers how to start the SkyPath Analytics stack in a Docker environment, initialize MongoDB, and verify the API is working.

---

## Prerequisites

- **Docker** and **Docker Compose** installed and running.
- The `models/` directory must contain trained model artifacts (see [ML Modeling](ml_modeling.md) for how to train them). The repository includes pre-trained models, so training is not required on a fresh checkout.
- Processed feature data at `data/processed/features/final/` is required only if you plan to run notebooks or retrain models. It is not needed to run the API.

---

## Service Overview

The `docker-compose.yml` defines three services:

| Service | Container | Port | Description |
|---------|-----------|------|-------------|
| `skypath-mongo` | `skypath-mongo` | 27017 | MongoDB 7 — persistent data store |
| `skypath-api` | `skypath-api` | 8000 | FastAPI + PySpark inference server |
| `jupyter` | `skypath-jupyter` | 8888, 4040 | JupyterLab with PySpark for notebooks |

The React frontend dashboard is run separately with Vite from the `frontend/` directory. It is not defined as a Docker Compose service.

---

## Startup Sequence

### Step 1 — Start MongoDB

MongoDB must be running before the API starts, because the API connects to it on startup.

```bash
docker compose up -d skypath-mongo
```

Verify it is healthy:

```bash
docker compose ps skypath-mongo
# STATUS should be "Up"
```

### Step 2 — Start the API

```bash
docker compose up -d skypath-api
```

The container installs Python dependencies (`fastapi`, `uvicorn`, `pymongo`, `pydantic`) on first start, then initializes a SparkSession and loads all six model artifacts. **This takes approximately 30–60 seconds.**

Check that the API is ready:

```bash
curl http://localhost:8000/health
# Expected: {"status":"healthy","spark":true}
```

If you see a connection error, the container may still be initializing. Wait a few seconds and retry. To follow startup logs:

```bash
docker compose logs -f skypath-api
```

### Step 3 — Start the Frontend Dashboard

The frontend is a React + Vite dashboard. It expects the API to be available at `http://localhost:8000`.

```bash
cd frontend
npm install
npm run dev
```

Open the dashboard at:

```text
http://localhost:3000
```

The Vite dev server proxies `/api`, `/route`, `/predict`, and `/health` requests to the backend API automatically. For a full page-by-page frontend usage guide, see [`../frontend/README.md`](../frontend/README.md).

### Step 4 — (Optional) Start Jupyter

Only needed if you want to run notebooks interactively.

```bash
docker compose up -d jupyter
```

Access JupyterLab at `http://localhost:8888` with token `bigdata2024`.

---

## Starting All Services at Once

```bash
docker compose up -d
```

The `depends_on` constraint in `docker-compose.yml` ensures `skypath-api` starts after `skypath-mongo`. Still wait ~60 seconds before calling the API health endpoint.

This command starts the Docker services only. Start the frontend separately from `frontend/` with `npm run dev`.

---

## MongoDB Initialization — Do You Need to Run It Every Time?

**No, and no manual step is needed at all.** The API container seeds MongoDB automatically on startup.

When `skypath-api` starts, it checks whether the `analysis` and `model_metrics` collections are empty. If they are, it reads the JSON files already committed to the repository and inserts them before accepting requests:

| Source file | Target collection | Documents |
|-------------|-------------------|-----------|
| `results/analysis/*.json` | `skypath.analysis` | 8 documents (one per analysis name) |
| `results/model_evaluation.json` | `skypath.model_metrics` | 2 documents (pre- and post-departure) |

MongoDB also uses a named Docker volume (`mongo_data`) that persists across restarts, so seeding only happens when the volume is genuinely empty.

| Situation | Action needed |
|-----------|--------------|
| Fresh clone on a new machine | None — `docker compose up -d` is sufficient |
| Volume deleted with `docker compose down -v` | None — API re-seeds on next startup |
| Analysis JSONs updated and you want MongoDB to reflect the change | `docker compose down -v && docker compose up -d` (volume wipe forces a reseed) |
| Model metrics changed after retraining | Same as above |

---

## Stopping Services

```bash
docker compose down
```

This stops and removes containers but **preserves** the `mongo_data` volume. MongoDB data will still be there on the next `docker compose up`.

To also delete the MongoDB volume (full reset):

```bash
docker compose down -v
```

---

## Verifying the Full Stack

After startup, run these checks:

```bash
# API health
curl http://localhost:8000/health

# Pre-departure prediction (minimal fields)
curl -s -X POST http://localhost:8000/predict/pre \
  -H "Content-Type: application/json" \
  -d '{"Reporting_Airline":"AA","Origin":"JFK","Dest":"LAX",
       "Month":6,"DayOfWeek":1,"DepHour":9,"CRSDepTime":900}'

# Post-departure prediction (with DepDelay)
curl -s -X POST http://localhost:8000/predict/post \
  -H "Content-Type: application/json" \
  -d '{"Reporting_Airline":"AA","Origin":"JFK","Dest":"LAX",
       "Month":6,"DayOfWeek":1,"DepHour":9,"CRSDepTime":900,
       "DepDelay":20.0}'

# Check a pre-computed analysis document
curl http://localhost:8000/api/analysis/carriers

# Check airports list
curl "http://localhost:8000/api/airports?limit=5"

# Check a specific route
curl http://localhost:8000/route/JFK/LAX
```

---

## Troubleshooting

### `spark: false` from `/health`

The SparkSession failed to initialize. Check:

```bash
docker compose logs skypath-api
```

Common causes:
- `JAVA_HOME` or `PYTHONPATH` environment variables not set correctly (these are configured in `docker-compose.yml` — ensure the file is unchanged).
- Insufficient memory: the API container requests 4 GB driver memory. Ensure Docker is allocated at least 6 GB RAM.

### `"detail": "'name' not found"` from `/api/analysis/{name}`

The analysis file for that name is missing from `results/analysis/`. Check that the corresponding `<name>.json` file exists under `results/analysis/`. If you recently did `docker compose down -v` and the file is present, restart the API container so it re-seeds:

```bash
docker compose restart skypath-api
```

### `skypath-mongo` DNS not resolving

The `skypath-api` container refers to MongoDB using the hostname `skypath-mongo`. This hostname only resolves **within the Docker network**. Ensure both containers are started with `docker compose` (not `docker run` individually), so they share the same default network.

### API returns `500` on prediction endpoints

Check the container logs for a Spark exception. A common cause is that a model artifact directory is missing or corrupted under `models/`. Verify:

```bash
ls models/preprocessor models/classifier models/regressor
ls models/pre_departure/preprocessor models/pre_departure/classifier models/pre_departure/regressor
```

Each should contain Parquet `part-*.snappy.parquet` files plus `metadata/` subdirectories.
