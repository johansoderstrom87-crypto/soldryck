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


def chain_is_parallel_to(chain: list, other: list, threshold_m: float = 40) -> bool:
    """True om kedjan löper parallellt med other: minst 70% av samplade
    punkter i chain ligger inom threshold_m från närmaste punkt på other."""
    step = max(1, len(chain) // 10)
    samples = chain[::step]
    hits = sum(
        1 for pt in samples
        if min(haversine_m(pt[0], pt[1], p[0], p[1]) for p in other) < threshold_m
    )
    return hits >= max(1, len(samples) * 0.70)


def dedup_parallel_chains(chains: list) -> list:
    """Deduplicera parallella kedjor EFTER sammanslaget — längre kedjor ger
    mer tillförlitlig jämförelse än de korta råsegmenten."""
    kept = []
    for chain in sorted(chains, key=len, reverse=True):  # längsta vinner
        if not any(chain_is_parallel_to(chain, k) for k in kept):
            kept.append(chain)
    return kept


def _alignment(v1: list, v2: list) -> float:
    """Cosinuslikhet mellan två 2D-vektorer (-1..1, 1=samma riktning)."""
    n1 = (v1[0] ** 2 + v1[1] ** 2) ** 0.5
    n2 = (v2[0] ** 2 + v2[1] ** 2) ** 0.5
    if n1 == 0 or n2 == 0:
        return 0.0
    return (v1[0] * v2[0] + v1[1] * v2[1]) / (n1 * n2)


def merge_chains(ways: list) -> list:
    """Slå ihop angränsande ways (delar endpoints) till färre, längre kedjor.

    Vid junctions (>1 kandidat) väljer vi den mest linjeriktade fortsättningen
    via cos-likhet med kedjans utgående riktning. Det undviker zigzag-mönster
    där algoritmen hoppar in på en gren och sen tillbaka."""
    from collections import defaultdict as _dd

    endpoint_idx: dict[tuple, list[int]] = _dd(list)
    for i, w in enumerate(ways):
        endpoint_idx[tuple(w[0])].append(i)
        endpoint_idx[tuple(w[-1])].append(i)

    used = [False] * len(ways)
    chains = []

    def pick_aligned(cur_dir: list, candidates: list, tip: tuple, going_forward: bool) -> int:
        """Välj kandidaten som matchar bäst med kedjans riktning."""
        best, best_score = candidates[0], -2.0
        for c in candidates:
            seg = ways[c]
            # Riktningsvektor som lämnar tip in i segmentet
            if going_forward:
                seg_dir = (
                    [seg[1][0] - seg[0][0], seg[1][1] - seg[0][1]]
                    if tuple(seg[0]) == tip
                    else [seg[-2][0] - seg[-1][0], seg[-2][1] - seg[-1][1]]
                )
            else:
                # Vid bakåt-extension är cur_dir riktad UT från kedjans start,
                # och vi vill ha segmentriktning UT från tip på samma sätt
                seg_dir = (
                    [seg[1][0] - seg[0][0], seg[1][1] - seg[0][1]]
                    if tuple(seg[0]) == tip
                    else [seg[-2][0] - seg[-1][0], seg[-2][1] - seg[-1][1]]
                )
            score = _alignment(cur_dir, seg_dir)
            if score > best_score:
                best_score, best = score, c
        return best

    for start in range(len(ways)):
        if used[start]:
            continue
        chain = list(ways[start])
        used[start] = True

        # Förläng framåt — riktning vid kedjans slut: chain[-2] → chain[-1]
        while True:
            tip = tuple(chain[-1])
            cands = [i for i in endpoint_idx[tip] if not used[i]]
            if not cands:
                break
            cur_dir = [chain[-1][0] - chain[-2][0], chain[-1][1] - chain[-2][1]]
            nxt = pick_aligned(cur_dir, cands, tip, going_forward=True)
            used[nxt] = True
            seg = ways[nxt]
            chain += seg[1:] if tuple(seg[0]) == tip else list(reversed(seg))[1:]

        # Förläng bakåt — riktning vid kedjans start: chain[1] → chain[0] (utåt)
        while True:
            tip = tuple(chain[0])
            cands = [i for i in endpoint_idx[tip] if not used[i]]
            if not cands:
                break
            cur_dir = [chain[0][0] - chain[1][0], chain[0][1] - chain[1][1]]
            nxt = pick_aligned(cur_dir, cands, tip, going_forward=False)
            used[nxt] = True
            seg = ways[nxt]
            prefix = list(reversed(seg))[:-1] if tuple(seg[-1]) == tip else seg[:-1]
            chain = prefix + chain

        chains.append(chain)

    return chains


def build_tracks(elements: list) -> dict:
    """Gruppera subway-ways per linjefärg, deduplicera dubbelspår och slå ihop till kedjor."""
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

    raw_by_color: dict[str, list] = defaultdict(list)
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
            raw_by_color[color].append(coords)

    tracks_by_color: dict[str, list] = {}
    for color, ways in raw_by_color.items():
        merged = merge_chains(ways)               # slå ihop korta råsegment till långa kedjor
        deduped = dedup_parallel_chains(merged)   # deduplicera parallella kedjor (tunnelrör etc.)
        tracks_by_color[color] = deduped

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
    """Klustra perronger som tillhör samma station — flera perronger nära
    varandra (T-Centralen har t.ex. 3-4 perronger) blir en station-pill.

    Returnerar en station per kluster med:
    - lat, lng: centroiden
    - angle: rotation i grader (CSS-kompatibel) längs primär perrongaxel
    - len_m: längd på pillen (klampad till rimligt intervall)
    - name: namn från längsta perrongen i klustret
    """
    import math

    items = []
    for p in platforms:
        c = p["coordinates"]
        center = [(c[0][0] + c[1][0]) / 2, (c[0][1] + c[1][1]) / 2]
        length = haversine_m(c[0][0], c[0][1], c[1][0], c[1][1])
        items.append({"name": p.get("name", ""), "coords": c, "center": center, "length": length})

    used = [False] * len(items)
    stations = []
    cos_lat = math.cos(math.radians(59.33))  # Mercator-justering för Stockholm

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
        # CSS rotation: 0° = horisontell (öster), positiv vinkel = medurs
        # På Mercator är dx i pixlar = dlng × cos(lat). Skärmens y går nedåt
        # medan latitud ökar uppåt → invertera lat-deltat för screen-vinkel.
        dx_screen = (c[1][1] - c[0][1]) * cos_lat
        dy_screen = -(c[1][0] - c[0][0])
        angle_deg = math.degrees(math.atan2(dy_screen, dx_screen))
        # Pillen är symmetrisk → modulo 180° räcker för rotation
        if angle_deg > 90:
            angle_deg -= 180
        elif angle_deg < -90:
            angle_deg += 180

        # Klamp pill-längd till rimligt visuellt intervall (px sätts i frontend
        # baserat på meter-distans + zoomnivå)
        length_m = max(60, min(180, primary["length"]))

        stations.append(
            {
                "name": primary["name"],
                "lat": round(cy, 5),
                "lng": round(cx, 5),
                "angle": round(angle_deg, 1),
                "len_m": round(length_m, 1),
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
        "  /** CSS-rotationsvinkel i grader längs perrongens långaxel */",
        "  angle: number;",
        "  /** Perronglängd i meter — frontend skalar pillen efter zoom */",
        "  lenM: number;",
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
        lines.append(
            f'  {{ lat: {s["lat"]}, lng: {s["lng"]}, name: "{name_safe}", '
            f'angle: {s["angle"]}, lenM: {s["len_m"]} }},'
        )
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
