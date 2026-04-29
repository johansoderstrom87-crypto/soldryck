"""
Steg 9: Hämta tunnelbane-data från SLs officiella GTFS-data (Trafiklab).

GTFS-filen (gtfs_sl.zip) hämtas automatiskt om den saknas.
Trafiklab API-nyckel krävs (env: TRAFIKLAB_API_KEY eller hårdkodad nedan).

Spår och stationer: GTFS shapes.txt + stops.txt (officiell SL-data, inga OSM-hack)
Uppgångar:          OSM Overpass (GTFS saknar uppgångsgeometri)

Resultat:
  frontend/app/data/metro-network.ts
"""

import csv
import io
import json
import os
import time
import urllib.parse
import urllib.request
import zipfile
from collections import defaultdict

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GTFS_FILE = os.path.join(SCRIPT_DIR, "..", "gtfs_sl.zip")
DATA_DIR = os.path.join(SCRIPT_DIR, "data")
RAW_DIR = os.path.join(DATA_DIR, "raw")
FRONTEND_OUT = os.path.normpath(
    os.path.join(SCRIPT_DIR, "..", "frontend", "app", "data", "metro-network.ts")
)

TRAFIKLAB_API_KEY = "bfe9a99f24cc4dfdbf9c4dc8d3480352"
GTFS_URL = f"https://opendata.trafiklab.se/api/gtfs-static/sltrafik?key={TRAFIKLAB_API_KEY}"

BBOX = "59.18,17.75,59.45,18.25"  # för OSM-uppgångar

LINE_COLOR: dict[str, str] = {
    "10": "blue", "11": "blue",
    "13": "red",  "14": "red",
    "17": "green","18": "green","19": "green",
}

METRO_ROUTE_TYPE = "401"  # Extended GTFS: Metro/Tunnelbana

OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

ENTRANCE_QUERY = f"""[out:json][timeout:120];
node["railway"="subway_entrance"]({BBOX});
out body;"""


# ---------------------------------------------------------------------------
# GTFS
# ---------------------------------------------------------------------------

