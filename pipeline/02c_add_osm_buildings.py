"""
Steg 2c: Komplettera byggnadsdata med OSM-byggnader for kommuner utanfor Stockholm.

Stockholm Dataportalen tacker bara Stockholms kommun. Uteserveringar i
Solna, Sundbyberg, Lidingo, Nacka etc. saknar byggnadsdata.

Losning: Hamta byggnader fran OSM via Overpass API for omraden dar vi har
venues men saknar byggnader.

OSM byggnader har ibland height/building:levels-taggar som ger hojd.
Saknas hojd antas 12m (4 vaningar, vanligt i forstader).
"""

import os
import json
import math
import time
import urllib.request

import geopandas as gpd
import pandas as pd
from shapely.geometry import shape, Point, box
from shapely.ops import unary_union

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
VENUES_FILE = os.path.join(DATA_DIR, "venues.geojson")
BUILDINGS_FILE = os.path.join(DATA_DIR, "buildings.gpkg")
OUTPUT_FILE = os.path.join(DATA_DIR, "buildings.gpkg")  # Overwrite

DEFAULT_HEIGHT = 12.0  # Default building height (4 floors)
FLOOR_HEIGHT = 3.0  # Meters per floor
SEARCH_RADIUS = 0.004  # ~400m in degrees

OVERPASS_SERVERS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]


def query_overpass(query: str) -> dict:
    """Query Overpass API with retry."""
    for server in OVERPASS_SERVERS:
        try:
            print(f"  Forsoker {server}...")
            data = urllib.parse.urlencode({"data": query}).encode()
            req = urllib.request.Request(server, data=data)
            req.add_header("User-Agent", "Soldryck/1.0 (Stockholm sun tracker)")
            with urllib.request.urlopen(req, timeout=120) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            print(f"    Misslyckades: {e}")
            time.sleep(2)
    raise RuntimeError("Alla Overpass-servrar misslyckades")


def get_osm_buildings(bbox: tuple) -> gpd.GeoDataFrame:
    """Fetch buildings from OSM for a bounding box."""
    south, west, north, east = bbox

    query = f"""
    [out:json][timeout:120];
    (
      way["building"]({south},{west},{north},{east});
      relation["building"]({south},{west},{north},{east});
    );
    out body;
    >;
    out skel qt;
    """

    print(f"  Hamtar OSM-byggnader for bbox ({south:.3f},{west:.3f},{north:.3f},{east:.3f})...")
    result = query_overpass(query)

    # Parse nodes
    nodes = {}
    for elem in result["elements"]:
        if elem["type"] == "node":
            nodes[elem["id"]] = (elem["lon"], elem["lat"])

    # Parse ways into polygons
    buildings = []
    for elem in result["elements"]:
        if elem["type"] != "way" or "tags" not in elem:
            continue
        tags = elem.get("tags", {})
        if "building" not in tags:
            continue

        coords = []
        for nd_id in elem.get("nodes", []):
            if nd_id in nodes:
                coords.append(nodes[nd_id])
        if len(coords) < 4:
            continue

        # Ensure closed ring
        if coords[0] != coords[-1]:
            coords.append(coords[0])

        try:
            from shapely.geometry import Polygon
            poly = Polygon(coords)
            if not poly.is_valid:
                poly = poly.buffer(0)
            if poly.is_empty or poly.area < 1e-10:
                continue
        except Exception:
            continue

        # Extract height
        height = DEFAULT_HEIGHT
        if "height" in tags:
            try:
                h = float(tags["height"].replace("m", "").strip())
                if 1 < h < 200:
                    height = h
            except ValueError:
                pass
        elif "building:levels" in tags:
            try:
                levels = float(tags["building:levels"])
                height = levels * FLOOR_HEIGHT
            except ValueError:
                pass

        buildings.append({
            "geometry": poly,
            "BYGG_H": height,
            "MARK_Z": 0.0,
            "TAK_Z": height,
            "GRUPP": "osm",
            "district": "osm",
        })

    if not buildings:
        return gpd.GeoDataFrame()

    gdf = gpd.GeoDataFrame(buildings, crs="EPSG:4326")
    print(f"  {len(gdf)} OSM-byggnader hamtade")
    return gdf


