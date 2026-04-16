import os
import requests

# 你的 IEM 下载 URL（直接替换这里）
url = "https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?network=PA_ASOS&station=PHL&data=tmpf&data=dwpf&data=relh&data=drct&data=sknt&data=p01i&data=vsby&data=wxcodes&year1=2019&month1=1&day1=1&year2=2024&month2=12&day2=31&tz=Etc%2FUTC&format=onlycomma&latlon=no&elev=no&missing=M&trace=T&direct=no&report_type=3&report_type=4"
# 目标路径
output_dir = "data/raw/weather"
output_file = os.path.join(output_dir, "weather_PA.csv")

# 创建目录（如果不存在）
os.makedirs(output_dir, exist_ok=True)

# 下载数据
print("Downloading weather data...")
response = requests.get(url)

# 检查是否成功
if response.status_code == 200:
    with open(output_file, "wb") as f:
        f.write(response.content)
    print(f"Saved to {output_file}")
else:
    print(f"Failed! Status code: {response.status_code}")