def ensure_gtfs() -> None:
    if os.path.exists(GTFS_FILE):
        print(f"Använder befintlig GTFS-fil: {GTFS_FILE}")
        return
    print(f"Laddar ner GTFS från Trafiklab...")
    req = urllib.request.Request(GTFS_URL, headers={"User-Agent": "Soldryck/1.0"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = resp.read()
    with open(GTFS_FILE, "wb") as f:
        f.write(data)
    print(f"Sparat: {GTFS_FILE} ({len(data)//1024} KB)")


def load_gtfs_tracks() -> list[dict]:
    """Läs GTFS shapes och returnera en lista track-dicts per linje.

    Väljer den LÄNGSTA shape per metro-route (täcker hela linjen),
    konverterar till [lat, lng]-listor."""
    with zipfile.ZipFile(GTFS_FILE) as z:
        # 1. Hitta metro-routes (route_type=401)
        metro_routes: dict[str, str] = {}  # route_id → color
        for row in csv.DictReader(io.TextIOWrapper(z.open("routes.txt"), encoding="utf-8-sig")):
            if row.get("route_type") != METRO_ROUTE_TYPE:
                continue
            ref = row.get("route_short_name", "").lstrip("Tt").strip()
            color = LINE_COLOR.get(ref)
            if color:
                metro_routes[row["route_id"]] = color

        print(f"Metro-routes: {len(metro_routes)}")

        # 2. Samla shape_ids per route
        shapes_per_route: dict[str, set] = defaultdict(set)
        for row in csv.DictReader(io.TextIOWrapper(z.open("trips.txt"), encoding="utf-8-sig")):
            if row["route_id"] in metro_routes:
                shapes_per_route[row["route_id"]].add(row["shape_id"])

        needed_shape_ids = {sid for sids in shapes_per_route.values() for sid in sids}
        print(f"Relevanta shape_ids: {len(needed_shape_ids)}")

        # 3. Läs shapes (filtrera direkt — 3.9 M rader totalt)
        shapes_data: dict[str, list] = defaultdict(list)
        for row in csv.DictReader(io.TextIOWrapper(z.open("shapes.txt"), encoding="utf-8-sig")):
            if row["shape_id"] in needed_shape_ids:
                shapes_data[row["shape_id"]].append(row)

        # 4. Välj längsta shape per route → en kedja per linje
        tracks = []
        for route_id, color in metro_routes.items():
            sid_set = shapes_per_route.get(route_id, set())
            if not sid_set:
                continue
            best_sid = max(sid_set, key=lambda sid: len(shapes_data.get(sid, [])))
            pts = sorted(
                shapes_data[best_sid],
                key=lambda r: int(r["shape_pt_sequence"]),
            )
            coords = [
                [round(float(p["shape_pt_lat"]), 5), round(float(p["shape_pt_lon"]), 5)]
                for p in pts
            ]
            if len(coords) >= 2:
                tracks.append({"color": color, "coords": coords})
                print(f"  {color} route {route_id}: {len(coords)} punkter "
                      f"({pts[0]['shape_pt_lat'][:5]},{pts[-1]['shape_pt_lat'][:5]})")

    return tracks


def load_gtfs_stations() -> list[dict]:
    """Hämta unika metro-stationer från GTFS stops + stop_times.

    Filtrerar fram stop_ids som används av metro-trips, deduplicerar
    stationer med samma namn (olika plattformsvarianter), returnerar
    {name, lat, lng} per station."""
    with zipfile.ZipFile(GTFS_FILE) as z:
        # Metro route_ids
        metro_route_ids: set[str] = set()
        for row in csv.DictReader(io.TextIOWrapper(z.open("routes.txt"), encoding="utf-8-sig")):
            if row.get("route_type") == METRO_ROUTE_TYPE:
                metro_route_ids.add(row["route_id"])

        # Metro trip_ids
        metro_trip_ids: set[str] = set()
        for row in csv.DictReader(io.TextIOWrapper(z.open("trips.txt"), encoding="utf-8-sig")):
            if row["route_id"] in metro_route_ids:
                metro_trip_ids.add(row["trip_id"])

        print(f"Metro trips: {len(metro_trip_ids)}")

        # Metro stop_ids från en representativ delmängd av trips
        # (alla trips ger samma stations, vi samplar för snabbhet)
        sample_trips = set(list(metro_trip_ids)[:200])
        metro_stop_ids: set[str] = set()
        for row in csv.DictReader(io.TextIOWrapper(z.open("stop_times.txt"), encoding="utf-8-sig")):
            if row["trip_id"] in sample_trips:
                metro_stop_ids.add(row["stop_id"])

        print(f"Metro stop_ids: {len(metro_stop_ids)}")

        # Läs stops
        all_stops: dict[str, dict] = {}
        for row in csv.DictReader(io.TextIOWrapper(z.open("stops.txt"), encoding="utf-8-sig")):
            all_stops[row["stop_id"]] = row

        # Filtrera metro-stops och deduplicera på namn (ta centroiden)
        name_groups: dict[str, list] = defaultdict(list)
        for sid in metro_stop_ids:
            stop = all_stops.get(sid)
            if not stop:
                continue
            name = stop.get("stop_name", "").strip()
            if not name:
                continue
            lat = float(stop.get("stop_lat", 0))
            lng = float(stop.get("stop_lon", 0))
            if lat and lng:
                name_groups[name].append((lat, lng))

        stations = []
        for name, coords in sorted(name_groups.items()):
            avg_lat = sum(c[0] for c in coords) / len(coords)
            avg_lng = sum(c[1] for c in coords) / len(coords)
            stations.append({
                "name": name,
                "lat": round(avg_lat, 5),
                "lng": round(avg_lng, 5),
            })

    return stations


# ---------------------------------------------------------------------------
# OSM-uppgångar (entrances)
# ---------------------------------------------------------------------------

def fetch_overpass(query: str, max_retries: int = 3) -> dict:
    data = urllib.parse.urlencode({"data": query}).encode("utf-8")
    for attempt in range(max_retries):
        for url in OVERPASS_URLS:
            try:
                print(f"  Overpass {url} (försök {attempt + 1})...")
                req = urllib.request.Request(
                    url, data=data,
                    headers={"User-Agent": "Soldryck/1.0 (sun-tracker)"},
                )
                return json.loads(urllib.request.urlopen(req, timeout=120).read().decode("utf-8"))
            except Exception as e:
                print(f"  Misslyckades: {e}")
                time.sleep(5)
    raise RuntimeError("Kunde inte nå Overpass API")


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    from math import asin, cos, radians, sin, sqrt
    R = 6371000.0
    p1, p2 = radians(lat1), radians(lat2)
    dp, dl = radians(lat2 - lat1), radians(lon2 - lon1)
    a = sin(dp / 2) ** 2 + cos(p1) * cos(p2) * sin(dl / 2) ** 2
    return 2 * R * asin(sqrt(a))


def build_entrances(elements: list, stations: list[dict]) -> list[dict]:
    """Koppla OSM subway_entrance-noder till närmaste GTFS-station (≤ 250 m)."""
    entrances = []
    seen: set = set()
    for el in elements:
        if el["type"] != "node" or el.get("tags", {}).get("railway") != "subway_entrance":
            continue
        lat, lon = el.get("lat"), el.get("lon")
        if lat is None:
            continue
        key = (round(lat, 5), round(lon, 5))
        if key in seen:
            continue
        seen.add(key)

        best_dist = float("inf")
        best_station = None
        for s in stations:
            d = haversine_m(lat, lon, s["lat"], s["lng"])
            if d < best_dist:
                best_dist = d
                best_station = s
        if not best_station or best_dist > 250:
            continue

        entrances.append({
            "lat": round(lat, 5),
            "lng": round(lon, 5),
            "name": el.get("tags", {}).get("name", ""),
            "link": [
                [best_station["lat"], best_station["lng"]],
                [round(lat, 5), round(lon, 5)],
            ],
        })
    return entrances


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------

def export_typescript(
    tracks: list[dict],
    stations: list[dict],
    entrances: list[dict],
    output_path: str,
) -> None:
    lines = [
        "/** Auto-generated by pipeline/09_fetch_metro.py — do not edit by hand */",
        "",
        'export type MetroLineColor = "red" | "green" | "blue";',
        "",
        "export interface MetroTrack {",
        "  color: MetroLineColor;",
        "  coords: [number, number][];",
        "}",
        "",
        "export interface MetroStation {",
        "  lat: number;",
        "  lng: number;",
        "  name: string;",
        "}",
        "",
        "export interface MetroEntrance {",
        "  lat: number;",
        "  lng: number;",
        "  name: string;",
        "  link: [[number, number], [number, number]];",
        "}",
        "",
        "export const METRO_TRACKS: MetroTrack[] = [",
    ]
    for t in tracks:
        lines.append(f'  {{ color: "{t["color"]}", coords: {json.dumps(t["coords"])} }},')
    lines += ["];", "", "export const METRO_STATIONS: MetroStation[] = ["]
    for s in stations:
        name_safe = s["name"].replace("\\", "\\\\").replace('"', '\\"')
        lines.append(f'  {{ lat: {s["lat"]}, lng: {s["lng"]}, name: "{name_safe}" }},')
    lines += ["];", "", "export const METRO_ENTRANCES: MetroEntrance[] = ["]
    for e in entrances:
        name_safe = e["name"].replace("\\", "\\\\").replace('"', '\\"')
        lines.append(
            f'  {{ lat: {e["lat"]}, lng: {e["lng"]}, name: "{name_safe}", '
            f'link: {json.dumps(e["link"])} }},'
        )
    lines += ["];", ""]

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(RAW_DIR, exist_ok=True)

    print("=== Steg 9: Tunnelbana från GTFS (Trafiklab) ===")
    ensure_gtfs()

    print("\n--- Spår och stationer från GTFS ---")
    tracks = load_gtfs_tracks()
    stations = load_gtfs_stations()

    print(f"\nSpår: {len(tracks)}")
    for t in tracks:
        print(f"  {t['color']}: {len(t['coords'])} punkter")
    print(f"Stationer: {len(stations)}")

    print("\n--- Uppgångar från OSM ---")
    raw_file = os.path.join(RAW_DIR, "osm_metro_entrances.json")
    if os.path.exists(raw_file):
        print(f"Använder cachad data: {raw_file}")
        with open(raw_file, encoding="utf-8") as f:
            osm_data = json.load(f)
    else:
        osm_data = fetch_overpass(ENTRANCE_QUERY)
        with open(raw_file, "w", encoding="utf-8") as f:
            json.dump(osm_data, f, ensure_ascii=False)
        print(f"OSM-data sparad: {raw_file}")

    entrances = build_entrances(osm_data.get("elements", []), stations)
    print(f"Uppgångar: {len(entrances)}")

    export_typescript(tracks, stations, entrances, FRONTEND_OUT)
    print(f"\nExporterat till {FRONTEND_OUT}")


if __name__ == "__main__":
    main()