def main():
    print("=== Steg 2c: Komplettera med OSM-byggnader ===")

    # Load existing data
    venues = gpd.read_file(VENUES_FILE)
    buildings = gpd.read_file(BUILDINGS_FILE)
    print(f"  {len(venues)} venues, {len(buildings)} befintliga byggnader")

    # Find venues without nearby buildings
    buildings_sindex = buildings.sindex
    uncovered_venues = []

    for _, venue in venues.iterrows():
        pt = venue.geometry
        search = box(pt.x - SEARCH_RADIUS, pt.y - SEARCH_RADIUS,
                     pt.x + SEARCH_RADIUS, pt.y + SEARCH_RADIUS)
        candidates = list(buildings_sindex.intersection(search.bounds))
        if len(candidates) < 3:  # Very few buildings nearby
            uncovered_venues.append(venue)

    print(f"  {len(uncovered_venues)} venues saknar tillracklig byggnadsdata")

    if not uncovered_venues:
        print("  Alla venues har byggnadsdata, inget att gora!")
        return

    # Group uncovered venues into bboxes to minimize API calls
    # Create a union of uncovered venue areas
    uncovered_points = [v.geometry for v in uncovered_venues]
    uncovered_area = unary_union([p.buffer(SEARCH_RADIUS) for p in uncovered_points])

    # Get overall bbox
    bounds = uncovered_area.bounds  # (minx, miny, maxx, maxy)
    bbox = (bounds[1], bounds[0], bounds[3], bounds[2])  # (south, west, north, east)

    # Split into smaller bboxes if area is too large
    south, west, north, east = bbox
    lat_range = north - south
    lng_range = east - west

    # Create per-venue bboxes (small, focused queries)
    # Group nearby uncovered venues to reduce API calls
    bboxes = []
    used = set()
    for i, pt in enumerate(uncovered_points):
        if i in used:
            continue
        # Start bbox from this point
        min_lat, max_lat = pt.y - SEARCH_RADIUS, pt.y + SEARCH_RADIUS
        min_lng, max_lng = pt.x - SEARCH_RADIUS, pt.x + SEARCH_RADIUS
        used.add(i)
        # Expand to include nearby uncovered venues
        for j, pt2 in enumerate(uncovered_points):
            if j in used:
                continue
            if abs(pt2.y - pt.y) < 0.015 and abs(pt2.x - pt.x) < 0.015:
                min_lat = min(min_lat, pt2.y - SEARCH_RADIUS)
                max_lat = max(max_lat, pt2.y + SEARCH_RADIUS)
                min_lng = min(min_lng, pt2.x - SEARCH_RADIUS)
                max_lng = max(max_lng, pt2.x + SEARCH_RADIUS)
                used.add(j)
        bboxes.append((min_lat, min_lng, max_lat, max_lng))

    print(f"  Delar upp i {len(bboxes)} API-anrop")

    # Fetch OSM buildings
    all_osm = []
    for i, bb in enumerate(bboxes):
        for attempt in range(3):
            try:
                gdf = get_osm_buildings(bb)
                if len(gdf) > 0:
                    all_osm.append(gdf)
                print(f"  [{i+1}/{len(bboxes)}] OK")
                break
            except Exception as e:
                print(f"  [{i+1}/{len(bboxes)}] Forsok {attempt+1}/3: {e}")
                time.sleep(5 * (attempt + 1))  # Increasing backoff
        time.sleep(3)  # Rate limit between calls

    if not all_osm:
        print("  Inga OSM-byggnader hittades")
        return

    osm_buildings = pd.concat(all_osm, ignore_index=True)
    osm_buildings = gpd.GeoDataFrame(osm_buildings, crs="EPSG:4326")

    # Remove duplicates (buildings that overlap with existing data)
    existing_area = unary_union(buildings.geometry.buffer(0.00005))
    osm_new = osm_buildings[~osm_buildings.geometry.intersects(existing_area)].copy()
    print(f"  {len(osm_new)} nya OSM-byggnader (ej overlappande)")

    # Filter to only buildings near uncovered venues
    uncovered_buffer = unary_union([p.buffer(SEARCH_RADIUS) for p in uncovered_points])
    osm_nearby = osm_new[osm_new.intersects(uncovered_buffer)].copy()
    print(f"  {len(osm_nearby)} nara venues utan tacking")

    if len(osm_nearby) == 0:
        print("  Inga nya byggnader att lagga till")
        return

    # Merge with existing buildings
    # Ensure same columns
    for col in ["BYGG_H", "MARK_Z", "TAK_Z", "GRUPP", "district"]:
        if col not in osm_nearby.columns:
            osm_nearby[col] = 0.0 if col != "GRUPP" and col != "district" else "osm"

    combined = pd.concat([buildings, osm_nearby[buildings.columns]], ignore_index=True)
    combined = gpd.GeoDataFrame(combined, crs="EPSG:4326")

    print(f"\nTotalt: {len(combined)} byggnader ({len(buildings)} original + {len(osm_nearby)} OSM)")

    # Save
    combined.to_file(OUTPUT_FILE, driver="GPKG")
    size_mb = os.path.getsize(OUTPUT_FILE) / 1024 / 1024
    print(f"Sparat: {OUTPUT_FILE} ({size_mb:.1f} MB)")


if __name__ == "__main__":
    main()
