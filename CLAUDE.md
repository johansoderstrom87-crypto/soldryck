# Soldryck

Webapp som visar vilka uteserveringar i Stockholm som har sol — timme för timme, baserat på riktiga 3D-byggnadsmodeller och solpositionsberäkningar.

**Live:** https://soldryck-web-production.up.railway.app
**GitHub:** https://github.com/johansoderstrom87-crypto/soldryck
**Railway:** Projekt "pacific-friendship", service "soldryck-web"

## Projektstruktur

```
/frontend          Next.js 16 + Leaflet + Tailwind — kartan och UI:t
  /app
    /components
      Header.tsx       Väderkort + logotyp + filterdropdown
      SunMap.tsx        Leaflet-karta med markörer och popups
      TimeSlider.tsx    Tidsreglage (timme + månadsväljare)
      WeatherBar.tsx    Väderkomponent (används ej längre, inlinad i Header)
    /data
      venues-computed.ts   Auto-genererad: 724 platser med soldata (1.5 MB)
      mock-venues.ts       Testdata (8 platser, används som fallback)
    /lib
      weather.ts       SMHI API-integration (prognos + symbolkoder 1-27)
    page.tsx           Huvudsida — sammankopplar alla komponenter
    layout.tsx         HTML-layout med Leaflet CSS
    globals.css        Tailwind + marker-styles (sol/skugga/regn)
  Dockerfile           Multi-stage Docker build (standalone Next.js)

/pipeline             Python-scripts som genererar soldata
  01_fetch_venues.py         Hämtar uteserveringar från OSM
  02_load_buildings.py       Laddar 3D-byggnader från Stockholm stad
  02b_adjust_venue_positions.py  Flyttar venues utanför byggnader
  02_fetch_buildings.py      (äldre version, ersatt av 02_load_buildings.py)
  03_compute_shadows.py      Beräknar sol/skugga med ray-casting
  04_export_frontend.py      Exporterar resultat till TypeScript
  requirements.txt           Python-beroenden
  /data                      Genererad data (gitignored)
    /raw                     Nedladdade råfiler
```

## Hur soldatan tas fram — steg för steg

### Steg 1: Hämta uteserveringar (`01_fetch_venues.py`)
- **Källa:** OpenStreetMap via Overpass API (gratis, ingen nyckel)
- **Query:** Alla noder/ways med `amenity=restaurant|cafe|bar|pub` + `outdoor_seating=yes` inom Stockholms kommun (bbox 59.23-59.44, 17.82-18.22)
- **Resultat:** 724 uteserveringar med namn, typ, koordinater, adress
- **Format:** GeoJSON → `data/venues.geojson`
- **Retry-logik:** Provar overpass-api.de först, sedan kumi.systems som fallback

### Steg 2: Ladda 3D-byggnader (`02_load_buildings.py`)
- **Källa:** Stockholm Dataportalen — SBK 3D-Byggnader LOD1 (generaliserade)
- **URL:** `https://dataportalen.stockholm.se/.../LOD1_stadsdelsnamnder_SHP.zip` (17 MB, gratis, CC0)
- **Innehåll:** Shapefiler per stadsdel (13 st), koordinatsystem EPSG:3011
- **Kolumner:** `BYGG_H` (byggnadshöjd i meter), `MARK_Z` (markhöjd/terräng), `TAK_Z` (absolut takhöjd), `GRUPP` (byggnadstyp)
- **Data:** 77 760 byggnader totalt i hela Stockholm, laserskannande medianhöjd
- **Filtrering:** Bara byggnader inom 400m av en uteservering behålls → 17 683 byggnader
- **Konvertering:** EPSG:3011 → EPSG:4326 (WGS84), 3D → 2D geometri
- **Format:** GeoPackage → `data/buildings.gpkg` (22 MB, mycket snabbare att läsa än GeoJSON)

### Steg 2b: Justera venue-positioner (`02b_adjust_venue_positions.py`)
- **Problem:** 76% (550/724) av OSM-koordinater pekar inuti restaurangens byggnad, inte på uteserveringen
- **Lösning:** För varje venue som ligger inuti en byggnad:
  1. Hitta närmaste punkt på byggnadens kant
  2. Beräkna riktning utåt (från centroid genom kantpunkten)
  3. Flytta punkten 3m utanför kanten
  4. Om den hamnar i en annan byggnad → öka offset iterativt (5m, 8m, 12m)
- **Resultat:** 550 venues flyttade, 17 kvarstår inuti (komplexa polygoner)

### Steg 3: Beräkna skuggor (`03_compute_shadows.py`)
- **Solpositioner:** Pysolar-biblioteket beräknar solens azimut (kompassriktning) och elevation (höjd över horisont) för:
  - 14 datum: 1:a och 15:e varje månad, april–oktober
  - 16 timmar per dag: 07:00–22:00 (lokal tid, CEST UTC+2)
  - Totalt 224 unika solpositioner (samma för hela Stockholm, variation <0.01°)
