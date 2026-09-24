"""
csv_to_geojson.py
------------------
A beginner-friendly script that converts OpenCelliD's Rwanda cell-tower
CSV file into separate GeoJSON files, one per mobile operator.

WHAT IS GeoJSON?
GeoJSON is just a text file (like CSV) but written in a special structure
that mapping tools (like Leaflet.js) understand automatically. Every
location becomes a small block of text like this:

    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [longitude, latitude] },
      "properties": { "radio": "GSM", "range": 1147 }
    }

HOW TO RUN THIS SCRIPT
1. Make sure you have Python installed (most computers already do).
2. Put this script in the same folder as your "635.csv" file.
3. Open a terminal/command prompt in that folder.
4. Run:  python csv_to_geojson.py
5. It will create "mtn.geojson" and "airtel.geojson" in the same folder.

You do NOT need to install anything extra — this script only uses Python's
built-in tools (csv and json), no external libraries required.
"""

import csv
import json

# -----------------------------
# STEP 1: Settings you can change
# -----------------------------

INPUT_FILE = "635.csv"          # the file you downloaded from OpenCelliD

# OpenCelliD's column order is always the same for every country file.
# We name each column here so the rest of the code is easy to read.
COLUMN_NAMES = [
    "radio", "mcc", "net", "area", "cell", "unit",
    "lon", "lat", "range", "samples", "changeable",
    "created", "updated", "avg_signal"
]

# Map each operator's "net" code (MNC) to a human-readable name.
# We found these by counting the codes in your actual Rwanda file.
OPERATOR_NAMES = {
    "10": "MTN",
    "13": "Airtel",
}

# -----------------------------
# STEP 2: Read the CSV and sort rows by operator
# -----------------------------

# This dictionary will hold one list of towers per operator, e.g.
# { "MTN": [...towers...], "Airtel": [...towers...] }
towers_by_operator = {name: [] for name in OPERATOR_NAMES.values()}

with open(INPUT_FILE, "r", encoding="utf-8") as f:
    reader = csv.reader(f)

    for row in reader:
        # Turn the row (a plain list of text values) into a labeled
        # dictionary, e.g. {"radio": "GSM", "mcc": "635", "net": "10", ...}
        record = dict(zip(COLUMN_NAMES, row))

        operator_code = record["net"]
        operator_name = OPERATOR_NAMES.get(operator_code)

        if operator_name is None:
            # Skip any operator code we don't recognise (safety net)
            continue

        # Longitude/latitude come as text ("30.1392") - convert to numbers
        try:
            lon = float(record["lon"])
            lat = float(record["lat"])
        except ValueError:
            # Skip broken/empty rows instead of crashing
            continue

        towers_by_operator[operator_name].append({
            "lon": lon,
            "lat": lat,
            "radio": record["radio"],
            "range_m": record["range"],
            "samples": record["samples"],
        })

# -----------------------------
# STEP 3: Convert each operator's tower list into GeoJSON format
# -----------------------------

def make_geojson(tower_list):
    """Turn a plain list of towers into a GeoJSON FeatureCollection."""
    features = []
    for t in tower_list:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [t["lon"], t["lat"]]  # GeoJSON = [lon, lat] order!
            },
            "properties": {
                "radio": t["radio"],
                "range_m": t["range_m"],
                "samples": t["samples"],
            }
        })
    return {
        "type": "FeatureCollection",
        "features": features
    }

# -----------------------------
# STEP 4: Write one GeoJSON file per operator
# -----------------------------

for operator_name, tower_list in towers_by_operator.items():
    geojson_data = make_geojson(tower_list)
    output_filename = f"{operator_name.lower()}.geojson"

    with open(output_filename, "w", encoding="utf-8") as out_file:
        json.dump(geojson_data, out_file)

    print(f"✔ {operator_name}: {len(tower_list)} towers written to {output_filename}")

print("\nDone! You should now see mtn.geojson and airtel.geojson in this folder.")
