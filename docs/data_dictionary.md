# Data Dictionary

**Project**: U.S. Flight Delay Analysis
**Owner**: Kaiyang Ding
**Updated**: 2026-04-16
**Date range**: 2019-01-01 to 2024-12-31

---

## Contents

1. [Flight data — flights_clean](#1-flight-data--flights_clean)
2. [Weather data — weather_clean](#2-weather-data--weather_clean)
3. [Partitioning](#3-partitioning)
4. [Missing-value conventions](#4-missing-value-conventions)
5. [Data sources](#5-data-sources)

---

## 1. Flight data — flights_clean

**Path**: `data/processed/flights_clean/`
**Format**: Parquet (Snappy), partitioned by `Year`/`Month`
**Source**: Bureau of Transportation Statistics (BTS)
**Coverage**: All U.S. domestic commercial flights, Jan 2019 – Dec 2024
**Row count after cleaning**: ~34 million (cancelled and diverted flights removed)

### Fields

| Field | Type | Description | Example | Notes |
|-------|------|-------------|---------|-------|
| `FlightDate` | Date | Flight date | `2019-01-04` | `yyyy-MM-dd` |
| `Reporting_Airline` | String | Carrier IATA code | `AA`, `DL`, `UA`, `WN` | 2-letter code |
| `Tail_Number` | String | Aircraft tail number | `N945SW` | Used for ripple-effect tracking |
| `Flight_Number_Reporting_Airline` | Int | Flight number | `5657` | Can repeat on different dates |
| `Origin` | String | Origin airport IATA | `SFO`, `LAX`, `JFK` | 3-letter code |
| `OriginCityName` | String | Origin city | `San Francisco, CA` | With state abbreviation |
| `Dest` | String | Destination airport IATA | `ORD`, `ATL`, `DFW` | 3-letter code |
| `DestCityName` | String | Destination city | `Chicago, IL` | With state abbreviation |
| `CRSDepTime` | Int | Scheduled departure time | `1430` | HHMM format (1430 = 14:30) |
| `DepTime` | Int | Actual departure time | `1437` | HHMM; null for cancelled flights |
| `DepDelay` | Float | Departure delay (min) | `7.0`, `-3.0` | Negative = early, positive = late |
| `CRSArrTime` | Int | Scheduled arrival time | `1720` | HHMM |
| `ArrTime` | Int | Actual arrival time | `1731` | HHMM |
| `ArrDelay` | Float | Arrival delay (min) | `11.0`, `-5.0` | Main prediction target |
| `Cancelled` | Int | Cancelled flag | `0` | Always 0 after cleaning |
| `CancellationCode` | String | Cancellation reason | `null` | Always null after cleaning; original codes: A=carrier, B=weather, C=NAS, D=security |
| `Diverted` | Int | Diverted flag | `0` | Always 0 after cleaning |
| `Distance` | Float | Flight distance | `347.0` | Miles |
| `CarrierDelay` | Float | Delay caused by carrier (min) | `45.0`, `null` | Null when no delay (normal) |
| `WeatherDelay` | Float | Delay caused by weather (min) | `0.0`, `null` | Null when no delay |
| `NASDelay` | Float | Delay caused by NAS / ATC (min) | `12.0`, `null` | NAS = National Airspace System |
| `SecurityDelay` | Float | Delay caused by security (min) | `0.0`, `null` | Very rare |
| `LateAircraftDelay` | Float | Delay carried in from previous leg (min) | `38.0`, `null` | Direct evidence of the ripple effect |
| `Year` | Int | Year (derived) | `2019` – `2024` | Derived from `FlightDate`, also a partition key |
| `Month` | Int | Month (derived) | `1` – `12` | Derived from `FlightDate`, also a partition key |
| `DayOfWeek` | Int | Day of week (derived) | `1` = Sunday, `7` = Saturday | Spark `dayofweek()` convention |
| `DepHour` | Int | Scheduled departure hour (derived) | `0` – `23` | `CRSDepTime` / 100 |

### Note on delay-cause fields

`CarrierDelay`, `WeatherDelay`, `NASDelay`, `SecurityDelay`, and `LateAircraftDelay` only carry values when the flight had an arrival delay (`ArrDelay > 0`) AND BTS recorded a full attribution; otherwise they are null. This is how BTS publishes the data — it isn't a data quality issue.

---

## 2. Weather data — weather_clean

**Path**: `data/processed/weather_clean/`
**Format**: Parquet (Snappy), partitioned by `Year`/`Month`
**Source**: Iowa Environmental Mesonet (IEM) ASOS network
**Coverage**: 24 major U.S. hub airports, Jan 2019 – Dec 2024
**Row count after cleaning**: ~1.47 million

### Covered airports

| State | IATA codes |
|-------|-----------|
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

### Fields

| Field | Type | Description | Example | Notes |
|-------|------|-------------|---------|-------|
| `iata_code` | String | Airport IATA (IEM station code) | `PHX`, `LAX` | Joins directly with flight `Origin`/`Dest` |
| `obs_time` | Timestamp | Observation time (UTC) | `2019-01-01 05:00:00` | UTC, not local |
| `obs_date` | Date | Observation date (UTC) | `2019-01-01` | Derived from `obs_time` |
| `obs_hour` | Int | Observation hour (UTC) | `0` – `23` | Derived; used as the join key with flights |
| `tmpf` | Float | Temperature | `43.0` | Fahrenheit |
| `dwpf` | Float | Dew point | `42.0` | Fahrenheit; proxy for humidity |
| `relh` | Float | Relative humidity | `96.6` | Percent, 0–100 |
| `drct` | Float | Wind direction | `270.0` | Degrees (0/360 = N, 90 = E); null = calm |
| `sknt` | Float | Wind speed | `9.0` | Knots (1 knot ≈ 1.85 km/h) |
| `p01i` | Float | Precipitation in the past hour | `0.03` | Inches; IEM 'T' (trace) was converted to 0.0 |
| `vsby` | Float | Visibility | `10.0` | Miles; 10.0 is the instrument max ("at least 10 mi") |
| `wxcodes` | String | METAR weather codes | `-RA`, `SN`, `FG` | Null on clear weather (~82% of rows) |
| `airport_name` | String | Full airport name | `Phoenix Sky Harbor International Airport` | From OurAirports |
| `latitude_deg` | Float | Latitude | `33.4373` | Decimal degrees, north positive |
| `longitude_deg` | Float | Longitude | `-112.007` | Decimal degrees, west negative |
| `Year` | Int | Year (derived) | `2019` – `2024` | Partition key |
| `Month` | Int | Month (derived) | `1` – `12` | Partition key |

### Common `wxcodes`

| Code | Meaning |
|------|---------|
| `RA` | Rain |
| `-RA` | Light rain |
| `+RA` | Heavy rain |
| `SN` | Snow |
| `FG` | Fog |
| `TS` | Thunderstorm |
| `DZ` | Drizzle |
| `BR` | Mist |
| `null` | No notable weather (clear) |

---

## 3. Partitioning

Both tables are partitioned by `Year`/`Month`. Filters on those columns benefit from partition pruning:

```python
# Read just 2022
df = spark.read.parquet("data/processed/flights_clean") \
    .filter(F.col("Year") == 2022)

# Read summer 2023 weather
df = spark.read.parquet("data/processed/weather_clean") \
    .filter((F.col("Year") == 2023) & F.col("Month").isin([6, 7, 8]))
```

---

## 4. Missing-value conventions

| Source | Sentinel in raw | Handling | Stored Parquet value |
|--------|-----------------|----------|----------------------|
| BTS empty field | empty string | Converted to null | `null` |
| IEM missing | `M` | Converted to null | `null` |
| IEM trace precip | `T` | Converted to 0.0 | `0.0` |
| Delay attribution (no delay) | empty string | Converted to null | `null` (expected, not missing data) |

---

## 5. Data sources

| Dataset | Source | Notes |
|---------|--------|-------|
| Flights | https://www.transtats.bts.gov | BTS Airline On-Time Performance, 72 monthly files |
| Weather | https://mesonet.agron.iastate.edu | IEM ASOS network, 16 state-level files |
| Airports | https://ourairports.com/data/ | OurAirports airports.csv (IATA/ICAO mapping, lat/lon) |
