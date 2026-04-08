"""
Steg 2: Ladda och sammanfoga 3D-byggnader från Stockholm Dataportalen.

Källa: SBK 3D-Byggnader LOD1 (generaliserade)
- Shapefiler per stadsdel
- EPSG:3011 → konverteras till EPSG:4326 (WGS84)
- Innehåller BYGG_H (byggnadshöjd), MARK_Z (markhöjd), TAK_Z (takhöjd)

Resultat: data/buildings.geojson
"""

import os
import glob
import json
import zipfile
import urllib.request
import geopandas as gpd
import pandas as pd

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
RAW_DIR = os.path.join(DATA_DIR, "raw")
LOD1_DIR = os.path.join(RAW_DIR, "LOD1_buildings")
ZIP_FILE = os.path.join(RAW_DIR, "LOD1_buildings.zip")
OUTPUT_FILE = os.path.join(DATA_DIR, "buildings.gpkg")

DOWNLOAD_URL = "https://dataportalen.stockholm.se/dataportalen/Data/Stadsbyggnadskontoret/LOD1_stadsdelsnamnder_SHP.zip"


def download_buildings():
    """Ladda ner 3D-byggnader om de inte redan finns."""
    if os.path.exists(LOD1_DIR) and glob.glob(os.path.join(LOD1_DIR, "*/Byggnad.shp")):
        print("  Byggnadsdata redan nedladdad.")
        return

    os.makedirs(RAW_DIR, exist_ok=True)

    if not os.path.exists(ZIP_FILE):
        print("  Laddar ner 3D-byggnader från Stockholm Dataportalen (17 MB)...")
        urllib.request.urlretrieve(DOWNLOAD_URL, ZIP_FILE)
        print(f"  Sparat: {ZIP_FILE}")

    print("  Packar upp...")
    with zipfile.ZipFile(ZIP_FILE, "r") as z:
        z.extractall(LOD1_DIR)
    print("  Klart!")


def load_and_merge_buildings() -> gpd.GeoDataFrame:
    """Läs alla stadsdelars shapefiler och slå ihop."""
    shp_files = glob.glob(os.path.join(LOD1_DIR, "*/Byggnad.shp"))
    print(f"  Hittade {len(shp_files)} stadsdelsfiler")

    gdfs = []
    for shp in sorted(shp_files):
        district = os.path.basename(os.path.dirname(shp)).replace("_StadsModell_shp", "")
        gdf = gpd.read_file(shp)
        gdf["district"] = district
        gdfs.append(gdf)
        print(f"    {district}: {len(gdf)} byggnader")

    merged = pd.concat(gdfs, ignore_index=True)
    merged = gpd.GeoDataFrame(merged, geometry="geometry", crs=gdfs[0].crs)
    return merged


def process_buildings(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Rensa och transformera byggnadsdata."""
    # Konvertera från EPSG:3011 till WGS84
    print(f"  Konverterar från {gdf.crs} till EPSG:4326...")
    gdf = gdf.to_crs(epsg=4326)

    # Behåll bara relevanta kolumner
    # BYGG_H = byggnadshöjd, MARK_Z = markhöjd (terräng), TAK_Z = absolut takhöjd
    cols_keep = ["BYGG_H", "MARK_Z", "TAK_Z", "GRUPP", "district", "geometry"]
    cols_available = [c for c in cols_keep if c in gdf.columns]
    gdf = gdf[cols_available].copy()

    # Filtrera bort byggnader utan höjd eller med orimliga värden
    gdf = gdf[gdf["BYGG_H"] > 1.0].copy()  # Minst 1m höjd
    gdf = gdf[gdf["BYGG_H"] < 200].copy()  # Max 200m

    # Konvertera 3D MultiPolygon till 2D (GeoJSON stöder inte alltid Z)
    gdf["geometry"] = gdf.geometry.map(
        lambda g: gpd.GeoSeries([g]).force_2d().iloc[0]
        if hasattr(gpd.GeoSeries, "force_2d")
        else g
    )

    print(f"  {len(gdf)} byggnader efter filtrering")
    print(f"  Höjd: min={gdf.BYGG_H.min():.1f}m, max={gdf.BYGG_H.max():.1f}m, median={gdf.BYGG_H.median():.1f}m")
    print(f"  Terräng (MARK_Z): min={gdf.MARK_Z.min():.1f}m, max={gdf.MARK_Z.max():.1f}m")

    return gdf


def main():
    os.makedirs(DATA_DIR, exist_ok=True)

    print("=== Steg 2: Ladda 3D-byggnader ===")

    download_buildings()
    gdf = load_and_merge_buildings()
    print(f"\nTotalt: {len(gdf)} byggnader i hela Stockholm")

    gdf = process_buildings(gdf)

    # Filtrera till enbart byggnader nära uteserveringar (spara tid i steg 3)
    venues_file = os.path.join(DATA_DIR, "venues.geojson")
    if os.path.exists(venues_file):
        print("\nFiltrerar byggnader till restaurangområden...")
        venues = gpd.read_file(venues_file)
        # Buffra varje restaurang med ~400m och ta union
        venues_4326 = venues.to_crs(epsg=4326) if venues.crs != "EPSG:4326" else venues
        buffer_deg = 0.004  # ~400m
        from shapely.ops import unary_union
        venue_area = unary_union(venues_4326.geometry.buffer(buffer_deg))
        gdf = gdf[gdf.intersects(venue_area)].copy()
        print(f"  {len(gdf)} byggnader inom 400m av restauranger")

    # Spara som GeoPackage (mycket snabbare att läsa än GeoJSON)
    print(f"\nSparar till {OUTPUT_FILE}...")
    gdf.to_file(OUTPUT_FILE, driver="GPKG")
    size_mb = os.path.getsize(OUTPUT_FILE) / 1024 / 1024
    print(f"Sparat! ({size_mb:.1f} MB)")


if __name__ == "__main__":
    main()
