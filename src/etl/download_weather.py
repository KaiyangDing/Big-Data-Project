"""
Download ASOS/METAR weather data from Iowa Environmental Mesonet (IEM).
Covers 24 major U.S. hub airports, 2019-2024.
"""
import os
import time
import requests

OUT_DIR = "/data/raw/weather"
os.makedirs(OUT_DIR, exist_ok=True)

# 24 hub airports grouped by state ASOS network
# Format: (state_code, [list of IATA station codes])
STATIONS = {
    "AZ": ["PHX"],
    "CA": ["LAX", "SFO", "SAN"],
    "CO": ["DEN"],
    "FL": ["MIA", "MCO", "FLL"],
    "GA": ["ATL"],
    "IL": ["ORD", "MDW"],
    "MA": ["BOS"],
    "MI": ["DTW"],
    "MN": ["MSP"],
    "NC": ["CLT"],
    "NJ": ["EWR"],
    "NV": ["LAS"],
    "NY": ["JFK", "LGA"],
    "PA": ["PHL"],
    "TX": ["DFW", "IAH", "AUS"],
    "WA": ["SEA"],
}

BASE_URL = "https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py"
FIELDS = ["tmpf", "dwpf", "relh", "drct", "sknt", "p01i", "vsby", "wxcodes"]

for state, stations in STATIONS.items():
    output_file = os.path.join(OUT_DIR, f"weather_{state}.csv")
    if os.path.exists(output_file):
        print(f"Skip (exists): {output_file}")
        continue

    params = {
        "network": f"{state}_ASOS",
        "tz": "Etc/UTC",
        "format": "onlycomma",
        "latlon": "no",
        "elev": "no",
        "missing": "M",
        "trace": "T",
        "direct": "no",
        "report_type": ["3", "4"],
        "year1": "2019", "month1": "1", "day1": "1",
        "year2": "2024", "month2": "12", "day2": "31",
    }
    for station in stations:
        params.setdefault("station", [])
        if isinstance(params["station"], list):
            params["station"].append(station)
        else:
            params["station"] = [params["station"], station]

    for field in FIELDS:
        params.setdefault("data", [])
        if isinstance(params["data"], list):
            params["data"].append(field)
        else:
            params["data"] = [params["data"], field]

    print(f"Downloading {state} ({', '.join(stations)}) ... ", end="", flush=True)
    try:
        r = requests.get(BASE_URL, params=params, timeout=300)
        r.raise_for_status()
        with open(output_file, "wb") as f:
            f.write(r.content)
        size_mb = os.path.getsize(output_file) / 1024 / 1024
        print(f"{size_mb:.1f} MB")
    except Exception as e:
        print(f"FAILED: {e}")

    time.sleep(2)

print("\nAll weather downloads complete!")
