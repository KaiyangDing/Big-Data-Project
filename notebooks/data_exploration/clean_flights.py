import os
import glob

os.environ['HADOOP_HOME'] = r'C:\hadoop'
os.environ['PATH'] += r';C:\hadoop\bin'

from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import IntegerType, FloatType

# ─────────────────────────────────────────
# 0. 启动 Spark Session
# ─────────────────────────────────────────
spark = (
    SparkSession.builder
    .appName("ETL-Flights")
    .config("spark.sql.shuffle.partitions", "8")
    .config("spark.driver.memory", "8g")
    .config("spark.sql.legacy.timeParserPolicy", "LEGACY")
    .getOrCreate()
)
spark.sparkContext.setLogLevel("WARN")
print("Spark 启动成功")

# ─────────────────────────────────────────
# 1. 路径配置
# ─────────────────────────────────────────
INPUT_DIR   = r"D:\bigdata\task1\data\raw\flights"
OUTPUT_PATH = r"D:\bigdata\task1\data\processed\flights_clean"

# ─────────────────────────────────────────
# 2. 目标字段（共 23 个）
# ─────────────────────────────────────────
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

# ─────────────────────────────────────────
# 3. 用 Python glob 列出所有文件
# ─────────────────────────────────────────
print("正在扫描 CSV 文件...")
flight_files = glob.glob(os.path.join(INPUT_DIR, "*.csv"))
print(f"   找到文件数 : {len(flight_files)}")

if len(flight_files) == 0:
    raise FileNotFoundError(f"没有找到任何 CSV 文件，请检查路径：{INPUT_DIR}")

# 打印前3个文件名确认
for f in sorted(flight_files)[:3]:
    print(f"   示例文件  : {os.path.basename(f)}")
print(f"   ...")

# ─────────────────────────────────────────
# 4. 读取所有 CSV
# ─────────────────────────────────────────
print("\n正在读取所有 CSV（72个文件，请耐心等待）...")
raw_df = spark.read.csv(
    flight_files,
    header=True,
    inferSchema=False,   # 全部读为 String，手动控制类型
    nullValue="",
)
print(f"   原始字段数 : {len(raw_df.columns)}")

# ─────────────────────────────────────────
# 5. 只保留目标字段
# ─────────────────────────────────────────
existing_cols = set(raw_df.columns)
missing_cols  = [c for c in KEEP_COLS if c not in existing_cols]
if missing_cols:
    print(f"以下字段在 CSV 中不存在，将跳过：{missing_cols}")

select_cols = [c for c in KEEP_COLS if c in existing_cols]
df = raw_df.select(select_cols)
print(f"   保留字段数 : {len(select_cols)}")

# ─────────────────────────────────────────
# 6. 类型转换
#    BTS 所有数字字段均为带小数点字符串（如 '0.00'）
#    Int 字段必须先转 Float 再转 Int
# ─────────────────────────────────────────
df = (
    df
    # Date
    .withColumn("FlightDate", F.to_date("FlightDate", "yyyy-MM-dd"))

    # Int（先 Float → 再 Int，避免 '0.00' 报错）
    .withColumn("Flight_Number_Reporting_Airline",
                F.col("Flight_Number_Reporting_Airline").cast(FloatType()).cast(IntegerType()))
    .withColumn("CRSDepTime",  F.col("CRSDepTime").cast(FloatType()).cast(IntegerType()))
    .withColumn("DepTime",     F.col("DepTime").cast(FloatType()).cast(IntegerType()))
    .withColumn("CRSArrTime",  F.col("CRSArrTime").cast(FloatType()).cast(IntegerType()))
    .withColumn("ArrTime",     F.col("ArrTime").cast(FloatType()).cast(IntegerType()))
    .withColumn("Cancelled",   F.col("Cancelled").cast(FloatType()).cast(IntegerType()))
    .withColumn("Diverted",    F.col("Diverted").cast(FloatType()).cast(IntegerType()))

    # Float
    .withColumn("DepDelay",          F.col("DepDelay").cast(FloatType()))
    .withColumn("ArrDelay",          F.col("ArrDelay").cast(FloatType()))
    .withColumn("Distance",          F.col("Distance").cast(FloatType()))
    .withColumn("CarrierDelay",      F.col("CarrierDelay").cast(FloatType()))
    .withColumn("WeatherDelay",      F.col("WeatherDelay").cast(FloatType()))
    .withColumn("NASDelay",          F.col("NASDelay").cast(FloatType()))
    .withColumn("SecurityDelay",     F.col("SecurityDelay").cast(FloatType()))
    .withColumn("LateAircraftDelay", F.col("LateAircraftDelay").cast(FloatType()))
)

