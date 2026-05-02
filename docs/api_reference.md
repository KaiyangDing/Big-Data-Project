# SkyPath API Reference

The SkyPath Analytics API is a FastAPI service that serves ML predictions and pre-computed analysis results. It runs inside the `skypath-api` Docker container on port **8000**.

Base URL (local Docker): `http://localhost:8000`

---

## Architecture

The API starts a single **SparkSession** at startup (via FastAPI's `lifespan` context manager) and loads all six model artifacts into memory once. Every prediction request reuses this session — there is no per-request Spark overhead beyond actual inference.

At startup, the same Spark session also loads `/results/analysis/routes.json` as a route-distance lookup. Prediction requests derive `Distance` automatically from `Origin` and `Dest`; clients should not send a distance value.

Results of every prediction are persisted to MongoDB (`skypath.predictions` collection) with a UTC timestamp for auditing.

---

## Endpoints

### 1. `GET /health`

Returns the service health status and confirms Spark is initialized.

**Response**

```json
{
  "status": "healthy",
  "spark": true
}
```

`spark: false` indicates Spark failed to start (check container logs).

---

### 2. `POST /predict/post`

**Post-departure prediction** — use this when the flight has already pushed back and `DepDelay` is known. This model achieves AUC 0.9345 / R² 0.9199.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `Reporting_Airline` | string | yes | IATA carrier code (e.g. `"AA"`) |
| `Origin` | string | yes | Departure airport IATA code (e.g. `"JFK"`) |
| `Dest` | string | yes | Arrival airport IATA code (e.g. `"LAX"`) |
| `Month` | int | yes | Month (1–12) |
| `DayOfWeek` | int | yes | Day of week (1=Sun, 7=Sat) |
| `DepHour` | int | yes | Scheduled departure hour (0–23) |
| `CRSDepTime` | int | yes | Scheduled departure time in HHMM format (e.g. `1430`) |
| `DepDelay` | float | no | Actual departure delay in minutes (default `0.0`) |
| `flight_leg` | int | no | Leg number for this aircraft today (default `1`) |
| `prev_arr_delay` | float | no | Previous leg arrival delay in minutes (default `0.0`) |
| `cumulative_delay_prior` | float | no | Sum of arrival delays from earlier legs today (default `0.0`) |
| `inherited_delay` | float | no | Turnaround delay inherited from previous leg (default `0.0`) |
| `temperature` | float | no | Temperature at origin (°F) |
| `dewpoint` | float | no | Dewpoint at origin (°F) |
| `humidity` | float | no | Relative humidity (%) |
| `wind_direction` | float | no | Wind direction (degrees) |
| `wind_speed` | float | no | Wind speed (knots) |
| `visibility` | float | no | Visibility (miles) |
| `precipitation` | float | no | Precipitation (inches) |
| `has_weather_data` | int | no | 1 if weather fields are populated, else 0 |
| `is_low_visibility` | int | no | 1 if visibility is critically low |
| `is_high_wind` | int | no | 1 if wind speed is critically high |
| `has_precipitation` | int | no | 1 if precipitation > 0 |
| `route_total_flights` | float | no | Historical total flights on this route |
| `route_avg_delay` | float | no | Historical average delay on this route (min) |
| `route_on_time_rate` | float | no | Historical on-time rate for this route (0–1) |
| `carrier_avg_delay` | float | no | Carrier historical average delay (min) |
| `carrier_on_time_rate` | float | no | Carrier historical on-time rate (0–1) |
| `origin_avg_dep_delay` | float | no | Origin airport historical avg departure delay (min) |
| `origin_std_dep_delay` | float | no | Std deviation of departure delay at origin |

**Example request**

```bash
curl -s -X POST http://localhost:8000/predict/post \
  -H "Content-Type: application/json" \
  -d '{
    "Reporting_Airline": "AA",
    "Origin": "JFK",
    "Dest": "LAX",
    "Month": 7,
    "DayOfWeek": 5,
    "DepHour": 8,
    "CRSDepTime": 800,
    "DepDelay": 25.0
  }'
```

**Example response**

```json
{
  "delay_probability": 0.8712,
  "is_delayed_predicted": true,
  "estimated_delay_minutes": 31.4,
  "model": "post_departure"
}
```

**Response fields**

| Field | Type | Description |
|-------|------|-------------|
| `delay_probability` | float | Probability that arrival delay > 15 min (0–1) |
| `is_delayed_predicted` | bool | True if classifier predicts delay > 15 min |
| `estimated_delay_minutes` | float | Regressor estimate of arrival delay in minutes |
| `model` | string | Always `"post_departure"` |

---

### 3. `POST /predict/pre`

**Pre-departure prediction** — use this before the flight departs. Does not use `DepDelay`. This model achieves AUC 0.8102 / R² 0.2192.

The request schema is identical to `/predict/post` **except `DepDelay` is not used**. `Distance` is derived automatically from the Spark route-distance lookup for the supplied `Origin` and `Dest`.

**Example request**

```bash
curl -s -X POST http://localhost:8000/predict/pre \
  -H "Content-Type: application/json" \
  -d '{
    "Reporting_Airline": "DL",
    "Origin": "ATL",
    "Dest": "ORD",
    "Month": 1,
    "DayOfWeek": 2,
    "DepHour": 14,
    "CRSDepTime": 1430
  }'
```

**Example response**

```json
{
  "delay_probability": 0.3421,
  "is_delayed_predicted": false,
  "estimated_delay_minutes": 8.3,
  "model": "pre_departure"
}
```

**Response fields** — same structure as `/predict/post`, with `"model": "pre_departure"`.

---

### 4. `GET /api/analysis/{name}`

Retrieves a named pre-computed analysis document from MongoDB. These documents are loaded into MongoDB from `/results/analysis/*.json` by running the last cell of `notebooks/ml.ipynb`.

**Path parameter**

| Name | Description |
|------|-------------|
| `name` | Analysis name: one of `overview`, `carriers`, `airports`, `temporal`, `attribution`, `ripple`, `routes` |

**Example**

```bash
curl -s http://localhost:8000/api/analysis/overview
```

Returns the raw JSON content of that analysis document.

**Error** — `404` if the name does not exist in MongoDB.

---

### 5. `GET /api/airports`

Returns a list of airports filtered by minimum flight volume, suitable for populating dropdowns in the frontend.

**Query parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | int | 50 | Maximum number of airports to return |
| `min_flights` | int | 10000 | Minimum `total_departures` to include an airport |

**Example**

```bash
curl -s "http://localhost:8000/api/airports?limit=10&min_flights=50000"
```

Returns an array of airport objects from the `airports` analysis document.

---

### 6. `GET /api/carriers`

Returns all carrier statistics from the `carriers` analysis document.

**Example**

```bash
curl -s http://localhost:8000/api/carriers
```

Returns the raw carriers data object. Returns `{}` if the document is not found.

---

### 7. `GET /route/{origin}/{dest}`

Returns pre-computed route statistics for a given origin–destination pair.

**Path parameters**

| Parameter | Description |
|-----------|-------------|
| `origin` | Origin airport IATA code (case-insensitive) |
| `dest` | Destination airport IATA code (case-insensitive) |

**Example**

```bash
curl -s http://localhost:8000/route/JFK/LAX
```

**Error** — `404` if no data exists for this route pair, or if the routes analysis document has not been loaded.

---

## Endpoint Test Log

The following tests were performed against the running service. All returned HTTP 200.

### Health check

```bash
curl -s http://localhost:8000/health
# → {"status":"healthy","spark":true}
```

Confirms Spark initialized and the service is ready.

### Post-departure prediction

```bash
curl -s -X POST http://localhost:8000/predict/post \
  -H "Content-Type: application/json" \
  -d '{"Reporting_Airline":"AA","Origin":"JFK","Dest":"LAX",
       "Month":7,"DayOfWeek":5,"DepHour":8,"CRSDepTime":800,
       "DepDelay":25.0}'
# → {"delay_probability":0.8712,"is_delayed_predicted":true,
#    "estimated_delay_minutes":31.4,"model":"post_departure"}
```

A 25-minute departure delay on a JFK→LAX flight in July correctly produces a high delay probability (0.87) and a positive classification.

### Pre-departure prediction

```bash
curl -s -X POST http://localhost:8000/predict/pre \
  -H "Content-Type: application/json" \
  -d '{"Reporting_Airline":"DL","Origin":"ATL","Dest":"ORD",
       "Month":1,"DayOfWeek":2,"DepHour":14,"CRSDepTime":1430}'
# → {"delay_probability":0.3421,"is_delayed_predicted":false,
#    "estimated_delay_minutes":8.3,"model":"pre_departure"}
```

A routine ATL→ORD Delta flight in January with no departure delay information produces a moderate probability (0.34), below the 0.5 threshold, so the flight is classified on-time.

### Optional fields (weather as None)

```bash
curl -s -X POST http://localhost:8000/predict/pre \
  -H "Content-Type: application/json" \
  -d '{"Reporting_Airline":"UA","Origin":"ORD","Dest":"SFO",
       "Month":3,"DayOfWeek":3,"DepHour":10,"CRSDepTime":1000}'
# → prediction with weather fields imputed to training-set means
```

Weather fields are all optional. When omitted, the preprocessing pipeline's Imputer fills them with training-set means automatically.

### Analysis endpoint

```bash
curl -s http://localhost:8000/api/analysis/carriers
# → returns the carriers analysis JSON document
```

### Airports endpoint

```bash
curl -s "http://localhost:8000/api/airports?limit=5&min_flights=100000"
# → array of top-5 high-volume airports
```

### Carriers endpoint

```bash
curl -s http://localhost:8000/api/carriers
# → carriers analysis object
```

### Route endpoint

```bash
curl -s http://localhost:8000/route/JFK/LAX
# → route stats for JFK→LAX
```

---

## Error Reference

| Status | Cause |
|--------|-------|
| 422 | Missing required field in request body (FastAPI validation) |
| 404 | Named analysis document not found in MongoDB, or no route-distance data exists for the supplied `Origin`/`Dest` |
| 500 | Spark or model inference failure (check container logs) |
