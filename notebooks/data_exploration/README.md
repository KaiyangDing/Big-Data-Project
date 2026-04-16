**Task 1: 下载航班数据**

先用zip下载，无法直接用post爬虫，网站deny，下载72个csv，包含全部字段



**Task 3: 航班数据清洗**

先要过滤出23个字段，转换date为年月日，滤出取消和备降航班， 删除关键字段缺失的记录，

```bash
PS D:\bigdata\task1> python clean_flights.py
WARNING: Using incubator modules: jdk.incubator.vector
Using Spark's default log4j profile: org/apache/spark/log4j2-defaults.properties
Setting default log level to "WARN".
To adjust logging level use sc.setLogLevel(newLevel). For SparkR, use setLogLevel(newLevel).
Spark 启动成功
正在扫描 CSV 文件...
   找到文件数 : 72
   示例文件  : flights_2019_01.csv
   示例文件  : flights_2019_02.csv
   示例文件  : flights_2019_03.csv
   ...

正在读取所有 CSV（72个文件，请耐心等待）...
   原始字段数 : 110                                                             
   保留字段数 : 23

过滤取消/备降航班...
   过滤前记录数 : 38,761,873                                                    
   过滤后记录数 : 37,786,692  (移除 975,181 条)                                 
   去除关键字段缺失后 : 37,786,688                                              
                                                                                
清洗后数据概览
   最终记录数 : 37,786,688
   最终字段数 :         27

   延误字段空值率（延误原因字段对非延误航班为空属正常）：
   DepDelay               :        0  (0.0%)                                    
   ArrDelay               :        0  (0.0%)                                    
   CarrierDelay           : 30,741,724  (81.4%)                                 
   WeatherDelay           : 30,741,724  (81.4%)                                 
   NASDelay               : 30,741,724  (81.4%)                                 
   SecurityDelay          : 30,741,724  (81.4%)                                 
   LateAircraftDelay      : 30,741,724  (81.4%)                                 

   时间范围：
+----------+----------+                                                         
|最早日期  |最晚日期  |
+----------+----------+
|2019-01-01|2024-12-31|
+----------+----------+

   航司分布（Top 10）：
+-----------------+-------+                                                     
|Reporting_Airline|count  |
+-----------------+-------+
|WN               |7336436|
|DL               |5130540|
|AA               |4916793|
|OO               |4241429|
|UA               |3422363|
|YX               |1738635|
|MQ               |1505665|
|B6               |1392635|
|9E               |1337081|
|OH               |1301564|
+-----------------+-------+
only showing top 10 rows

正在写出 Parquet 到：D:\bigdata\task1\data\processed\flights_clean
   （按 Year/Month 分区，共约 72 个分区，请耐心等待...）
26/04/16 01:31:28 WARN SparkStringUtils: Truncated the string representation of a plan since it was too large. This behavior can be adjusted by setting 'spark.sql.debug.maxToStringFields'.
写出完成！                                                                   

验证输出文件...
   读回记录数 : 37,786,688                                                      
   读回字段数 :         27

   Schema：
root
 |-- FlightDate: date (nullable = true)
 |-- Reporting_Airline: string (nullable = true)
 |-- Tail_Number: string (nullable = true)
 |-- Flight_Number_Reporting_Airline: integer (nullable = true)
 |-- Origin: string (nullable = true)
 |-- OriginCityName: string (nullable = true)
 |-- Dest: string (nullable = true)
 |-- DestCityName: string (nullable = true)
 |-- CRSDepTime: integer (nullable = true)
 |-- DepTime: integer (nullable = true)
 |-- DepDelay: float (nullable = true)
 |-- CRSArrTime: integer (nullable = true)
 |-- ArrTime: integer (nullable = true)
 |-- ArrDelay: float (nullable = true)
 |-- Cancelled: integer (nullable = true)
 |-- CancellationCode: string (nullable = true)
 |-- Diverted: integer (nullable = true)
 |-- Distance: float (nullable = true)
 |-- CarrierDelay: float (nullable = true)
 |-- WeatherDelay: float (nullable = true)
 |-- NASDelay: float (nullable = true)
 |-- SecurityDelay: float (nullable = true)
 |-- LateAircraftDelay: float (nullable = true)
 |-- DayOfWeek: integer (nullable = true)
 |-- DepHour: integer (nullable = true)
 |-- Year: integer (nullable = true)
 |-- Month: integer (nullable = true)


全部完成，Spark 已关闭。
```



**Task 2: 下载天气数据**

只下载关键机场，所有的数据包括了非机场的气象站点？

```
PS D:\bigdata\task1> python download_weather.py
Downloading weather data...
Saved to data/raw/weather\weather_CA.csv
PS D:\bigdata\task1> python download_weather.py
Downloading weather data...
Saved to data/raw/weather\weather_TX.csv
PS D:\bigdata\task1> python download_weather.py
Downloading weather data...
Saved to data/raw/weather\weather_NY.csv
PS D:\bigdata\task1> python download_weather.py
Downloading weather data...
Saved to data/raw/weather\weather_NJ.csv
PS D:\bigdata\task1> python download_weather.py
Downloading weather data...
Saved to data/raw/weather\weather_IL.csv
PS D:\bigdata\task1> python download_weather.py
Downloading weather data...
Saved to data/raw/weather\weather_GA.csv
PS D:\bigdata\task1> python download_weather.py
Downloading weather data...
Saved to data/raw/weather\weather_FL.csv
PS D:\bigdata\task1> python download_weather.py
Downloading weather data...
Saved to data/raw/weather\weather_CO.csv
PS D:\bigdata\task1> python download_weather.py
Downloading weather data...
Saved to data/raw/weather\weather_WA.csv
PS D:\bigdata\task1> python download_weather.py
Downloading weather data...
Saved to data/raw/weather\weather_AZ.csv
PS D:\bigdata\task1> python download_weather.py
Downloading weather data...
Saved to data/raw/weather\weather_NV.csv
PS D:\bigdata\task1> python download_weather.py
Downloading weather data...
Saved to data/raw/weather\weather_MA.csv
PS D:\bigdata\task1> python download_weather.py
Downloading weather data...
Saved to data/raw/weather\weather_MN.csv
PS D:\bigdata\task1> python download_weather.py
Downloading weather data...
Saved to data/raw/weather\weather_MI.csv
PS D:\bigdata\task1> python download_weather.py
Downloading weather data...
Saved to data/raw/weather\weather_NC.csv
PS D:\bigdata\task1> python download_weather.py
Downloading weather data...
Saved to data/raw/weather\weather_PA.csv
```



