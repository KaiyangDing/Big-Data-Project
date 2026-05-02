import glob
import json
import os
import datetime
from contextlib import asynccontextmanager
from typing import Optional

import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from pymongo import MongoClient

from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.ml import PipelineModel
from pyspark.ml.classification import GBTClassificationModel
from pyspark.ml.regression import GBTRegressionModel


_spark    = None
_mongo_db = None
_models   = {}   # keyed by "post" / "pre"
_airport_coords: dict = {}  # iata_code -> {lat, lon, name}
_ROUTE_DISTANCE_VIEW = "route_distances"

_ANALYSIS_NAMES = {
    "airports", "carriers", "overview", "temporal",
    "attribution", "ripple", "routes", "spark_vs_dask",
}


def _load_airport_coords() -> dict:
    """Load iata_code -> {lat, lon} from pre-generated results/analysis/airport_coords.json."""
    path = "/results/analysis/airport_coords.json"
    if not os.path.exists(path):
        print(f"[coords] {path} not found, map will have no coordinates")
        return {}
    with open(path) as f:
        coords = json.load(f)
    print(f"[coords] loaded {len(coords)} IATA → lat/lon entries")
    return coords


def _load_route_distances() -> None:
    """Load route distance lookup into Spark for prediction-time enrichment."""
    path = "/results/analysis/routes.json"
    if not os.path.exists(path):
        print(f"[routes] {path} not found, prediction distance lookup unavailable")
        return

    routes_df = (
        _spark.read
        .option("multiLine", "true")
        .json(path)
        .select(
            F.upper(F.col("Origin")).alias("Origin"),
            F.upper(F.col("Dest")).alias("Dest"),
            F.col("avg_distance_miles").cast("double").alias("Distance"),
        )
        .where(F.col("Distance").isNotNull())
        .cache()
    )
    routes_df.createOrReplaceTempView(_ROUTE_DISTANCE_VIEW)
    print(f"[routes] loaded {routes_df.count()} route distance entries into Spark")


def _seed_mongo(db) -> None:
    """Populate MongoDB from result JSON files on first startup (when collections are empty)."""
    if db.analysis.count_documents({}) == 0:
        analysis_dir = "/results/analysis"
        for path in glob.glob(f"{analysis_dir}/*.json"):
            name = os.path.splitext(os.path.basename(path))[0]
            if name not in _ANALYSIS_NAMES:
                continue
            with open(path) as f:
                data = json.load(f)
            db.analysis.replace_one({"name": name}, {"name": name, "data": data}, upsert=True)
        print(f"[seed] analysis collection populated from {analysis_dir}")

    if db.model_metrics.count_documents({}) == 0:
        eval_path = "/results/model_evaluation.json"
        if os.path.exists(eval_path):
            with open(eval_path) as f:
                combined = json.load(f)
            for key in ("post_departure", "pre_departure"):
                if key in combined:
                    db.model_metrics.replace_one(
                        {"model_type": key}, combined[key], upsert=True
                    )
            print(f"[seed] model_metrics collection populated from {eval_path}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _spark, _mongo_db, _models

    _spark = (
        SparkSession.builder
        .appName("SkyPath-API")
        .config("spark.driver.memory", "4g")
        .config("spark.sql.shuffle.partitions", "8")
        .getOrCreate()
    )
    _spark.sparkContext.setLogLevel("ERROR")

    _models["post"] = {
        "preprocessor": PipelineModel.load("/models/preprocessor"),
        "classifier":   GBTClassificationModel.load("/models/classifier"),
        "regressor":    GBTRegressionModel.load("/models/regressor"),
    }
    _models["pre"] = {
        "preprocessor": PipelineModel.load("/models/pre_departure/preprocessor"),
        "classifier":   GBTClassificationModel.load("/models/pre_departure/classifier"),
        "regressor":    GBTRegressionModel.load("/models/pre_departure/regressor"),
    }

    mongo_uri = os.getenv("MONGO_URI", "mongodb://skypath-mongo:27017/")
    _mongo_db = MongoClient(mongo_uri)["skypath"]

    _seed_mongo(_mongo_db)

    global _airport_coords
    _airport_coords = _load_airport_coords()
    _load_route_distances()

    yield

    _spark.stop()


app = FastAPI(title="SkyPath Analytics API", lifespan=lifespan)


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class PreDepartureRequest(BaseModel):
    Reporting_Airline: str
    Origin: str
    Dest: str
    Month: int
    DayOfWeek: int                  # 1=Sun ... 7=Sat
    DepHour: int                    # 0-23
    CRSDepTime: int                 # e.g. 1430
    Distance: Optional[float] = None # accepted for compatibility; overwritten from Spark route lookup
    flight_leg: int = 1
    prev_arr_delay: float = 0.0
    cumulative_delay_prior: float = 0.0
    inherited_delay: float = 0.0
    temperature: Optional[float] = None
    dewpoint: Optional[float] = None
    humidity: Optional[float] = None
    wind_direction: Optional[float] = None
    wind_speed: Optional[float] = None
    visibility: Optional[float] = None
    precipitation: Optional[float] = None
    has_weather_data: int = 0
    is_low_visibility: int = 0
    is_high_wind: int = 0
    has_precipitation: int = 0
    route_total_flights: float = 0.0
    route_avg_delay: float = 0.0
    route_on_time_rate: float = 0.0
    carrier_avg_delay: float = 0.0
    carrier_on_time_rate: float = 0.0
    origin_avg_dep_delay: float = 0.0
    origin_std_dep_delay: float = 0.0


class PostDepartureRequest(PreDepartureRequest):
    DepDelay: float = 0.0


# ---------------------------------------------------------------------------
# Prediction helper
# ---------------------------------------------------------------------------

def _predict(row: dict, model_key: str) -> dict:
    # delay_recovery is required by the Imputer stage in the saved pipeline
    # but is excluded from features (leaky). Always supply None so the Imputer
    # replaces it with the training-set mean, which has no effect on the output.
    row["delay_recovery"] = None

    pdf = pd.DataFrame([row])
    # Cast all non-string columns to float64 so Spark can infer types even when
    # optional fields (e.g. weather) are None/NaN.
    str_cols = {"Reporting_Airline", "Origin", "Dest"}
    for col in pdf.columns:
        if col not in str_cols:
            pdf[col] = pd.to_numeric(pdf[col], errors="coerce")

    input_df = _spark.createDataFrame(pdf)

    m = _models[model_key]
    features_df = m["preprocessor"].transform(input_df)

    cls_row = m["classifier"].transform(features_df).select("prediction", "probability").first()
    reg_row = m["regressor"].transform(features_df).select("prediction").first()

    return {
        "delay_probability":       round(float(cls_row["probability"][1]), 4),
        "is_delayed_predicted":    bool(cls_row["prediction"]),
        "estimated_delay_minutes": round(float(reg_row["prediction"]), 1),
    }


def _resolve_distance(origin: str, dest: str) -> float:
    if not _spark.catalog.tableExists(_ROUTE_DISTANCE_VIEW):
        raise HTTPException(status_code=500, detail="Route distance lookup is not available")

    origin = origin.upper()
    dest = dest.upper()
    distance_row = (
        _spark.table(_ROUTE_DISTANCE_VIEW)
        .where((F.col("Origin") == origin) & (F.col("Dest") == dest))
        .select("Distance")
        .first()
    )
    if not distance_row:
        raise HTTPException(status_code=404, detail=f"No distance data for {origin} -> {dest}")
    return float(distance_row["Distance"])


def _request_with_distance(req: PreDepartureRequest) -> dict:
    row = req.model_dump()
    row["Origin"] = row["Origin"].strip().upper()
    row["Dest"] = row["Dest"].strip().upper()
    row["Distance"] = _resolve_distance(row["Origin"], row["Dest"])
    return row


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "healthy", "spark": _spark is not None}


