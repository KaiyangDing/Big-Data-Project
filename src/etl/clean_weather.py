import os
import glob

from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import FloatType


spark = (
    SparkSession.builder
    .appName("ETL-Weather")
    .config("spark.sql.shuffle.partitions", "8")
    .config("spark.driver.memory", "8g")
    .config("spark.sql.legacy.timeParserPolicy", "LEGACY")
    .getOrCreate()
)
spark.sparkContext.setLogLevel("WARN")
print("Spark up")

# Container paths
WEATHER_DIR   = "/data/raw/weather"
AIRPORTS_PATH = "/data/raw/airports.csv"
OUTPUT_PATH   = "/data/processed/weather_clean"

# Find the per-state weather CSVs
print("Scanning weather CSV files...")
weather_files = glob.glob(os.path.join(WEATHER_DIR, "*.csv"))
print(f"  Found {len(weather_files)} files")
if len(weather_files) == 0:
    raise FileNotFoundError(f"No weather CSVs found in {WEATHER_DIR}")
for f in sorted(weather_files):
    print(f"  {os.path.basename(f)}")

# Read them in. IEM puts # comment lines at the top of each file — comment="#" skips those.
print("\nReading weather data...")
weather_df = spark.read.csv(
    weather_files,
    header=True,
    inferSchema=False,
    nullValue="",
    comment="#",
)
print(f"  Raw rows:    {weather_df.count():>10,}")
print(f"  Raw columns: {len(weather_df.columns)}")
print(f"  Columns:     {weather_df.columns}")

# IEM station codes are already IATA codes for these hubs (PHX, SAN, LAX, ...),
# so we just rename them directly. No ICAO translation needed.
weather_df = (
    weather_df
    .withColumnRenamed("station", "iata_code")
    .withColumnRenamed("valid",   "obs_time")
)

# Parse timestamp.
# IEM uses non-padded formats like "2019/1/1 0:51" most of the time, but we've seen
# a few variants — try each.
print("\nParsing obs_time...")
weather_df = weather_df.withColumn(
    "obs_time",
    F.coalesce(
        F.try_to_timestamp(F.col("obs_time"), F.lit("yyyy/M/d H:mm:ss")),
        F.try_to_timestamp(F.col("obs_time"), F.lit("yyyy/M/d HH:mm:ss")),
        F.try_to_timestamp(F.col("obs_time"), F.lit("yyyy/M/d H:mm")),
        F.try_to_timestamp(F.col("obs_time"), F.lit("yyyy-MM-dd HH:mm:ss")),
        F.try_to_timestamp(F.col("obs_time"), F.lit("yyyy-MM-dd HH:mm")),
        F.try_to_timestamp(F.col("obs_time"), F.lit("yyyy-MM-dd H:mm")),
    )
)
weather_df = weather_df.withColumn("obs_date", F.to_date("obs_time"))
weather_df = weather_df.withColumn("obs_hour", F.hour("obs_time"))

time_null = weather_df.filter(F.col("obs_time").isNull()).count()
total     = weather_df.count()
print(f"  Failed timestamp parses: {time_null:,} ({time_null/total*100:.2f}%)")

# Clean up numeric columns.
# IEM sentinels we need to handle:
#   'M'      -> null  (missing)
#   'T'      -> 0.0   (trace precipitation)
#   '#NAME?' -> null  (Excel mangled the file at some point)
print("\nCleaning numeric columns...")
NUMERIC_COLS = ["tmpf", "dwpf", "relh", "drct", "sknt", "p01i", "vsby"]

for col in NUMERIC_COLS:
    if col in weather_df.columns:
        weather_df = weather_df.withColumn(
            col,
            F.when(F.col(col) == "M",       None)
             .when(F.col(col) == "T",        0.0)
             .when(F.col(col) == "#NAME?",   None)
             .when(F.col(col) == "#NAME!",   None)
             .when(F.col(col) == "",         None)
             .otherwise(F.col(col))
             .cast(FloatType())
        )
        print(f"  ok: {col}")
    else:
        print(f"  skipped (column missing): {col}")