**Task 4: 天气数据清洗**

```
PS D:\bigdata\task1> python clean_weather.py
WARNING: Using incubator modules: jdk.incubator.vector
Using Spark's default log4j profile: org/apache/spark/log4j2-defaults.properties
Setting default log level to "WARN".
To adjust logging level use sc.setLogLevel(newLevel). For SparkR, use setLogLevel(newLevel).
Spark 启动成功
正在扫描天气 CSV 文件...
   找到文件数 : 16
   weather_AZ.csv
   weather_CA.csv
   weather_CO.csv
   weather_FL.csv
   weather_GA.csv
   weather_IL.csv
   weather_MA.csv
   weather_MI.csv
   weather_MN.csv
   weather_NC.csv
   weather_NJ.csv
   weather_NV.csv
   weather_NY.csv
   weather_PA.csv
   weather_TX.csv
   weather_WA.csv

正在读取天气数据...
   原始记录数 :  1,474,205                                                      
   原始字段数 : 10
   字段列表   : ['station', 'valid', 'tmpf', 'dwpf', 'relh', 'drct', 'sknt', 'p01i', 'vsby', 'wxcodes']

解析时间字段...
   时间解析失败 : 167 条 (0.01%)                                                

处理数值字段...
   ✓ tmpf
   ✓ dwpf
   ✓ relh
   ✓ drct
   ✓ sknt
   ✓ p01i
   ✓ vsby
   ✓ wxcodes（保留为 String）

过滤无效记录...
   过滤前 :  1,474,205                                                          
   过滤后 :  1,474,038  (移除 167 条)

加载机场映射表：D:\bigdata\task1\data\raw\airports.csv
   机场映射表记录数 : 9,062
   机场代码匹配率  : 100.0%  (1,474,038/1,474,038)                              
                                                                                
清洗后数据概览
   最终记录数 :  1,474,038
   最终字段数 : 15

   各字段空值率：
   tmpf       :      210  (0.0%)                                                
   dwpf       :      290  (0.0%)                                                
   relh       :      296  (0.0%)                                                
   drct       :   42,938  (2.9%)                                                
   sknt       :    1,872  (0.1%)                                                
   p01i       :    1,815  (0.1%)                                                
   vsby       :      278  (0.0%)                                                
   wxcodes    : 1,219,459  (82.7%)                                              

   时间范围：
+----------+----------+                                                         
|最早日期  |最晚日期  |
+----------+----------+
|2019-01-01|2024-12-30|
+----------+----------+

   各站点记录数：
+---------+-----+                                                               
|iata_code|count|
+---------+-----+
|PHL      |66555|
|DTW      |65104|
|SEA      |65062|
|SAN      |64903|
|MSP      |64886|
|ORD      |64300|
|BOS      |62958|
|DFW      |61767|
|ATL      |61594|
|MDW      |61486|
|CLT      |61378|
|DEN      |61336|
|LGA      |61259|
|LAX      |61153|
|MIA      |60935|
|AUS      |60800|
|IAH      |60644|
|MCO      |60518|
|JFK      |60471|
|FLL      |60360|
|EWR      |59796|
|SFO      |57887|
|LAS      |54569|
|PHX      |54317|
+---------+-----+


正在写出 Parquet 到：D:\bigdata\task1\data\processed\weather_clean
天气数据清洗完成！                                                           

验证输出文件...
   读回记录数 :  1,474,038                                                      
   读回字段数 : 17

   Schema：
root
 |-- iata_code: string (nullable = true)
 |-- obs_time: timestamp (nullable = true)
 |-- tmpf: float (nullable = true)
 |-- dwpf: float (nullable = true)
 |-- relh: float (nullable = true)
 |-- drct: float (nullable = true)
 |-- sknt: float (nullable = true)
 |-- p01i: float (nullable = true)
 |-- vsby: float (nullable = true)
 |-- wxcodes: string (nullable = true)
 |-- obs_date: date (nullable = true)
 |-- obs_hour: integer (nullable = true)
 |-- airport_name: string (nullable = true)
 |-- latitude_deg: float (nullable = true)
 |-- longitude_deg: float (nullable = true)
 |-- Year: integer (nullable = true)
 |-- Month: integer (nullable = true)


全部完成，Spark 已关闭。
PS D:\bigdata\task1> 成功: 已终止 PID 7952 (属于 PID 32192 子进程)的进程。
成功: 已终止 PID 32192 (属于 PID 3084 子进程)的进程。
成功: 已终止 PID 3084 (属于 PID 12688 子进程)的进程。
```





## **docker compose**

docker-compose up -d

docker-compose down

test.py包含了使用示例
