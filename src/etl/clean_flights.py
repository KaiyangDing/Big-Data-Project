import os
import glob

from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import IntegerType, FloatType


# Spark session. 8g driver is enough for the full 6 years of data.
spark = (
    SparkSession.builder
    .appName("ETL-Flights")
    .config("spark.sql.shuffle.partitions", "8")
    .config("spark.driver.memory", "8g")
    .config("spark.sql.legacy.timeParserPolicy", "LEGACY")
    .getOrCreate()
)
spark.sparkContext.setLogLevel("WARN")
print("Spark up")

# Container paths
INPUT_DIR   = "/data/raw/flights"
OUTPUT_PATH = "/data/processed/flights_clean"

# Columns we actually need from BTS (23 of them)
KEEP_COLS = [
    "FlightDate",
    "Reporting_Airline",
    "Tail_Number",
    "Flight_Number_Reporting_Airline",
    "Origin",
    "OriginCityName",
    "Dest",
    "DestCityName",
    "CRSDepTime",
    "DepTime",
    "DepDelay",
    "CRSArrTime",
    "ArrTime",
    "ArrDelay",
    "Cancelled",
    "CancellationCode",
    "Diverted",
    "Distance",
    "CarrierDelay",
    "WeatherDelay",
    "NASDelay",
    "SecurityDelay",
    "LateAircraftDelay",
]

# Find the monthly CSVs (should be 72 of them, 2019-01 .. 2024-12)
print("Scanning CSV files...")
flight_files = glob.glob(os.path.join(INPUT_DIR, "*.csv"))
print(f"  Found {len(flight_files)} files")

if len(flight_files) == 0:
    raise FileNotFoundError(f"No CSV files found under {INPUT_DIR}")

for f in sorted(flight_files)[:3]:
    print(f"  e.g. {os.path.basename(f)}")
print("  ...")

# Read everything as string first — BTS has surprises like "0.00" in int columns,
# so we control the casts ourselves below.
print("\nReading 72 CSVs (will take a minute)...")
raw_df = spark.read.csv(
    flight_files,
    header=True,
    inferSchema=False,
    nullValue="",
)
print(f"  Raw columns: {len(raw_df.columns)}")

# Keep only the columns we declared above
existing_cols = set(raw_df.columns)
missing_cols  = [c for c in KEEP_COLS if c not in existing_cols]
if missing_cols:
    print(f"  Missing from CSV (will skip): {missing_cols}")

select_cols = [c for c in KEEP_COLS if c in existing_cols]
df = raw_df.select(select_cols)
print(f"  Kept: {len(select_cols)} columns")

# Type casting.
# Note: most int fields come through as "0.00" strings — direct cast to Int fails,
# so we float-cast first and then int-cast.
df = (
    df
    .withColumn("FlightDate", F.to_date("FlightDate", "yyyy-MM-dd"))

    .withColumn("Flight_Number_Reporting_Airline",
                F.col("Flight_Number_Reporting_Airline").cast(FloatType()).cast(IntegerType()))
    .withColumn("CRSDepTime",  F.col("CRSDepTime").cast(FloatType()).cast(IntegerType()))
    .withColumn("DepTime",     F.col("DepTime").cast(FloatType()).cast(IntegerType()))
    .withColumn("CRSArrTime",  F.col("CRSArrTime").cast(FloatType()).cast(IntegerType()))
    .withColumn("ArrTime",     F.col("ArrTime").cast(FloatType()).cast(IntegerType()))
    .withColumn("Cancelled",   F.col("Cancelled").cast(FloatType()).cast(IntegerType()))
    .withColumn("Diverted",    F.col("Diverted").cast(FloatType()).cast(IntegerType()))

    .withColumn("DepDelay",          F.col("DepDelay").cast(FloatType()))
    .withColumn("ArrDelay",          F.col("ArrDelay").cast(FloatType()))
    .withColumn("Distance",          F.col("Distance").cast(FloatType()))
    .withColumn("CarrierDelay",      F.col("CarrierDelay").cast(FloatType()))
    .withColumn("WeatherDelay",      F.col("WeatherDelay").cast(FloatType()))
    .withColumn("NASDelay",          F.col("NASDelay").cast(FloatType()))
    .withColumn("SecurityDelay",     F.col("SecurityDelay").cast(FloatType()))
    .withColumn("LateAircraftDelay", F.col("LateAircraftDelay").cast(FloatType()))
)

# Drop cancelled / diverted flights — they don't have meaningful arrival delay data
print("\nFiltering out cancelled and diverted flights...")
total_before = df.count()
print(f"  Before filter: {total_before:>10,}")

df = df.filter(
    (F.col("Cancelled") == 0) &
    (F.col("Diverted")  == 0)
)
total_after = df.count()
print(f"  After filter:  {total_after:>10,}  (removed {total_before - total_after:,})")

# Drop rows where critical fields are null
CRITICAL_COLS = [
    "FlightDate", "Reporting_Airline",
    "Origin", "Dest",
    "CRSDepTime", "DepDelay", "ArrDelay",
]
df = df.dropna(subset=CRITICAL_COLS)
print(f"  After dropping null criticals: {df.count():>10,}")

# Add some derived time features for downstream
df = (
    df
    .withColumn("Year",      F.year("FlightDate"))
    .withColumn("Month",     F.month("FlightDate"))
    .withColumn("DayOfWeek", F.dayofweek("FlightDate"))  # 1 = Sunday
    .withColumn("DepHour",   (F.col("CRSDepTime") / 100).cast(IntegerType()))
)

# Quick data quality look
final_count = df.count()
print(f"\nCleaned dataset summary")
print(f"  Rows:    {final_count:>10,}")
print(f"  Columns: {len(df.columns):>10}")

# The delay-cause columns are null on on-time flights, that's expected
print("\n  Null rate per delay column (null on on-time flights is normal):")
for col_name in ["DepDelay", "ArrDelay",
                 "CarrierDelay", "WeatherDelay", "NASDelay",
                 "SecurityDelay", "LateAircraftDelay"]:
    null_count = df.filter(F.col(col_name).isNull()).count()
    print(f"  {col_name:<22} : {null_count:>8,}  ({null_count / final_count * 100:.1f}%)")

print("\n  Date range:")
df.select(
    F.min("FlightDate").alias("min_date"),
    F.max("FlightDate").alias("max_date"),
).show(truncate=False)

print("  Top 10 carriers:")
df.groupBy("Reporting_Airline").count() \
  .orderBy(F.desc("count")).show(10, truncate=False)

# Write out as Parquet, partitioned by Year/Month
print(f"\nWriting Parquet to {OUTPUT_PATH}")
print("  (partitioned by Year/Month, ~72 partitions)")
(
    df.write
    .partitionBy("Year", "Month")
    .mode("overwrite")
    .parquet(OUTPUT_PATH)
)
print("Done writing.")

# Sanity check: read it back
print("\nVerifying output...")
verify_df = spark.read.parquet(OUTPUT_PATH)
print(f"  Rows read back: {verify_df.count():>10,}")
print(f"  Columns:        {len(verify_df.columns):>10}")
print("\n  Schema:")
verify_df.printSchema()

spark.stop()
print("\nAll done.")
