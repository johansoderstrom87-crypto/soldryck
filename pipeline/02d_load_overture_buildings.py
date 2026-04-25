"""
Steg 2d: Ladda byggnadsdelar från Overture Maps för mer detaljerade skuggor.

Overture Maps buildings har två typer:
  building      — hela byggnaden med en höjd
  building_part — en del av byggnaden med egen höjd (t.ex. tornspira, kyrkskepp)

Strategi:
  1. Hämta alla building_parts med höjd → används direkt
  2. Hämta alla buildings → används där parts saknas
  3. LOD1-byggnader används som fallback där Overture saknar data helt

Resultat: data/buildings_overture.gpkg
Används av 03_compute_shadows.py (prioriteras framför buildings.gpkg om den finns)
"""

import os
import sys
import geopandas as gpd
import pandas as pd
import numpy as np

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
LOD1_FILE = os.path.join(DATA_DIR, "buildings.gpkg")
OUTPUT_FILE = os.path.join(DATA_DIR, "buildings_overture.gpkg")

LON_MIN, LAT_MIN, LON_MAX, LAT_MAX = 17.82, 59.23, 18.22, 59.44

# Kontrollera senaste release på https://docs.overturemaps.org/
OVERTURE_RELEASE = "2026-04-15.0"
OVERTURE_BASE = f"s3://overturemaps-us-west-2/release/{OVERTURE_RELEASE}/theme=buildings"


def ensure_duckdb():
    try:
        import duckdb
        return duckdb
    except ImportError:
        print("  Installerar duckdb...")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "duckdb>=1.0"])
        import duckdb
        return duckdb


def get_connection(duckdb):
    con = duckdb.connect()
    for ext in ["httpfs", "spatial"]:
        try:
            con.execute(f"INSTALL {ext}; LOAD {ext};")
        except Exception:
            try:
                con.execute(f"LOAD {ext};")
            except Exception as e:
                print(f"  Varning: {ext} kunde inte laddas: {e}")
    con.execute("SET s3_region='us-west-2'; SET s3_use_ssl=true;")
    return con


def wkb_to_gdf(df, drop_cols=None):
    """Konvertera DataFrame med WKB-geometri till GeoDataFrame."""
    from shapely import from_wkb
    geoms = []
    for g in df["geometry"]:
        try:
            geoms.append(from_wkb(bytes(g)) if g is not None else None)
        except Exception:
            geoms.append(None)
    cols = [c for c in df.columns if c != "geometry"] if not drop_cols else \
           [c for c in df.columns if c != "geometry" and c not in drop_cols]
    gdf = gpd.GeoDataFrame(df[cols], geometry=geoms, crs="EPSG:4326")
    gdf = gdf[gdf.geometry.notna() & gdf.geometry.is_valid & ~gdf.geometry.is_empty]
    return gdf


def download_parts(con):
    print("  Hämtar building_parts (tornspetsar, kyrkskepp etc.)...")
    q = f"""
        SELECT id, geometry, CAST(height AS DOUBLE) as height
        FROM read_parquet('{OVERTURE_BASE}/type=building_part/*', hive_partitioning=1)
        WHERE bbox.xmin < {LON_MAX} AND bbox.xmax > {LON_MIN}
          AND bbox.ymin < {LAT_MAX} AND bbox.ymax > {LAT_MIN}
          AND height IS NOT NULL AND CAST(height AS DOUBLE) > 0
    """
    df = con.execute(q).df()
    print(f"  {len(df)} building_parts")
    return df


def download_buildings(con):
    print("  Hämtar buildings...")
    q = f"""
        SELECT
            id,
            geometry,
            CAST(height AS DOUBLE) as height,
            CAST(num_floors AS INTEGER) as num_floors
        FROM read_parquet('{OVERTURE_BASE}/type=building/*', hive_partitioning=1)
        WHERE bbox.xmin < {LON_MAX} AND bbox.xmax > {LON_MIN}
          AND bbox.ymin < {LAT_MAX} AND bbox.ymax > {LAT_MIN}
    """
    df = con.execute(q).df()
    print(f"  {len(df)} buildings")
    return df


def resolve_height(row):
    """Returnera bästa tillgängliga höjdestimering."""
    h = row.get("height")
    if pd.notna(h) and h > 0:
        return float(h)
    floors = row.get("num_floors")
    if pd.notna(floors) and floors > 0:
        return float(floors) * 3.0
    return None