# ─────────────────────────────────────────
# 7. 过滤取消 & 备降航班
# ─────────────────────────────────────────
print("\n过滤取消/备降航班...")
total_before = df.count()
print(f"   过滤前记录数 : {total_before:>10,}")

df = df.filter(
    (F.col("Cancelled") == 0) &
    (F.col("Diverted")  == 0)
)
total_after = df.count()
print(f"   过滤后记录数 : {total_after:>10,}  (移除 {total_before - total_after:,} 条)")

# ─────────────────────────────────────────
# 8. 删除关键字段缺失的记录
# ─────────────────────────────────────────
CRITICAL_COLS = [
    "FlightDate", "Reporting_Airline",
    "Origin", "Dest",
    "CRSDepTime", "DepDelay", "ArrDelay",
]
df = df.dropna(subset=CRITICAL_COLS)
print(f"   去除关键字段缺失后 : {df.count():>10,}")

# ─────────────────────────────────────────
# 9. 添加衍生时间特征
# ─────────────────────────────────────────
df = (
    df
    .withColumn("Year",      F.year("FlightDate"))
    .withColumn("Month",     F.month("FlightDate"))
    .withColumn("DayOfWeek", F.dayofweek("FlightDate"))  # 1=周日 ... 7=周六
    .withColumn("DepHour",   (F.col("CRSDepTime") / 100).cast(IntegerType()))
)

# ─────────────────────────────────────────
# 10. 数据质量简报
# ─────────────────────────────────────────
final_count = df.count()
print(f"\n清洗后数据概览")
print(f"   最终记录数 : {final_count:>10,}")
print(f"   最终字段数 : {len(df.columns):>10}")

print("\n   延误字段空值率（延误原因字段对非延误航班为空属正常）：")
for col_name in ["DepDelay", "ArrDelay",
                 "CarrierDelay", "WeatherDelay", "NASDelay",
                 "SecurityDelay", "LateAircraftDelay"]:
    null_count = df.filter(F.col(col_name).isNull()).count()
    print(f"   {col_name:<22} : {null_count:>8,}  ({null_count / final_count * 100:.1f}%)")

print("\n   时间范围：")
df.select(
    F.min("FlightDate").alias("最早日期"),
    F.max("FlightDate").alias("最晚日期"),
).show(truncate=False)

print("   航司分布（Top 10）：")
df.groupBy("Reporting_Airline").count() \
  .orderBy(F.desc("count")).show(10, truncate=False)

# ─────────────────────────────────────────
# 11. 写出 Parquet（按 Year / Month 分区）
# ─────────────────────────────────────────
print(f"\n正在写出 Parquet 到：{OUTPUT_PATH}")
print("   （按 Year/Month 分区，共约 72 个分区，请耐心等待...）")
(
    df.write
    .partitionBy("Year", "Month")
    .mode("overwrite")
    .parquet(OUTPUT_PATH)
)
print("写出完成！")

# ─────────────────────────────────────────
# 12. 验证写出结果
# ─────────────────────────────────────────
print("\n验证输出文件...")
verify_df = spark.read.parquet(OUTPUT_PATH)
print(f"   读回记录数 : {verify_df.count():>10,}")
print(f"   读回字段数 : {len(verify_df.columns):>10}")
print("\n   Schema：")
verify_df.printSchema()

spark.stop()
print("\n全部完成，Spark 已关闭。")