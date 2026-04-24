# SkyPath ML Modeling Documentation

## Overview

SkyPath uses **Gradient Boosted Trees (GBT)** from Apache Spark MLlib to predict flight arrival delays. Two separate model versions are trained and served: one for **post-departure** (real-time operational) use and one for **pre-departure** (passenger-facing) use.

- **Task 1 — Classification:** predict whether a flight will arrive more than 15 minutes late (`ArrDelay > 15`).
- **Task 2 — Regression:** predict the actual arrival delay in minutes (`ArrDelay`).

---

## Dataset

| Split | Filter | Rows |
|-------|--------|------|
| Train | `Year <= 2023` | 30,821,441 |
| Test  | `Year == 2024` | 6,965,247 |
| Total | | 37,786,688 |

The temporal split ensures no future data leaks into training. Year 2024 is held out as an unseen test set.

---

## Features

### Categorical Features (encoded via StringIndexer)

| Feature | Description |
|---------|-------------|
| `Reporting_Airline` | IATA carrier code (e.g. `AA`, `DL`) |
| `Origin` | Departure airport IATA code |
| `Dest` | Arrival airport IATA code |

Each is encoded to a numeric `_idx` column with `handleInvalid="keep"` so unseen airports/carriers at inference time don't cause errors.

### Numeric Features — Post-Departure Model (29 features)

| Group | Features |
|-------|---------|
| Time | `Month`, `DayOfWeek`, `DepHour`, `CRSDepTime` |
| Flight | `Distance`, **`DepDelay`** |
| Ripple effect | `flight_leg`, `prev_arr_delay`, `cumulative_delay_prior`, `inherited_delay` |
| Weather | `temperature`, `dewpoint`, `humidity`, `wind_direction`, `wind_speed`, `visibility`, `precipitation` |
| Weather flags | `has_weather_data`, `is_low_visibility`, `is_high_wind`, `has_precipitation` |
| Historical stats | `route_total_flights`, `route_avg_delay`, `route_on_time_rate`, `carrier_avg_delay`, `carrier_on_time_rate`, `origin_avg_dep_delay`, `origin_std_dep_delay` |

### Numeric Features — Pre-Departure Model (28 features)

Identical to the post-departure list but **`DepDelay` is removed**, because the departure delay is not known before a flight pushes back.

---

## Feature Engineering Decisions

### Ripple Effect Features

Long-haul and connecting operations mean delays propagate through a day's schedule. Three features capture this:

- **`flight_leg`**: sequential leg number for an aircraft tail on a given date (1 = first flight of the day).
- **`prev_arr_delay`**: arrival delay of the immediately preceding leg.
- **`inherited_delay`**: delay carried forward from the aircraft's previous leg (turnaround time slack minus actual delay).
- **`cumulative_delay_prior`**: sum of `ArrDelay` for all **earlier** legs of the same tail number on the same date, computed as:
  ```python
  F.sum('ArrDelay').over(window_spec.rowsBetween(Window.unboundedPreceding, -1))
  ```
  The window deliberately stops at `-1` (the row immediately before the current row) to prevent data leakage — the original feature engineering used `Window.currentRow`, which included the current flight's own arrival delay in its input.

### Excluded Feature: `delay_recovery`

`delay_recovery` is defined as `prev_arr_delay - ArrDelay`. Because it directly encodes the target variable (`ArrDelay`), including it as a feature would constitute **data leakage** — the model would learn a near-perfect solution that fails on real predictions where `ArrDelay` is unknown. It is excluded from both model versions.

It is still present in the Imputer pipeline stage (as a dummy pass-through) because the saved preprocessor was fitted with it in the `ripple_cols` imputer input. The API always supplies it as `None` so the Imputer replaces it with the training-set mean, with no effect on the output.

### Why Two Model Versions?

| Aspect | Post-Departure | Pre-Departure |
|--------|---------------|---------------|
| Key distinguishing feature | Includes `DepDelay` | Excludes `DepDelay` |
| `DepDelay` availability | Known after pushback | Not yet known |
| Primary use case | Real-time ops dashboards, airline crew | Passenger apps, booking tools |
| Classifier AUC | 0.9345 | 0.8102 |
| Regressor R² | 0.9199 | 0.2192 |

`DepDelay` (the actual departure delay) dominates post-departure predictions with 67% feature importance — a flight that departs 30 minutes late is very likely to arrive late. Passengers checking before departure cannot know this value, so training a separate model without it gives them an honest prediction from available signals (route history, weather, schedule).

---

## Preprocessing Pipeline