- **Skuggberäkning (ray-casting):** För varje venue och tidpunkt:
  1. Hitta alla byggnader inom 300m (spatial index med R-tree)
  2. Exkludera byggnader inom 0.5m (den egna byggnaden)
  3. Beräkna effektiv byggnadshöjd: `BYGG_H + max(0, byggnad_MARK_Z - venue_MARK_Z)` (terrängkompensation — en byggnad på Södermalm som ligger 30m högre kastar längre skugga)
  4. Beräkna skugglängd: `höjd / tan(solens_elevation)` (max 500m)
  5. Projicera byggnadspolygon längs skuggriktningen (motsatt solens azimut)
  6. Skuggpolygon = convex hull av original + projicerad polygon
  7. Om venue-punkten ligger inuti skuggpolygonen → skugga
- **Resultat:** 162 176 datapunkter — 38.8% sol, 48.2% skugga, 12.9% natt
- **Tid:** ~44 minuter på vanlig dator

### Steg 4: Exportera till frontend (`04_export_frontend.py`)
- Konverterar `shadow_results.json` till TypeScript (`venues-computed.ts`)
- Komprimerar statuskoder: `s`=sol, `d`=skugga, `p`=partial, `n`=natt
- Filstorlek: 1.5 MB (alla 724 platser med scheman)
- Inkluderar hjälpfunktioner: `getClosestDateKey()`, `getVenueStatus()`, `getSunHours()`

## Väderintegration

- **Källa:** SMHI SNOW1gv1 API (ersatte PMP3gv2 i mars 2026)
- **Endpoint:** `https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/18.07/lat/59.33/data.json`
- **Gratis, ingen API-nyckel**, timvis prognos ~10 dagar framåt
- **Parametrar vi använder:** `symbol_code` (1-27 vädertyper), `air_temperature`, `wind_speed`, `precipitation_amount_mean`, `cloud_area_fraction`
- **Caching:** 30 min i localStorage
- **Kombinerad logik:** Skuggdata (statisk) + väder (live) → "Sol!", "Sol med moln", "Mulet", "Regn" etc.

## Frontend-arkitektur

- **Kartan:** Leaflet med CARTO light basemap, dynamiskt laddad (ssr: false)
- **Markörer:** DivIcon med CSS-klasser (marker-sun/shade/partial/rain), storlek varierar med status
- **Popups:** Dual timeline — sol/skugga-rad + väder-rad, timmarkering under sol/skugga
- **Tidsreglage:** Slider 07-22, månadsväljare (Apr-Okt), play-knapp som animerar
- **Header:** Kombinerat väderkort (ikon + temp + tidslinje) med "Soldryck" branding, collapsible filterdropdown
- **State:** Enkel React state (hour, date, filter, weather) — ingen global state manager

## Deploy

- **Frontend:** Railway via Dockerfile (multi-stage Node.js 20 Alpine, standalone Next.js output)
- **Domän:** `soldryck-web-production.up.railway.app`
- **Deploy-kommando:** `railway up` från projektrot
- **CI:** Manuell deploy (ingen auto-deploy från GitHub)

## Datakällor (alla gratis)

| Data | Källa | Licens |
|------|-------|--------|
| Uteserveringar | OpenStreetMap Overpass API | ODbL |
| 3D-byggnader | Stockholm Dataportalen (SBK LOD1) | CC0 |
| Solpositioner | Pysolar (Python-bibliotek) | GPL |
| Väderprognos | SMHI SNOW1gv1 API | Öppna data |
| Baskarta | CARTO / OpenStreetMap | ODbL |

## Kör pipelinen (uppdatera data)

```bash
cd pipeline
pip install -r requirements.txt

python 01_fetch_venues.py           # ~30s, hämtar från OSM
python 02_load_buildings.py         # ~60s, laddar 3D-byggnader
python 02b_adjust_venue_positions.py # ~30s, fixar koordinater
python 03_compute_shadows.py        # ~44 min, beräknar skuggor
python 04_export_frontend.py        # ~2s, exporterar till frontend
```

Behöver köras ca 1 gång/år — byggnader och terräng ändras sällan.

## Kända begränsningar

- **Träd** skuggar men finns inte i byggnadsdata
- **Markiser/parasoll** påverkar upplevd sol men är utanför scope
- **17 venues** sitter fortfarande inuti byggnadspolygoner (komplexa former)
- **LOD1 = platta tak** — takform ignoreras (minimal påverkan på markskugga)
- **Terrängmodell** kommer från `MARK_Z` i byggnadsdata, inte separat DEM — områden utan byggnader saknar terrängdata
- **Väderprognos** gäller hela Stockholm (en punkt), inte per venue
