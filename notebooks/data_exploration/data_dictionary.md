# 数据字典

**项目**: 美国航班延误分析  
**负责人**: Kaiyang Ding  
**更新日期**: 2026-04-16  
**数据时间范围**: 2019-01-01 ~ 2024-12-31

---

## 目录

1. [航班数据 flights_clean](#1-航班数据-flights_clean)
2. [天气数据 weather_clean](#2-天气数据-weather_clean)
3. [分区说明](#3-分区说明)
4. [缺失值约定](#4-缺失值约定)
5. [数据来源](#5-数据来源)

---

## 1. 航班数据 flights_clean

**文件路径**: `data/processed/flights_clean/`  
**文件格式**: Parquet，Snappy 压缩，按 `Year`/`Month` 分区  
**原始来源**: Bureau of Transportation Statistics (BTS)  
**覆盖范围**: 美国国内所有商业航班，2019年1月 ~ 2024年12月  
**清洗后记录数**: 约 3,400 万条（过滤取消和备降后）

### 字段说明

| 字段名 | 类型 | 描述 | 取值示例 | 备注 |
|--------|------|------|----------|------|
| `FlightDate` | Date | 航班日期 | `2019-01-04` | 格式 yyyy-MM-dd |
| `Reporting_Airline` | String | 航司 IATA 代码 | `AA`, `DL`, `UA`, `WN` | 二字母代码 |
| `Tail_Number` | String | 飞机尾号 | `N945SW` | 用于涟漪效应追踪 |
| `Flight_Number_Reporting_Airline` | Int | 航班号 | `5657` | 同一航班号可重复出现 |
| `Origin` | String | 出发机场 IATA 代码 | `SFO`, `LAX`, `JFK` | 三字母代码 |
| `OriginCityName` | String | 出发城市名 | `San Francisco, CA` | 含州名缩写 |
| `Dest` | String | 到达机场 IATA 代码 | `ORD`, `ATL`, `DFW` | 三字母代码 |
| `DestCityName` | String | 到达城市名 | `Chicago, IL` | 含州名缩写 |
| `CRSDepTime` | Int | 计划起飞时间 | `1430` | HHMM 格式，如 1430 = 14:30 |
| `DepTime` | Int | 实际起飞时间 | `1437` | HHMM 格式，取消航班为 null |
| `DepDelay` | Float | 起飞延误分钟数 | `7.0`, `-3.0` | 负数表示提前，正数表示晚点 |
| `CRSArrTime` | Int | 计划到达时间 | `1720` | HHMM 格式 |
| `ArrTime` | Int | 实际到达时间 | `1731` | HHMM 格式 |
| `ArrDelay` | Float | 到达延误分钟数 | `11.0`, `-5.0` | 核心预测目标 |
| `Cancelled` | Int | 是否取消 | `0` | 清洗后全部为 0（已过滤取消） |
| `CancellationCode` | String | 取消原因代码 | `null` | 清洗后全部为 null；原始含义：A=航司，B=天气，C=NAS，D=安全 |
| `Diverted` | Int | 是否备降 | `0` | 清洗后全部为 0（已过滤备降） |
| `Distance` | Float | 飞行距离 | `347.0` | 单位：英里 |
| `CarrierDelay` | Float | 航司原因延误分钟数 | `45.0`, `null` | 无延误时为 null，正常现象 |
| `WeatherDelay` | Float | 天气原因延误分钟数 | `0.0`, `null` | 无延误时为 null |
| `NASDelay` | Float | 空管原因延误分钟数 | `12.0`, `null` | NAS = National Airspace System |
| `SecurityDelay` | Float | 安检原因延误分钟数 | `0.0`, `null` | 极少发生 |
| `LateAircraftDelay` | Float | 前序航班延误分钟数 | `38.0`, `null` | 涟漪效应的直接证据 |
| `Year` | Int | 年（衍生字段） | `2019` ~ `2024` | 由 FlightDate 提取，同时作为分区键 |
| `Month` | Int | 月（衍生字段） | `1` ~ `12` | 由 FlightDate 提取，同时作为分区键 |
| `DayOfWeek` | Int | 星期几（衍生字段） | `1`=周日，`7`=周六 | Spark dayofweek() 约定 |
| `DepHour` | Int | 计划起飞小时（衍生字段） | `0` ~ `23` | 由 CRSDepTime / 100 取整 |

### 延误原因字段说明

`CarrierDelay`、`WeatherDelay`、`NASDelay`、`SecurityDelay`、`LateAircraftDelay` 五个字段仅在航班**发生到达延误（ArrDelay > 0）且 BTS 有完整归因记录**时才有值，其余情况均为 null。这是 BTS 数据的固有特性，**不代表数据质量问题**。

---

## 2. 天气数据 weather_clean

**文件路径**: `data/processed/weather_clean/`  
**文件格式**: Parquet，Snappy 压缩，按 `Year`/`Month` 分区  
**原始来源**: Iowa Environmental Mesonet (IEM) ASOS 网络  
**覆盖范围**: 美国 24 个主要枢纽机场，2019年1月 ~ 2024年12月  
**清洗后记录数**: 约 147 万条

### 覆盖机场列表

| 州 | 机场 IATA 代码 |
|----|---------------|
| Arizona | PHX |
| California | LAX, SFO, SAN |
| Colorado | DEN |
| Florida | MIA, MCO, FLL |
| Georgia | ATL |
| Illinois | ORD, MDW |
| Massachusetts | BOS |
| Michigan | DTW |
| Minnesota | MSP |
| Nevada | LAS |
| New Jersey | EWR |
| New York | JFK, LGA |
| North Carolina | CLT |
| Pennsylvania | PHL |
| Texas | DFW, IAH, AUS |
| Washington | SEA |

### 字段说明

| 字段名 | 类型 | 描述 | 取值示例 | 备注 |
|--------|------|------|----------|------|
| `iata_code` | String | 机场 IATA 代码（IEM 站点代码） | `PHX`, `LAX` | 与航班数据 Origin/Dest 直接关联 |
| `obs_time` | Timestamp | 观测时间（UTC） | `2019-01-01 05:00:00` | 注意为 UTC，非本地时间 |
| `obs_date` | Date | 观测日期（UTC） | `2019-01-01` | 由 obs_time 提取 |
| `obs_hour` | Int | 观测小时（UTC） | `0` ~ `23` | 由 obs_time 提取，用于与航班时间关联 |
| `tmpf` | Float | 气温 | `43.0` | 单位：华氏度（°F） |
| `dwpf` | Float | 露点温度 | `42.0` | 单位：华氏度（°F），反映空气湿度 |
| `relh` | Float | 相对湿度 | `96.6` | 单位：%，范围 0~100 |
| `drct` | Float | 风向 | `270.0` | 单位：度，0/360=正北，90=正东，null 表示静风 |
| `sknt` | Float | 风速 | `9.0` | 单位：节（knots），1节≈1.85km/h |
| `p01i` | Float | 过去1小时降水量 | `0.03` | 单位：英寸；IEM 中 T（微量）已转为 0.0 |
| `vsby` | Float | 能见度 | `10.0` | 单位：英里；10.0 为仪器上限，表示"至少10英里" |
| `wxcodes` | String | 天气现象代码 | `-RA`, `SN`, `FG` | METAR 标准代码；晴好天气为 null（约占82%） |
| `airport_name` | String | 机场全名 | `Phoenix Sky Harbor International Airport` | 来自 OurAirports 映射 |
| `latitude_deg` | Float | 机场纬度 | `33.4373` | 十进制度，北纬为正 |
| `longitude_deg` | Float | 机场经度 | `-112.007` | 十进制度，西经为负 |
| `Year` | Int | 年（衍生字段） | `2019` ~ `2024` | 同时作为分区键 |
| `Month` | Int | 月（衍生字段） | `1` ~ `12` | 同时作为分区键 |

### 常见 wxcodes 含义

| 代码 | 含义 |
|------|------|
| `RA` | 降雨（Rain） |
| `-RA` | 小雨（Light Rain） |
| `+RA` | 大雨（Heavy Rain） |
| `SN` | 降雪（Snow） |
| `FG` | 雾（Fog） |
| `TS` | 雷暴（Thunderstorm） |
| `DZ` | 毛毛雨（Drizzle） |
| `BR` | 薄雾（Mist） |
| `null` | 无特殊天气现象（晴好） |

---

## 3. 分区说明

两张表均按 `Year` / `Month` 双层分区存储，读取时可利用分区裁剪加速查询：

```python
# 只读取 2022 年的数据
df = spark.read.parquet("data/processed/flights_clean") \
    .filter(F.col("Year") == 2022)

# 只读取 2023 年夏季（6-8月）
df = spark.read.parquet("data/processed/weather_clean") \
    .filter((F.col("Year") == 2023) & F.col("Month").isin([6, 7, 8]))
```

---

## 4. 缺失值约定

| 来源 | 标记 | 处理方式 | Parquet 中的值 |
|------|------|----------|---------------|
| BTS 空字段 | 空字符串 | 转为 null | `null` |
| IEM 缺失 | `M` | 转为 null | `null` |
| IEM 微量降水 | `T` | 转为 0.0 | `0.0` |
| 延误归因字段（无延误） | 空字符串 | 转为 null | `null`（正常，非数据缺失） |

---

## 5. 数据来源

| 数据集 | 来源网站 | 说明 |
|--------|----------|------|
| 航班数据 | https://www.transtats.bts.gov | BTS Airline On-Time Performance，72个月度文件 |
| 天气数据 | https://mesonet.agron.iastate.edu | IEM ASOS 网络，16个州文件 |
| 机场数据 | https://ourairports.com/data/ | OurAirports airports.csv，含 IATA/ICAO 映射及经纬度 |