def load_lod1():
    gdf = gpd.read_file(LOD1_FILE)
    gdf = gdf.rename(columns={"BYGG_H": "height"})
    gdf["source"] = "lod1"
    gdf = gdf[["geometry", "height", "source"]].copy()
    gdf = gdf[gdf["height"].notna() & (gdf["height"] > 0)]
    return gdf


def find_lod1_fallback(lod1_gdf, overture_with_height_gdf):
    """
    Hitta LOD1-byggnader som INTE täcks av Overture-data MED höjd.
    Overture-byggnader utan höjd räknas inte — LOD1:s laserskannade höjd
    används som fallback för dem.
    """
    print("  Hittar LOD1-byggnader utan Overture-höjddata...")
    lod1_reset = lod1_gdf.reset_index(drop=True)
    overture_simple = overture_with_height_gdf[["geometry"]].copy()

    joined = gpd.sjoin(lod1_reset, overture_simple, how="left", predicate="intersects")
    covered_idx = set(joined[joined["index_right"].notna()].index)
    fallback = lod1_reset[~lod1_reset.index.isin(covered_idx)].copy()
    print(f"  {len(fallback)} LOD1-byggnader tas med som fallback (Overture saknar höjd)")
    return fallback


def run():
    print("=== Steg 2d: Laddar Overture Maps byggnadsdata ===")

    duckdb = ensure_duckdb()

    try:
        con = get_connection(duckdb)
        parts_raw = download_parts(con)
        buildings_raw = download_buildings(con)
        con.close()
    except Exception as e:
        print(f"\nFel vid nedladdning: {e}")
        print("Tips: kontrollera nätverksåtkomst och att duckdb httpfs-tillägget fungerar")
        return False

    print("\nKonverterar geometrier...")
    parts_gdf = wkb_to_gdf(parts_raw)
    parts_gdf["source"] = "overture_part"
    parts_gdf = parts_gdf[["geometry", "height", "source"]].copy()

    buildings_gdf = wkb_to_gdf(buildings_raw)
    buildings_gdf["height"] = buildings_gdf.apply(resolve_height, axis=1)
    buildings_gdf["source"] = "overture_building"
    buildings_gdf_all = buildings_gdf[["geometry", "height", "source"]].copy()
    buildings_gdf_with_height = buildings_gdf_all[buildings_gdf_all["height"].notna()].copy()

    print(f"  Overture parts med höjd: {len(parts_gdf)}")
    print(f"  Overture buildings med höjd: {len(buildings_gdf_with_height)} / {len(buildings_gdf_all)} totalt")

    # LOD1 fallback — för byggnader helt utanför Overtures täckning
    print("\nLaddar LOD1-fallback...")
    lod1_gdf = load_lod1()
    print(f"  {len(lod1_gdf)} LOD1-byggnader totalt")

    overture_with_height = pd.concat(
        [parts_gdf[["geometry"]], buildings_gdf_with_height[["geometry"]]], ignore_index=True
    )
    overture_with_height_gdf = gpd.GeoDataFrame(overture_with_height, crs="EPSG:4326")
    lod1_fallback = find_lod1_fallback(lod1_gdf, overture_with_height_gdf)

    # Slå samman
    combined = pd.concat(
        [parts_gdf, buildings_gdf_with_height, lod1_fallback],
        ignore_index=True
    )
    combined_gdf = gpd.GeoDataFrame(combined, crs="EPSG:4326")
    combined_gdf = combined_gdf[combined_gdf["height"] > 0].copy()

    print(f"\nTotalt: {len(combined_gdf)} byggnads-objekt")
    for src, count in combined_gdf["source"].value_counts().items():
        pct = count / len(combined_gdf) * 100
        print(f"  {src}: {count} ({pct:.0f}%)")

    avg_h = combined_gdf["height"].mean()
    print(f"  Medelhöjd: {avg_h:.1f} m")

    print(f"\nSparar {OUTPUT_FILE}...")
    combined_gdf.to_file(OUTPUT_FILE, driver="GPKG")
    size_mb = os.path.getsize(OUTPUT_FILE) / 1024 / 1024
    print(f"Klart! ({size_mb:.1f} MB)")
    return True


if __name__ == "__main__":
    run()