```
Imputer (ripple_cols, strategy=mean)
  → Imputer (weather_cols + hist_cols, strategy=mean)
  → StringIndexer × 3 (Reporting_Airline, Origin, Dest)
  → VectorAssembler (all numeric + _idx cols → "features")
```

- **`handleInvalid="keep"`** on StringIndexer: unseen labels get a reserved index rather than raising an error.
- **`handleInvalid="skip"`** on VectorAssembler: rows with remaining nulls after imputation are dropped from training (preserves majority of data).
- The pipeline is fitted on the training set only, then applied to both train and test.

---

## Model Hyperparameters

Both models use GBT from `pyspark.ml.classification.GBTClassifier` / `pyspark.ml.regression.GBTRegressor`.

| Parameter | Classifier (post) | Regressor (post) | Classifier (pre) | Regressor (pre) |
|-----------|-------------------|------------------|------------------|-----------------|
| `maxIter` | 150 | 50 | 150 | 150 |
| `maxDepth` | 6 | 6 | 6 | 6 |
| `stepSize` | 0.05 | 0.1 | 0.05 | 0.05 |
| `maxBins` | 512 | 512 | 512 | 512 |
| `seed` | 42 | 42 | 42 | 42 |

`maxBins=512` is required because the `Origin`/`Dest` StringIndexer produces up to ~380 distinct airport values, which exceeds the GBT default of 32 bins.

---

## Evaluation Results (Test Set: Year 2024)

### Post-Departure Models

| Metric | Value |
|--------|-------|
| Classifier AUC | **0.9345** |
| Classifier F1 | **0.8876** |
| Classifier Accuracy | **0.8910** |
| Regressor RMSE | **20.70 min** |
| Regressor MAE | **12.72 min** |
| Regressor R² | **0.9199** |

### Pre-Departure Models

| Metric | Value |
|--------|-------|
| Classifier AUC | **0.8102** |
| Classifier F1 | **0.7633** |
| Classifier Accuracy | **0.7805** |
| Regressor RMSE | **64.62 min** |
| Regressor MAE | **29.60 min** |
| Regressor R² | **0.2192** |

The lower R² for the pre-departure regressor (0.22 vs 0.92) is expected: without `DepDelay`, the model cannot explain variance caused by ground delays that are not predictable from schedule or weather alone. The AUC of 0.81 still gives passengers useful probabilistic guidance.

---

## Feature Importance (Top 15, Classifier)

### Post-Departure

| Rank | Feature | Importance |
|------|---------|-----------|
| 1 | `DepDelay` | 0.6748 |
| 2 | `Dest_idx` | 0.0773 |
| 3 | `temperature` | 0.0568 |
| 4 | `Origin_idx` | 0.0452 |
| 5 | `Reporting_Airline_idx` | 0.0230 |
| 6 | `wind_speed` | 0.0182 |
| 7 | `visibility` | 0.0170 |
| 8 | `has_precipitation` | 0.0155 |
| 9 | `precipitation` | 0.0122 |
| 10 | `dewpoint` | 0.0103 |

### Pre-Departure

| Rank | Feature | Importance |
|------|---------|-----------|
| 1 | `Dest_idx` | 0.1836 |
| 2 | `Origin_idx` | 0.1170 |
| 3 | `prev_arr_delay` | 0.1133 |
| 4 | `temperature` | 0.0828 |
| 5 | `CRSDepTime` | 0.0789 |
| 6 | `precipitation` | 0.0537 |
| 7 | `Month` | 0.0489 |
| 8 | `Reporting_Airline_idx` | 0.0446 |
| 9 | `wind_speed` | 0.0444 |
| 10 | `cumulative_delay_prior` | 0.0401 |

Without `DepDelay`, route characteristics (origin/destination airport identity), the aircraft's prior leg delay, and weather become the primary signals — which aligns well with domain knowledge about what makes a route chronically delayed.

---

## Saved Model Paths

```
/models/
  preprocessor/        ← post-departure PipelineModel (Parquet)
  classifier/          ← post-departure GBTClassificationModel (Parquet)
  regressor/           ← post-departure GBTRegressionModel (Parquet)
  pre_departure/
    preprocessor/      ← pre-departure PipelineModel (Parquet)
    classifier/        ← pre-departure GBTClassificationModel (Parquet)
    regressor/         ← pre-departure GBTRegressionModel (Parquet)
```

Models are stored in Spark's native Parquet format. They are committed to the repository (only Hadoop sidecar files like `_SUCCESS` and `.crc` are gitignored).
