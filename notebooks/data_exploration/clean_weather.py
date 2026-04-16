import os
import glob

os.environ['HADOOP_HOME'] = r'C:\hadoop'
os.environ['PATH'] += r';C:\hadoop\bin'

from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import FloatType

# ─────────────────────────────────────────
# 0. 启动 Spark Session
# ─────────────────────────────────────────
spark = (
    SparkSession.builder
    .appName("ETL-Weather")
    .config("spark.sql.shuffle.partitions", "8")
    .config("spark.driver.memory", "8g")
    .config("spark.sql.legacy.timeParserPolicy", "LEGACY")
    .getOrCreate()
)
spark.sparkContext.setLogLevel("WARN")
print("✅ Spark 启动成功")

# ─────────────────────────────────────────
# 1. 路径配置
# ─────────────────────────────────────────
WEATHER_DIR   = r"D:\bigdata\task1\data\raw\weather"
AIRPORTS_PATH = r"D:\bigdata\task1\data\raw\airports.csv"
OUTPUT_PATH   = r"D:\bigdata\task1\data\processed\weather_clean"

# ─────────────────────────────────────────
# 2. 用 glob 列出所有天气文件
# ─────────────────────────────────────────
print("📂 正在扫描天气 CSV 文件...")
weather_files = glob.glob(os.path.join(WEATHER_DIR, "*.csv"))
print(f"   找到文件数 : {len(weather_files)}")
if len(weather_files) == 0:
    raise FileNotFoundError(f"没有找到任何天气 CSV 文件，请检查路径：{WEATHER_DIR}")
for f in sorted(weather_files):
    print(f"   {os.path.basename(f)}")

# ─────────────────────────────────────────
# 3. 读取所有天气 CSV
# ─────────────────────────────────────────
print("\n⏳ 正在读取天气数据...")
weather_df = spark.read.csv(
    weather_files,
    header=True,
    inferSchema=False,
    nullValue="",
    comment="#",        # 跳过 IEM 文件开头的 # 注释行
)
print(f"   原始记录数 : {weather_df.count():>10,}")
print(f"   原始字段数 : {len(weather_df.columns)}")
print(f"   字段列表   : {weather_df.columns}")

# ─────────────────────────────────────────
# 4. 重命名字段
#    IEM 站点代码直接就是 IATA 代码（PHX, SAN, LAX...）
#    不需要 ICAO 转换，直接命名为 iata_code
# ─────────────────────────────────────────
weather_df = (
    weather_df
    .withColumnRenamed("station", "iata_code")
    .withColumnRenamed("valid",   "obs_time")
)

# ─────────────────────────────────────────
# 5. 解析时间
#    IEM 实际格式：'2019/1/1 0:51'（月日不补零，小时不补零）
# ─────────────────────────────────────────
print("\n🕐 解析时间字段...")
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
print(f"   时间解析失败 : {time_null:,} 条 ({time_null/total*100:.2f}%)")

# ─────────────────────────────────────────
# 6. 处理数值字段
#    'M'      → null  （IEM 缺失值标记）
#    'T'      → 0.0   （微量降水 Trace）
#    '#NAME?' → null  （Excel 打开时误转的公式错误）
# ─────────────────────────────────────────
print("\n🔢 处理数值字段...")
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
        print(f"   ✓ {col}")
    else:
        print(f"   ⚠️  字段 {col} 不存在，跳过")

# wxcodes 保留为 String，清理无效值
if "wxcodes" in weather_df.columns:
    weather_df = weather_df.withColumn(
        "wxcodes",
        F.when(F.col("wxcodes") == "M",      None)
         .when(F.col("wxcodes") == "#NAME?", None)
         .when(F.col("wxcodes") == "#NAME!", None)
         .when(F.col("wxcodes") == "",       None)
         .otherwise(F.col("wxcodes"))
    )
    print(f"   ✓ wxcodes（保留为 String）")

# ─────────────────────────────────────────
# 7. 过滤无效记录
# ─────────────────────────────────────────
print("\n✂️  过滤无效记录...")
before = weather_df.count()
weather_df = weather_df.filter(
    F.col("obs_time").isNotNull() &
    F.col("iata_code").isNotNull() &
    F.col("obs_date").between("2019-01-01", "2024-12-31")
)
after = weather_df.count()
print(f"   过滤前 : {before:>10,}")
print(f"   过滤后 : {after:>10,}  (移除 {before - after:,} 条)")

# ─────────────────────────────────────────
# 8. 加载机场映射表，补充经纬度等信息
#    IEM iata_code 直接 join airports 的 iata_code
# ─────────────────────────────────────────
print(f"\n🗺️  加载机场映射表：{AIRPORTS_PATH}")
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
    print(f"   机场映射表记录数 : {airports_df.count():,}")

    weather_df = weather_df.join(airports_df, on="iata_code", how="left")

    matched = weather_df.filter(F.col("airport_name").isNotNull()).count()
    total_w = weather_df.count()
    print(f"   机场代码匹配率  : {matched/total_w*100:.1f}%  ({matched:,}/{total_w:,})")

except Exception as e:
    print(f"⚠️  机场映射表加载失败，跳过：{e}")
    weather_df = (
        weather_df
        .withColumn("airport_name",  F.lit(None).cast("string"))
        .withColumn("latitude_deg",  F.lit(None).cast(FloatType()))
        .withColumn("longitude_deg", F.lit(None).cast(FloatType()))
    )

# ─────────────────────────────────────────
# 9. 数据质量简报
# ─────────────────────────────────────────
final_count = weather_df.count()
print(f"\n📊 清洗后数据概览")
print(f"   最终记录数 : {final_count:>10,}")
print(f"   最终字段数 : {len(weather_df.columns)}")

print("\n   各字段空值率：")
for col_name in ["tmpf", "dwpf", "relh", "drct", "sknt", "p01i", "vsby", "wxcodes"]:
    if col_name in weather_df.columns:
        null_count = weather_df.filter(F.col(col_name).isNull()).count()
        print(f"   {col_name:<10} : {null_count:>8,}  ({null_count/final_count*100:.1f}%)")

print("\n   时间范围：")
weather_df.select(
    F.min("obs_date").alias("最早日期"),
    F.max("obs_date").alias("最晚日期"),
).show(truncate=False)

print("   各站点记录数：")
weather_df.groupBy("iata_code").count() \
  .orderBy(F.desc("count")).show(30, truncate=False)

# ─────────────────────────────────────────
# 10. 添加年月分区字段，写出 Parquet
# ─────────────────────────────────────────
weather_df = (
    weather_df
    .withColumn("Year",  F.year("obs_date"))
    .withColumn("Month", F.month("obs_date"))
)

print(f"\n💾 正在写出 Parquet 到：{OUTPUT_PATH}")
(
    weather_df.write
    .partitionBy("Year", "Month")
    .mode("overwrite")
    .parquet(OUTPUT_PATH)
)
print("✅ 天气数据清洗完成！")

# ─────────────────────────────────────────
# 11. 验证写出结果
# ─────────────────────────────────────────
print("\n🔍 验证输出文件...")
verify_df = spark.read.parquet(OUTPUT_PATH)
print(f"   读回记录数 : {verify_df.count():>10,}")
print(f"   读回字段数 : {len(verify_df.columns)}")
print("\n   Schema：")
verify_df.printSchema()

spark.stop()
print("\n🎉 全部完成，Spark 已关闭。")