@app.post("/predict/pre")
def predict_pre(req: PreDepartureRequest):
    row = _request_with_distance(req)
    result = _predict(row, "pre")
    result["model"] = "pre_departure"
    _mongo_db.predictions.insert_one({**result, "input": row,
                                      "timestamp": datetime.datetime.utcnow()})
    return result


@app.post("/predict/post")
def predict_post(req: PostDepartureRequest):
    row = _request_with_distance(req)
    result = _predict(row, "post")
    result["model"] = "post_departure"
    _mongo_db.predictions.insert_one({**result, "input": row,
                                      "timestamp": datetime.datetime.utcnow()})
    return result


@app.get("/api/analysis/{name}")
def get_analysis(name: str):
    doc = _mongo_db.analysis.find_one({"name": name}, {"_id": 0, "data": 1})
    if not doc:
        raise HTTPException(status_code=404, detail=f"'{name}' not found")
    return doc["data"]


@app.get("/api/airports")
def get_airports(limit: int = 50, min_flights: int = 10000):
    doc = _mongo_db.analysis.find_one({"name": "airports"}, {"_id": 0, "data": 1})
    if not doc:
        return []
    data = doc["data"]
    airports = data if isinstance(data, list) else data.get("airports", [])
    airports = [a for a in airports
                if a.get("total_departures", a.get("departures", 0)) >= min_flights]
    for a in airports:
        coord = _airport_coords.get(a.get("airport_code", ""))
        if coord:
            a["lat"] = coord["lat"]
            a["lon"] = coord["lon"]
        else:
            a["lat"] = None
            a["lon"] = None
    return airports[:limit]


@app.get("/api/carriers")
def get_carriers():
    doc = _mongo_db.analysis.find_one({"name": "carriers"}, {"_id": 0, "data": 1})
    return doc["data"] if doc else {}


@app.get("/route/{origin}/{dest}")
def get_route(origin: str, dest: str):
    doc = _mongo_db.analysis.find_one({"name": "routes"}, {"_id": 0, "data": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Route data not available")
    data = doc["data"]
    routes = data if isinstance(data, list) else data.get("routes", [])
    matched = [r for r in routes
               if r.get("Origin") == origin.upper()
               and r.get("Dest") == dest.upper()]
    if not matched:
        raise HTTPException(status_code=404,
                            detail=f"No data for {origin.upper()} -> {dest.upper()}")
    return matched[0]
