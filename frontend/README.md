# SkyPath Frontend Dashboard

This folder contains the React + Vite frontend for the SkyPath Analytics project. The dashboard gives users an interactive way to explore flight delay patterns from 2019-2024 and run delay predictions through the FastAPI backend.

## What the Frontend Provides

The dashboard has five main pages:

| Page | Path | Purpose |
|------|------|---------|
| Overview | `/` | Shows high-level flight delay KPIs and time-based delay trends by month, weekday, and departure hour. |
| Airlines | `/airlines` | Compares airline reliability, on-time rate rankings, delay frequency vs. severity, and delay cause breakdowns. |
| Airports | `/airports` | Visualizes airport delay patterns on a continental U.S. map, ranks delayed airports, and provides a searchable airport table. |
| Routes | `/routes` | Lets users search an origin-destination route, compare the reverse route, and inspect route-level delay statistics. |
| Predict | `/predict` | Provides pre-departure and post-departure flight delay prediction forms backed by the ML API. |

## Prerequisites

Before starting the frontend, make sure:

- Node.js and npm are installed.
- The backend API is running at `http://localhost:8000`.
- MongoDB has been seeded by the API startup process. See [`../docs/how_to_run.md`](../docs/how_to_run.md) for the full backend startup guide.

## Install Dependencies

From the repository root:

```bash
cd frontend
npm install
```

This installs React, Vite, Ant Design, ECharts, Axios, and the other frontend dependencies listed in `package.json`.

## Start the Development Server

```bash
npm run dev
```

The dashboard runs at:

```text
http://localhost:3000
```

The Vite config proxies API calls to the backend automatically:

| Frontend request | Backend target |
|------------------|----------------|
| `/api/*` | `http://localhost:8000/api/*` |
| `/route/*` | `http://localhost:8000/route/*` |
| `/predict/*` | `http://localhost:8000/predict/*` |
| `/health` | `http://localhost:8000/health` |

Because of this proxy, no extra environment variable is needed for local development.

## Optional API URL Override

If the API is not running on `localhost:8000`, set `VITE_API_URL` before starting Vite:

```bash
VITE_API_URL=http://your-api-host:8000 npm run dev
```

When `VITE_API_URL` is set, Axios sends requests directly to that base URL instead of relying on the local Vite proxy.

## How to Use the Dashboard

### Overview

Open the dashboard at `http://localhost:3000/`.

Use this page to get the project-wide picture:

- Read the KPI cards for total flights, average arrival delay, on-time rate, and cancellation rate.
- Check the monthly chart to identify seasonal delay patterns.
- Compare weekday and hourly charts to see when delays tend to accumulate.

### Airlines

Go to `http://localhost:3000/airlines`.

Use this page to compare carriers:

- Review the best on-time airline, industry average, and most delayed airline.
- Switch the ranking view between `Top 8`, `Bottom 8`, and `All`.
- Use the frequency-vs-severity chart to distinguish airlines with frequent mild delays from airlines with rarer but more severe delays.
- Read the delay cause breakdown to compare carrier, weather, NAS, security, and late aircraft delay contributions.

### Airports

Go to `http://localhost:3000/airports`.

Use this page to inspect airport-level patterns:

- Use the U.S. map to locate airports geographically.
- Scroll or drag the map to zoom and pan.
- Use `Zoom In`, `Zoom Out`, and `Reset` to control the map view.
- Change the `Top 5 Airports by` dropdown to rank airports by average arrival delay, arrival delay rate, or average departure delay.
- Search the airport table by airport code or city.

### Routes

Go to `http://localhost:3000/routes`.

Use this page to inspect origin-destination route behavior:

- Enter a three-letter origin code such as `JFK`.
- Enter a three-letter destination code such as `LAX`.
- Click `Search` to load route statistics.
- Use the swap button to reverse the route direction.
- Compare outbound vs. return route delay metrics when reverse-route data is available.
- Filter the full routes table by airport code.

### Predict

Go to `http://localhost:3000/predict`.

Use this page to run ML-backed delay prediction:

- Choose `Pre-Departure` when only scheduled flight information is available.
- Choose `Post-Departure` when the actual departure delay is already known.
- Fill in airline, origin, destination, month, day of week, and departure hour.
- In post-departure mode, also enter actual departure delay in minutes.
- Distance is looked up automatically from the selected origin and destination airports.
- Click `Predict Delay`.
- Read the probability gauge, delay risk label, and estimated delay minutes.

Example values for a quick test:

| Field | Example |
|-------|---------|
| Airline | American Airlines (`AA`) |
| Origin | `JFK` |
| Destination | `LAX` |
| Month | June |
| Day of Week | Monday |
| Departure Hour | `09:00` |
| Actual Departure Delay | `20` for post-departure mode |

## Build for Production

```bash
npm run build
```

The production build is written to `frontend/dist/`.

To preview the production build locally:

```bash
npm run preview
```

## Troubleshooting

### The page loads but charts are empty

Make sure the backend API is running and healthy:

```bash
curl http://localhost:8000/health
```

Expected response:

```json
{"status":"healthy","spark":true}
```

### API requests fail in the browser

Check that the frontend is running through Vite at `http://localhost:3000`. The local proxy only works through the Vite dev server.

Also verify the backend endpoints:

```bash
curl http://localhost:8000/api/analysis/overview
curl "http://localhost:8000/api/airports?limit=5"
curl http://localhost:8000/route/JFK/LAX
```

### Prediction takes a long time

The first prediction request can be slower because the API initializes Spark and loads model artifacts. Wait for the API logs to show that startup is complete, or check:

```bash
docker compose logs -f skypath-api
```

### Port 3000 is already in use

Start Vite on a different port:

```bash
npm run dev -- --port 3001
```

Then open `http://localhost:3001`.
