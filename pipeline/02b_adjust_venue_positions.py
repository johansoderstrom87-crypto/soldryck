"""
Steg 2b: Justera venue-positioner så de ligger UTANFÖR byggnader.

Problem: OSM-koordinater pekar ofta på restaurangens adress (inne i byggnaden),
inte på uteserveringen som ligger på trottoaren utanför.

Lösning:
1. Kolla om varje venue-punkt ligger inuti en byggnad
2. Om ja → flytta punkten till närmaste punkt på byggnadens kant + 3m utåt
3. Riktningen väljs mot närmaste väg/gata (om tillgängligt) eller mot söder

Resultat: Uppdaterad data/venues.geojson med justerade koordinater
"""

import os
import json
import math
import geopandas as gpd
import numpy as np
from shapely.geometry import Point, MultiPolygon
from shapely.ops import nearest_points

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
VENUES_FILE = os.path.join(DATA_DIR, "venues.geojson")
BUILDINGS_FILE = os.path.join(DATA_DIR, "buildings.gpkg")
OUTPUT_FILE = os.path.join(DATA_DIR, "venues.geojson")  # Overwrite

# Offset distance from building wall (in degrees, ~3m)
OFFSET_M = 3.0
M_PER_DEG_LAT = 111320.0
M_PER_DEG_LNG = 111320.0 * math.cos(math.radians(59.33))


def move_point_outside_building(point: Point, building_geom, offset_m: float = OFFSET_M) -> Point:
    """Flytta en punkt till utsidan av en byggnad."""

    # Hitta närmaste punkt på byggnadens kant
    if isinstance(building_geom, MultiPolygon):
        # Find closest polygon
        min_dist = float('inf')
        closest_geom = None
        for poly in building_geom.geoms:
            d = poly.exterior.distance(point)
            if d < min_dist:
                min_dist = d
                closest_geom = poly
        boundary = closest_geom.exterior
    else:
        boundary = building_geom.exterior

    nearest_on_boundary, _ = nearest_points(boundary, point)

    # Beräkna riktning utåt (från byggnadens centroid genom den närmaste kantpunkten)
    centroid = building_geom.centroid
    dx = nearest_on_boundary.x - centroid.x
    dy = nearest_on_boundary.y - centroid.y

    # Normalisera riktningen
    length = math.sqrt(dx**2 + dy**2)
    if length < 1e-10:
        # Fallback: flytta söderut (mot solen)
        dx, dy = 0, -1
        length = 1

    dx_norm = dx / length
    dy_norm = dy / length

    # Offset i grader
    offset_lng = (offset_m / M_PER_DEG_LNG) * dx_norm
    offset_lat = (offset_m / M_PER_DEG_LAT) * dy_norm

    new_point = Point(
        nearest_on_boundary.x + offset_lng,
        nearest_on_boundary.y + offset_lat,
    )

    return new_point


def main():
    print("=== Steg 2b: Justera venue-positioner ===")

    venues = gpd.read_file(VENUES_FILE)
    buildings = gpd.read_file(BUILDINGS_FILE)
    sindex = buildings.sindex

    print(f"  {len(venues)} venues, {len(buildings)} byggnader")

    moved = 0
    already_outside = 0

    for vi in range(len(venues)):
        point = venues.iloc[vi].geometry

        # Kolla om punkten ligger inuti en byggnad
        candidate_idxs = list(sindex.intersection(point.bounds))

        containing_building = None
        for idx in candidate_idxs:
            bld = buildings.iloc[idx]
            if bld.geometry.contains(point):
                containing_building = bld
                break

        if containing_building is None:
            already_outside += 1
            continue

        # Iterativt flytta ut punkten tills den inte ligger i någon byggnad
        new_point = point
        for attempt_offset in [3.0, 5.0, 8.0, 12.0]:
            new_point = move_point_outside_building(point, containing_building.geometry, offset_m=attempt_offset)

            # Kolla om nya punkten hamnar i NÅGON byggnad
            in_any = False
            for idx in list(sindex.intersection(new_point.bounds)):
                if buildings.iloc[idx].geometry.contains(new_point):
                    in_any = True
                    break

            if not in_any:
                break  # Framgång — punkten är utanför

        venues.at[venues.index[vi], 'geometry'] = new_point
        moved += 1

    print(f"  Flyttade: {moved} venues")
    print(f"  Redan utanför: {already_outside} venues")

    # Verify improvement
    still_inside = 0
    for vi in range(len(venues)):
        point = venues.iloc[vi].geometry
        candidate_idxs = list(sindex.intersection(point.bounds))
        for idx in candidate_idxs:
            if buildings.iloc[idx].geometry.contains(point):
                still_inside += 1
                break
    print(f"  Fortfarande inuti efter justering: {still_inside}")

    # Spara
    venues.to_file(OUTPUT_FILE, driver="GeoJSON")
    print(f"  Sparat till {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
