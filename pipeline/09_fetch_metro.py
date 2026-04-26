"""
Steg 9: Hämta tunnelbane-spår och perronger.

Källa: OpenStreetMap via Overpass API
- Spårlinjer: railway=subway, grupperade per linje (röd/grön/blå) via route=subway-relationer
- Perronger: railway=platform inom tunnelbane-nätverk

Resultat:
- frontend/app/data/metro-network.ts (TypeScript export)
"""

import json
import os
import time
import urllib.parse
import urllib.request
from collections import defaultdict

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
RAW_DIR = os.path.join(DATA_DIR, "raw")
FRONTEND_OUT = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "frontend", "app", "data", "metro-network.ts")
)

# Bbox: Stockholms tunnelbana sträcker sig längre än vår venue-bbox (Hjulsta i NV, Norsborg i SV)
BBOX = "59.18,17.75,59.45,18.25"

# Linjenummer → färg (T-prefix kan saknas i OSM)
LINE_REF_COLOR = {
    "10": "blue", "11": "blue",
    "13": "red", "14": "red",
    "17": "green", "18": "green", "19": "green",
}


def color_from_hex(hex_str: str) -> str | None:
    """Bestäm linjefärg från OSM colour-tagg (varierar mellan olika varianter)."""
    if not hex_str:
        return None
    s = hex_str.lower().lstrip("#")
    # Stockholm SL-färger varierar — matcha de vanligaste
    if s.startswith(("00", "10", "20")) and ("65bd" in s or "8cd" in s or "5a8" in s or s in ("0019a8", "0019a9")):
        return "blue"
    if s.startswith(("d7", "e3", "ff", "e1")) and any(c in s for c in ("1920", "000b", "0000", "171f", "0019")):
        return "red"
    if s.startswith(("00", "0c", "0a")) and any(c in s for c in ("8064", "a14e", "9b58", "a050")):
        return "green"
    # Fallback — grova RGB-områden
    try:
        r, g, b = int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16)
        if b > 120 and b > r and b > g:
            return "blue"
        if r > 150 and r > g + 60 and r > b + 60:
            return "red"
        if g > 100 and g > r + 30 and g > b - 30:
            return "green"
    except (ValueError, IndexError):
        pass
    return None


OVERPASS_QUERY = f"""[out:json][timeout:300];
(
  // Subway-rutter (T10–T19) — använder SL-nätverket
  rel["route"="subway"]["network"~"Stockholm|SL|tunnelbana",i]({BBOX});
  // Alla subway-spår (även de som ev. saknar relation)
  way["railway"="subway"]({BBOX});
  // Perronger — bägge taggningskonventioner
  way["railway"="platform"]({BBOX});
  way["public_transport"="platform"]["subway"="yes"]({BBOX});
);
out body;
>;
out skel qt;"""

OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]


def fetch_overpass(query: str, max_retries: int = 3) -> dict:
    data = urllib.parse.urlencode({"data": query}).encode("utf-8")
    for attempt in range(max_retries):
        for url in OVERPASS_URLS:
            try:
                print(f"  Försöker {url} (försök {attempt + 1})...")
                req = urllib.request.Request(
                    url,
                    data=data,
                    headers={"User-Agent": "Soldryck/1.0 (sun-tracker)"},
                )
                resp = urllib.request.urlopen(req, timeout=300)
                return json.loads(resp.read().decode("utf-8"))
            except Exception as e:
                print(f"  Misslyckades: {e}")
                time.sleep(5)
    raise RuntimeError("Kunde inte nå Overpass API efter alla försök")


