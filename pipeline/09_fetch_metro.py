"""
Steg 9: Hämta tunnelbane-spår, perronger och uppgångar.

Källa: OpenStreetMap via Overpass API
- Spårlinjer: railway=subway, grupperade per linje (röd/grön/blå) via route=subway-relationer
- Perronger: railway=platform — reduceras till långaxel-streck (PCA på koordinaterna)
- Uppgångar: railway=subway_entrance — varje uppgång kopplas till sin närmsta perrong med en linje

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
  // Uppgångar — noder med tag railway=subway_entrance
  node["railway"="subway_entrance"]({BBOX});
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


def way_is_parallel_dup(way: list, others: list, threshold_m: float = 45) -> bool:
    """True om `way` är en parallell dubblett av någon way i `others`.

    Skyddar korta ways (< 5 noder) — de är ofta junction-connectorer och
    station-övergångar som inte ska tas bort, annars uppstår glapp i nätet."""
    if len(way) < 5:
        return False  # Connector-segment vid junctions/stationer — bevara alltid

    step = max(1, len(way) // 10)
    samples = way[::step]
    if len(samples) < 2:
        return False

    for other in others:
        hits = sum(
            1
            for pt in samples
            if min(haversine_m(pt[0], pt[1], p[0], p[1]) for p in other) < threshold_m
        )
        if hits >= max(2, len(samples) * 0.65):
            return True

    return False


def build_tracks(elements: list) -> dict:
    """Bygg spårdata per linjefärg.

    1. Samla alla ways som någon route-relation refererar till + deras färg
       (första route som ser way:n vinner — undviker färgkonflikter).
    2. Filtrera till railway=subway.
    3. Deduplicera parallella ways inom samma färg (catches Stockholm-tunnelbanans
       separata nord/syd-spår-mappning som annars renderas som dubbla linjer).
    4. Returnera per-way (ingen kedjesammanslagning — undviker zigzag-artefakter).
       Leaflet renderar ways som delar exakta endpoint-koordinater som en
       kontinuerlig linje, så det ser sammanhängande ut."""
    nodes_by_id: dict[int, tuple[float, float]] = {}
    ways_by_id: dict[int, dict] = {}
    relations: list[dict] = []

    for el in elements:
        if el["type"] == "node":
            nodes_by_id[el["id"]] = (el["lat"], el["lon"])
        elif el["type"] == "way":
            existing = ways_by_id.get(el["id"])
            if existing and existing.get("tags") and not el.get("tags"):
                continue
            ways_by_id[el["id"]] = el
        elif el["type"] == "relation":
            relations.append(el)

    # Bestäm färg per way_id via route-relationer (första vinner)
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
                way_colors.setdefault(member["ref"], color)

    # Materialisera ways per färg
    ways_by_color: dict[str, list] = defaultdict(list)
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
            ways_by_color[color].append(coords)

    # Deduplicera parallella ways per färg
    tracks_by_color: dict[str, list] = {}
    for color, ways in ways_by_color.items():
        # Sortera efter längd (flest noder) — längsta way:n vinner som
        # "kanonisk" representation av sektionen
        kept: list = []
        for way in sorted(ways, key=len, reverse=True):
            if not way_is_parallel_dup(way, kept):
                kept.append(way)
        tracks_by_color[color] = kept

    return tracks_by_color


def long_axis_line(coords: list) -> list:
    """Reducera en perronggeometri (öppen linje eller sluten polygon) till
    ett enda streck längs perrongens långaxel. Använder kovariansmatrisens
    största egenvektor (sluten form för 2x2)."""
    n = len(coords)
    if n < 2:
        return coords
    cx = sum(c[0] for c in coords) / n
    cy = sum(c[1] for c in coords) / n
    sxx = sum((c[0] - cx) ** 2 for c in coords) / n
    syy = sum((c[1] - cy) ** 2 for c in coords) / n
    sxy = sum((c[0] - cx) * (c[1] - cy) for c in coords) / n

    trace = sxx + syy
    det = sxx * syy - sxy ** 2
    disc = max(0.0, (trace / 2) ** 2 - det)
    lam1 = trace / 2 + disc ** 0.5  # största egenvärde

    if abs(sxy) > 1e-14:
        ex, ey = lam1 - syy, sxy
    elif sxx >= syy:
        ex, ey = 1.0, 0.0
    else:
        ex, ey = 0.0, 1.0
    norm = (ex ** 2 + ey ** 2) ** 0.5 or 1.0
    ex, ey = ex / norm, ey / norm

    projs = [(c[0] - cx) * ex + (c[1] - cy) * ey for c in coords]
    pmin, pmax = min(projs), max(projs)
    return [
        [round(cx + pmin * ex, 5), round(cy + pmin * ey, 5)],
        [round(cx + pmax * ex, 5), round(cy + pmax * ey, 5)],
    ]


def build_platforms(elements: list) -> list[dict]:
    """Hämta perronggeometrier och reducera till långaxellinjer."""
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

        raw_coords = []
        for nd in el.get("nodes", []):
            if nd in nodes_by_id:
                lat, lon = nodes_by_id[nd]
                raw_coords.append([lat, lon])
        if len(raw_coords) < 2:
            continue

        axis = long_axis_line(raw_coords)
        key = (axis[0][0], axis[0][1], axis[1][0], axis[1][1])
        if key in seen:
            continue
        seen.add(key)

        platforms.append({"name": tags.get("name", ""), "coordinates": axis})

    return platforms


def cluster_stations(platforms: list, threshold_m: float = 80) -> list[dict]:
    """Klustra perronger som tillhör samma station (T-Centralen har 3-4 perronger).

    Returnerar en station per kluster med geografiska ändpunkter för perrong-
    pillen — på det sättet skalas pillen med zoom precis som en riktig perrong
    skulle göra på en karta. Längden klampas till 100-180 m (en typisk
    Stockholm-tunnelbaneperrong är ~140 m)."""
    import math

    items = []
    for p in platforms:
        c = p["coordinates"]
        center = [(c[0][0] + c[1][0]) / 2, (c[0][1] + c[1][1]) / 2]
        length = haversine_m(c[0][0], c[0][1], c[1][0], c[1][1])
        items.append({"name": p.get("name", ""), "coords": c, "center": center, "length": length})

    used = [False] * len(items)
    stations = []
    cos_lat = math.cos(math.radians(59.33))

    for i in range(len(items)):
        if used[i]:
            continue
        cluster = [items[i]]
        used[i] = True
        for j in range(i + 1, len(items)):
            if used[j]:
                continue
            d = haversine_m(*items[i]["center"], *items[j]["center"])
            if d < threshold_m:
                cluster.append(items[j])
                used[j] = True

        # Centroid över alla perronger i klustret
        cy = sum(it["center"][0] for it in cluster) / len(cluster)
        cx = sum(it["center"][1] for it in cluster) / len(cluster)

        # Primär = längsta perrong → bestämmer riktning + namn
        primary = max(cluster, key=lambda it: it["length"])
        c = primary["coords"]

        # Riktningsvektor i lat/lng — normalisera över Mercator-skärmplan
        # (dx_screen = dlng × cos_lat, dy_screen = -dlat)
        dx_screen = (c[1][1] - c[0][1]) * cos_lat
        dy_screen = -(c[1][0] - c[0][0])
        norm_screen = (dx_screen ** 2 + dy_screen ** 2) ** 0.5 or 1.0
        unit_dx_screen = dx_screen / norm_screen
        unit_dy_screen = dy_screen / norm_screen

        stations.append(
            {
                "name": primary["name"],
                "lat": round(cy, 5),
                "lng": round(cx, 5),
            }
        )

    return stations


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    from math import radians, sin, cos, asin, sqrt

    R = 6371000.0
    p1, p2 = radians(lat1), radians(lat2)
    dp = radians(lat2 - lat1)
    dl = radians(lon2 - lon1)
    a = sin(dp / 2) ** 2 + cos(p1) * cos(p2) * sin(dl / 2) ** 2
    return 2 * R * asin(sqrt(a))


def closest_station(lat: float, lon: float, stations: list) -> tuple:
    """Hitta station närmast (lat, lon). Returnerar (dist_m, station-dict)."""
    best_dist = float("inf")
    best = None
    for s in stations:
        d = haversine_m(lat, lon, s["lat"], s["lng"])
        if d < best_dist:
            best_dist = d
            best = s
    return best_dist, best


def build_entrances(elements: list, stations: list) -> list[dict]:
    """Hämta uppgångar (railway=subway_entrance) och koppla varje till
    närmsta station inom 250 m. Connector-linjen går från stationscentrum
    till uppgången — visar tydligt vart man kommer ut."""
    entrances = []
    seen = set()
    for el in elements:
        if el["type"] != "node":
            continue
        tags = el.get("tags", {})
        if tags.get("railway") != "subway_entrance":
            continue

        lat, lon = el.get("lat"), el.get("lon")
        if lat is None or lon is None:
            continue
        key = (round(lat, 5), round(lon, 5))
        if key in seen:
            continue
        seen.add(key)

        dist, station = closest_station(lat, lon, stations)
        if not station or dist > 250:
            # Uppgångar utan station i närheten skippar vi — troligtvis fel-taggade
            continue

        entrances.append(
            {
                "lat": round(lat, 5),
                "lng": round(lon, 5),
                "name": tags.get("name", ""),
                "ref": tags.get("ref", ""),
                "link": [
                    [station["lat"], station["lng"]],
                    [round(lat, 5), round(lon, 5)],
                ],
            }
        )

    return entrances


def export_typescript(tracks: dict, stations: list, entrances: list, output_path: str) -> None:
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
        "  /** Anslutningslinje [stationscentrum, uppgångspunkt] — visar vart man kommer ut */",
        "  link: [[number, number], [number, number]];",
        "}",
        "",
        "export const METRO_TRACKS: MetroTrack[] = [",
    ]
    for color in ("red", "green", "blue"):
        for way in tracks.get(color, []):
            lines.append(f'  {{ color: "{color}", coords: {json.dumps(way)} }},')
    lines.append("];")
    lines.append("")
    lines.append("export const METRO_STATIONS: MetroStation[] = [")
    for s in stations:
        name_safe = s["name"].replace("\\", "\\\\").replace('"', '\\"')
        lines.append(f'  {{ lat: {s["lat"]}, lng: {s["lng"]}, name: "{name_safe}" }},')
    lines.append("];")
    lines.append("")
    lines.append("export const METRO_ENTRANCES: MetroEntrance[] = [")
    for ent in entrances:
        name_safe = ent["name"].replace("\\", "\\\\").replace('"', '\\"')
        lines.append(
            f'  {{ lat: {ent["lat"]}, lng: {ent["lng"]}, name: "{name_safe}", '
            f'link: {json.dumps(ent["link"])} }},'
        )
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
    stations = cluster_stations(platforms)
    entrances = build_entrances(elements, stations)

    print("\nSpårsegment per linje:")
    for color in ("red", "green", "blue"):
        ways = tracks.get(color, [])
        nodes = sum(len(w) for w in ways)
        print(f"  {color}: {len(ways)} segment ({nodes} noder)")
    print(f"\nStationer: {len(stations)} (klustrade från {len(platforms)} perronger)")
    print(f"Uppgångar: {len(entrances)} (kopplade till station inom 250 m)")

    export_typescript(tracks, stations, entrances, FRONTEND_OUT)
    print(f"\nExporterat till {FRONTEND_OUT}")


if __name__ == "__main__":
    main()
