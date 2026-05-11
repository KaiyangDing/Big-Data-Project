import requests, zipfile, os, time, io

OUT_DIR = "/data/raw/flights"
os.makedirs(OUT_DIR, exist_ok=True)

BASE = "https://transtats.bts.gov/PREZIP/On_Time_Reporting_Carrier_On_Time_Performance_1987_present_{}_{}.zip"

for year in range(2019, 2025):
    for month in range(1, 13):
        out_csv = f"{OUT_DIR}/flights_{year}_{month:02d}.csv"
        if os.path.exists(out_csv):
            print(f"skip (exists): {out_csv}")
            continue

        url = BASE.format(year, month)
        print(f"downloading {year}-{month:02d} ... ", end="", flush=True)

        try:
            r = requests.get(url, timeout=180)
            r.raise_for_status()

            # unzip in memory so we don't need to keep the .zip on disk
            with zipfile.ZipFile(io.BytesIO(r.content)) as z:
                csv_name = [n for n in z.namelist() if n.endswith(".csv")][0]
                with z.open(csv_name) as src, open(out_csv, "wb") as dst:
                    dst.write(src.read())

            size_mb = os.path.getsize(out_csv) / 1024 / 1024
            print(f"{size_mb:.1f} MB")

        except Exception as e:
            print(f"failed: {e}")

        time.sleep(1.5)

print("\nDone.")
