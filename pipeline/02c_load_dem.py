"""
Steg 2c: Ladda ner och förbered höjdmodell (DEM) för Stockholm.

Källa: Copernicus GLO-30 Digital Elevation Model
- 30m upplösning, täcker hela världen
- Gratis och öppen data (CC-BY 4.0)
- Tiles: 1°×1° rutor i WGS84

Vi laddar ner de tiles som täcker Stockholmsregionen:
  N59 E017 (59-60°N, 17-18°E)
  N59 E018 (59-60°N, 18-19°E)

Resultat: data/dem_stockholm.tif (WGS84, 30m upplösning)

Används av 03_compute_shadows.py för terrängkompensation.
"""

import os
import urllib.request
import numpy as np

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
RAW_DIR = os.path.join(DATA_DIR, "raw")
OUTPUT_FILE = os.path.join(DATA_DIR, "dem_stockholm.tif")

# Copernicus GLO-30 på AWS S3 (offentlig bucket, ingen auth)
TILE_BASE = "https://copernicus-dem-30m.s3.amazonaws.com"

# Tiles som täcker Stockholm (59°N, 17-18°E)
TILES = [
    "Copernicus_DSM_COG_10_N59_00_E017_00_DEM",
    "Copernicus_DSM_COG_10_N59_00_E018_00_DEM",
]


def download_tile(tile_name: str, dest_path: str):
    """Ladda ner en DEM-tile från Copernicus S3."""
    url = f"{TILE_BASE}/{tile_name}/{tile_name}.tif"
    print(f"  Laddar ner {tile_name}...")
    try:
        urllib.request.urlretrieve(url, dest_path)
        size_mb = os.path.getsize(dest_path) / 1024 / 1024
        print(f"  Klar: {size_mb:.1f} MB")
        return True
    except Exception as e:
        print(f"  Fel: {e}")
        return False


def merge_tiles(tile_paths: list, output_path: str):
    """Slå samman tiles till en GeoTIFF med rasterio."""
    import rasterio
    from rasterio.merge import merge

    datasets = [rasterio.open(p) for p in tile_paths]
    mosaic, transform = merge(datasets)

    meta = datasets[0].meta.copy()
    meta.update({
        "driver": "GTiff",
        "height": mosaic.shape[1],
        "width": mosaic.shape[2],
        "transform": transform,
        "compress": "lzw",
    })

    with rasterio.open(output_path, "w", **meta) as dest:
        dest.write(mosaic)

    for ds in datasets:
        ds.close()


def load_dem():
    print("=== Steg 2c: Laddar höjdmodell (DEM) ===")

    try:
        import rasterio
    except ImportError:
        print("Fel: rasterio är inte installerat.")
        print("Kör: pip install rasterio")
        return False

    os.makedirs(RAW_DIR, exist_ok=True)

    # Ladda ner tiles om de saknas
    tile_paths = []
    for tile_name in TILES:
        tile_path = os.path.join(RAW_DIR, f"{tile_name}.tif")
        tile_paths.append(tile_path)
        if os.path.exists(tile_path):
            size_mb = os.path.getsize(tile_path) / 1024 / 1024
            print(f"  {tile_name} finns redan ({size_mb:.1f} MB)")
        else:
            if not download_tile(tile_name, tile_path):
                print(f"Kunde inte ladda ner {tile_name}")
                return False

    # Slå samman till en fil
    print(f"Slår samman {len(tile_paths)} tiles...")
    merge_tiles(tile_paths, OUTPUT_FILE)
    size_mb = os.path.getsize(OUTPUT_FILE) / 1024 / 1024
    print(f"DEM sparat: {OUTPUT_FILE} ({size_mb:.1f} MB)")

    # Statistik
    with rasterio.open(OUTPUT_FILE) as src:
        data = src.read(1)
        valid = data[data != src.nodata] if src.nodata else data.flatten()
        print(f"Höjdintervall: {valid.min():.0f}–{valid.max():.0f} m")
        print(f"Upplösning: {src.res[0]*111320:.0f} m × {src.res[1]*111320:.0f} m")
        print(f"Täcker: {src.bounds}")

    return True


if __name__ == "__main__":
    load_dem()
