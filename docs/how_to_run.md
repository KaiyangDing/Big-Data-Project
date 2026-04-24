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

### Step 3 — (Optional) Start Jupyter

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

---

## MongoDB Initialization — Do You Need to Run It Every Time?

**No.** MongoDB uses a named Docker volume (`mongo_data`) that persists across container restarts. Once data is written, it survives `docker compose down` and `docker compose up` cycles.

You need to run the initialization notebook only in these situations:

| Situation | Action needed |
|-----------|--------------|
| First time ever starting the project | Run the last cell of `notebooks/ml.ipynb` |
| The `mongo_data` volume was explicitly deleted (`docker volume rm`) | Re-run the initialization cell |
| Analysis JSON files in `/results/analysis/` were updated | Re-run the initialization cell to push updates to MongoDB |
| Model metrics changed after retraining | Re-run the initialization cell (writes are idempotent via `replace_one(..., upsert=True)`) |

### Running the Initialization

1. Open JupyterLab at `http://localhost:8888` (token: `bigdata2024`).
2. Open `notebooks/ml.ipynb`.
3. Find the last section titled **"Load the existing models, run evaluation, and write the results to MongoDB"**.
4. Run that section's cells. They load the saved models, evaluate on the 2024 test set, and upsert results into MongoDB. They also import all seven analysis JSON files from `/results/analysis/`.

The writes are **idempotent** — running the cells multiple times is safe and will not create duplicate records.

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
       "Month":6,"DayOfWeek":1,"DepHour":9,"CRSDepTime":900,
       "Distance":2475.0}'

# Post-departure prediction (with DepDelay)
curl -s -X POST http://localhost:8000/predict/post \
  -H "Content-Type: application/json" \
  -d '{"Reporting_Airline":"AA","Origin":"JFK","Dest":"LAX",
       "Month":6,"DayOfWeek":1,"DepHour":9,"CRSDepTime":900,
       "Distance":2475.0,"DepDelay":20.0}'

# Check a pre-computed analysis document (requires MongoDB init)
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

MongoDB has not been initialized. Follow the MongoDB initialization steps above.

### `skypath-mongo` DNS not resolving

The `skypath-api` container refers to MongoDB using the hostname `skypath-mongo`. This hostname only resolves **within the Docker network**. Ensure both containers are started with `docker compose` (not `docker run` individually), so they share the same default network.

### API returns `500` on prediction endpoints

Check the container logs for a Spark exception. A common cause is that a model artifact directory is missing or corrupted under `models/`. Verify:

```bash
ls models/preprocessor models/classifier models/regressor
ls models/pre_departure/preprocessor models/pre_departure/classifier models/pre_departure/regressor
```

Each should contain Parquet `part-*.snappy.parquet` files plus `metadata/` subdirectories.