# wxcodes stays as string, just drop the sentinel values
if "wxcodes" in weather_df.columns:
    weather_df = weather_df.withColumn(
        "wxcodes",
        F.when(F.col("wxcodes") == "M",      None)
         .when(F.col("wxcodes") == "#NAME?", None)
         .when(F.col("wxcodes") == "#NAME!", None)
         .when(F.col("wxcodes") == "",       None)
         .otherwise(F.col("wxcodes"))
    )
    print("  ok: wxcodes (kept as string)")

# Drop garbage rows and clamp to the date range we care about
print("\nFiltering invalid records...")
before = weather_df.count()
weather_df = weather_df.filter(
    F.col("obs_time").isNotNull() &
    F.col("iata_code").isNotNull() &
    F.col("obs_date").between("2019-01-01", "2024-12-31")
)
after = weather_df.count()
print(f"  Before: {before:>10,}")
print(f"  After:  {after:>10,}  (removed {before - after:,})")

# Attach airport name + lat/lon from OurAirports.
# IEM iata_code joins directly against airports.iata_code.
print(f"\nLoading airport metadata: {AIRPORTS_PATH}")
try:
    airports_df = spark.read.csv(
        AIRPORTS_PATH,
        header=True,
        inferSchema=False,
    )
    airports_df = (
        airports_df
        .select(
            F.col("iata_code"),
            F.col("name").alias("airport_name"),
            F.col("latitude_deg").cast(FloatType()),
            F.col("longitude_deg").cast(FloatType()),
        )
        .filter(
            F.col("iata_code").isNotNull() &
            (F.col("iata_code") != "")
        )
    )
    print(f"  Airport rows: {airports_df.count():,}")

    weather_df = weather_df.join(airports_df, on="iata_code", how="left")

    matched = weather_df.filter(F.col("airport_name").isNotNull()).count()
    total_w = weather_df.count()
    print(f"  IATA match rate: {matched/total_w*100:.1f}%  ({matched:,}/{total_w:,})")

except Exception as e:
    print(f"  Could not load airport metadata, skipping: {e}")
    weather_df = (
        weather_df
        .withColumn("airport_name",  F.lit(None).cast("string"))
        .withColumn("latitude_deg",  F.lit(None).cast(FloatType()))
        .withColumn("longitude_deg", F.lit(None).cast(FloatType()))
    )

# Quick summary
final_count = weather_df.count()
print(f"\nCleaned weather summary")
print(f"  Rows:    {final_count:>10,}")
print(f"  Columns: {len(weather_df.columns)}")

print("\n  Null rate per column:")
for col_name in ["tmpf", "dwpf", "relh", "drct", "sknt", "p01i", "vsby", "wxcodes"]:
    if col_name in weather_df.columns:
        null_count = weather_df.filter(F.col(col_name).isNull()).count()
        print(f"  {col_name:<10} : {null_count:>8,}  ({null_count/final_count*100:.1f}%)")

print("\n  Date range:")
weather_df.select(
    F.min("obs_date").alias("min_date"),
    F.max("obs_date").alias("max_date"),
).show(truncate=False)

print("  Rows per station:")
weather_df.groupBy("iata_code").count() \
  .orderBy(F.desc("count")).show(30, truncate=False)

# Add Year/Month partition columns then write
weather_df = (
    weather_df
    .withColumn("Year",  F.year("obs_date"))
    .withColumn("Month", F.month("obs_date"))
)

print(f"\nWriting Parquet to {OUTPUT_PATH}")
(
    weather_df.write
    .partitionBy("Year", "Month")
    .mode("overwrite")
    .parquet(OUTPUT_PATH)
)
print("Done.")

# Sanity check
print("\nVerifying output...")
verify_df = spark.read.parquet(OUTPUT_PATH)
print(f"  Rows read back: {verify_df.count():>10,}")
print(f"  Columns:        {len(verify_df.columns)}")
print("\n  Schema:")
verify_df.printSchema()

spark.stop()
print("\nAll done.")