def build_tracks(elements: list) -> dict:
    """Gruppera subway-ways per linjefärg via route-relationer."""
    nodes_by_id: dict[int, tuple[float, float]] = {}
    ways_by_id: dict[int, dict] = {}
    relations: list[dict] = []

    for el in elements:
        if el["type"] == "node":
            nodes_by_id[el["id"]] = (el["lat"], el["lon"])
        elif el["type"] == "way":
            # Overpass `>; out skel qt;` recurses to add untagged skeleton copies of relation
            # member ways alongside the directly-fetched tagged ways. Always keep the tagged copy.
            existing = ways_by_id.get(el["id"])
            if existing and existing.get("tags") and not el.get("tags"):
                continue
            ways_by_id[el["id"]] = el
        elif el["type"] == "relation":
            relations.append(el)

    # Bestäm färg per way från relationerna
    way_colors: dict[int, str] = {}
    for rel in relations:
        tags = rel.get("tags", {})
        if tags.get("route") != "subway":
            continue
        ref = tags.get("ref", "").lstrip("Tt").strip()
        color = LINE_REF_COLOR.get(ref) or color_from_hex(tags.get("colour", ""))
        if not color:
            continue
        for member in rel.get("members", []):
            if member.get("type") == "way":
                # Första matchningen vinner — undviker duplicering på delade segment
                way_colors.setdefault(member["ref"], color)

    tracks_by_color: dict[str, list[list[list[float]]]] = defaultdict(list)
    for way_id, way in ways_by_id.items():
        if way.get("tags", {}).get("railway") != "subway":
            continue
        color = way_colors.get(way_id)
        if not color:
            continue
        coords = []
        for nd in way.get("nodes", []):
            if nd in nodes_by_id:
                lat, lon = nodes_by_id[nd]
                coords.append([round(lat, 5), round(lon, 5)])
        if len(coords) >= 2:
            tracks_by_color[color].append(coords)

    return tracks_by_color


def build_platforms(elements: list) -> list[dict]:
    """Hämta perronggeometrier (linjer, inte areor — vi vill ha streck på kartan)."""
    nodes_by_id = {el["id"]: (el["lat"], el["lon"]) for el in elements if el["type"] == "node"}

    platforms = []
    seen = set()
    for el in elements:
        if el["type"] != "way":
            continue
        tags = el.get("tags", {})
        is_metro_platform = (
            tags.get("railway") == "platform"
            and (tags.get("subway") == "yes" or tags.get("station") == "subway" or "tunnelbana" in tags.get("name", "").lower())
        ) or (
            tags.get("public_transport") == "platform" and tags.get("subway") == "yes"
        )
        if not is_metro_platform:
            continue
        # Skippa pendeltåg/spårväg
        if tags.get("train") == "yes" and tags.get("subway") != "yes":
            continue
        if tags.get("tram") == "yes" and tags.get("subway") != "yes":
            continue

        coords = []
        for nd in el.get("nodes", []):
            if nd in nodes_by_id:
                lat, lon = nodes_by_id[nd]
                coords.append([round(lat, 5), round(lon, 5)])
        if len(coords) < 2:
            continue

        key = (coords[0][0], coords[0][1], coords[-1][0], coords[-1][1])
        if key in seen:
            continue
        seen.add(key)

        platforms.append({"name": tags.get("name", ""), "coordinates": coords})

    return platforms


def export_typescript(tracks: dict, platforms: list, output_path: str) -> None:
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
        "export interface MetroPlatform {",
        "  coords: [number, number][];",
        "}",
        "",
        "export const METRO_TRACKS: MetroTrack[] = [",
    ]
    for color in ("red", "green", "blue"):
        for way in tracks.get(color, []):
            lines.append(f'  {{ color: "{color}", coords: {json.dumps(way)} }},')
    lines.append("];")
    lines.append("")
    lines.append("export const METRO_PLATFORMS: MetroPlatform[] = [")
    for plat in platforms:
        lines.append(f'  {{ coords: {json.dumps(plat["coordinates"])} }},')
    lines.append("];")
    lines.append("")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(RAW_DIR, exist_ok=True)

    print("=== Steg 9: Hämta tunnelbane-data ===")
    print(f"Område: {BBOX}")

    raw_file = os.path.join(RAW_DIR, "osm_metro.json")
    if os.path.exists(raw_file):
        print(f"Använder cachad data: {raw_file}")
        with open(raw_file, "r", encoding="utf-8") as f:
            data = json.load(f)
    else:
        data = fetch_overpass(OVERPASS_QUERY)
        with open(raw_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
        print(f"Rådata sparad: {raw_file}")

    elements = data.get("elements", [])
    print(f"Hittade {len(elements)} element från OSM")

    tracks = build_tracks(elements)
    platforms = build_platforms(elements)

    print("\nSpårsegment per linje:")
    for color in ("red", "green", "blue"):
        ways = tracks.get(color, [])
        nodes = sum(len(w) for w in ways)
        print(f"  {color}: {len(ways)} segment ({nodes} noder)")
    print(f"\nPerronger: {len(platforms)}")

    export_typescript(tracks, platforms, FRONTEND_OUT)
    print(f"\nExporterat till {FRONTEND_OUT}")


if __name__ == "__main__":
    main()
