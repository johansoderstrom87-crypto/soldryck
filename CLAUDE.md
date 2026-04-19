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
      Header.tsx       Väderkort + logotyp + filterdropdown (inkl. takbar-filter)
      SunMap.tsx        Leaflet-karta med markörer och popups
      TimeSlider.tsx    Tidsreglage (timme + månadsväljare)
    /data
      venues-computed.ts    Auto-genererad: 2 514 platser med soldata (~5.5 MB)
      venues-unconfirmed.ts Auto-genererad: 1 568 platser utan bekräftad uteservering
      mock-venues.ts        Testdata (8 platser, används som fallback)
    /lib
      weather.ts       SMHI API-integration (prognos + symbolkoder 1-27)
    page.tsx           Huvudsida — sammankopplar alla komponenter
    layout.tsx         HTML-layout med Leaflet CSS
    globals.css        Tailwind + marker-styles (sol/skugga/regn/grå)
  Dockerfile           Multi-stage Docker build (standalone Next.js)

/pipeline             Python-scripts som genererar soldata
  01_fetch_venues.py              Hämtar uteserveringar från OSM (utökad query)
  02_load_buildings.py            Laddar 3D-byggnader från Stockholm stad
  02b_adjust_venue_positions.py   Flyttar venues utanför byggnader
  02c_add_osm_buildings.py        Lägger till OSM-byggnader för suburbs (Solna etc.)
  02d_venue_elevation.py          Sätter höjddata för takbarer
  03_compute_shadows.py           Beräknar sol/skugga med ray-casting (~44 min, fullt)
  03b_compute_shadows_incremental.py  Räknar om bara nya venues (snabbt)
  04_export_frontend.py           Exporterar resultat till TypeScript
  05_generate_shadow_geojson.py   Genererar skugg-GeoJSON overlay
  06_compress_shadows.py          Komprimerar shadow-data för deploy
  07_verify_outdoor_seating.py    Verifierar uteservering via Google Places API
  08_merge_verified_venues.py     Slår ihop Google-verifierade venues med huvudlistan
  requirements.txt                Python-beroenden
  /data                           Genererad data (gitignored)
    /raw                          Nedladdade råfiler

/shadow-data          Komprimerade shadow GeoJSON-filer (187 st, ~445 MB)
                      Serveras via /api/shadows?key=MM-DD_HH
```

## Hur soldatan tas fram — steg för steg

### Steg 1: Hämta uteserveringar (`01_fetch_venues.py`)
- **Källa:** OpenStreetMap via Overpass API (gratis, ingen nyckel)
- **Query:** `amenity=restaurant|cafe|bar|pub|biergarten|fast_food|ice_cream|food_court` med:
  - `outdoor_seating` satt till något annat än no/none/0
  - `al_fresco=yes`
  - `amenity=biergarten` (implicit uteservering)
  - `leisure=outdoor_seating`
- **Bbox:** 59.23–59.44, 17.82–18.22 (Stockholms kommun)
- **Resultat:** ~969 OSM-bekräftade uteserveringar
- **Format:** GeoJSON → `data/venues.geojson`

### Steg 2: Ladda 3D-byggnader (`02_load_buildings.py`)
- **Källa:** Stockholm Dataportalen — SBK 3D-Byggnader LOD1 (generaliserade)
- **Kolumner:** `BYGG_H` (höjd i meter), `MARK_Z` (markhöjd), `TAK_Z` (takhöjd)
- **Data:** 77 760 byggnader i Stockholm stad
- **Format:** GeoPackage → `data/buildings.gpkg`

### Steg 2c: Lägg till OSM-byggnader (`02c_add_osm_buildings.py`)
- **Syfte:** Täcker suburbs utanför Stockholms stadsgräns (Solna, Sundbyberg, Lidingö etc.)
- **Källa:** Overpass API — byggnader med `building`-tagg inom venue-bboxar
- **Resultat:** 24 998 OSM-byggnader + 25 324 stadsdataportalen = **50 322 byggnader totalt**

### Steg 2d: Venue-höjddata (`02d_venue_elevation.py`)
- Sätter `venue_elevation_m` för kända takbarer baserat på kuraterad lista
- Används i skuggberäkningarna: takbarer på hög höjd skuggas inte av lägre byggnader

### Steg 3: Beräkna skuggor (`03_compute_shadows.py`)
- **Solpositioner:** Pysolar för 187 tidpunkter med sol (av 224 totalt) — 14 datum × 16 timmar
- **Datum:** 1:a och 15:e varje månad, april–oktober
- **Timmar:** 07:00–22:00 (CEST UTC+2)
- **Skuggberäkning (ray-casting):** convex hull av byggnad + projicerad skuggpolygon
- **Terrängkompensation:** `BYGG_H + max(0, byggnad_MARK_Z − venue_MARK_Z) − venue_elevation`
- **Tid:** ~44 minuter för alla 2 514 venues
- **Inkrementell variant:** `03b_compute_shadows_incremental.py` räknar bara venues som saknar data (används för manuellt tillagda venues t.ex. takbarer)

### Steg 4: Exportera till frontend (`04_export_frontend.py`)
- Konverterar `shadow_results.json` → `venues-computed.ts`
- Komprimerar statuskoder: `s`=sol, `d`=skugga, `p`=partial, `n`=natt
- Slår upp `level` från `venues.geojson` och sätter `rooftop: true` för takbarer:
  - OSM `level >= 6` räknas som takbar
  - Kuraterad namnlista täcker kända takbarer utan level-tagg
- **TypeScript:** exporteras som `as any as ComputedVenue[]` pga union type-begränsning
- **Interface:** `ComputedVenue` inkluderar optional `rooftop?: boolean`
- **Filstorlek:** ~5.5 MB (2 514 platser)

### Steg 5–6: Shadow overlay (`05_generate_shadow_geojson.py` + `06_compress_shadows.py`)
- Steg 5 genererar GeoJSON-skuggpolygoner per tidpunkt (1.1 GB rådata, ~3–4h)
- Steg 6 komprimerar med 0.0001 tolerans (~10m) → 445 MB i `shadow-data/`
- Serveras via `/api/shadows?key=MM-DD_HH`

### Steg 7: Verifiera uteservering (`07_verify_outdoor_seating.py`)
- **Källa:** Google Places API (New) — `searchText` endpoint
- **Fält:** `outdoorSeating` (boolean) — API-nyckel i miljövariabeln `GOOGLE_PLACES_API_KEY`
- **Resultat av senaste körning:** 3 115 obekräftade venues → 1 547 ja, 403 nej, 1 165 okänt
- Sparar till `data/outdoor_verification.json`, stödjer återupptagning

### Steg 8: Slå ihop verifierade venues (`08_merge_verified_venues.py`)
- Google-bekräftade (outdoorSeating=true) → läggs till `venues.geojson` med `source: "google_confirmed"`
- Google-nekade (false) → `venues-unconfirmed.ts` med `source: "google_denied"`
- Utan data → `venues-unconfirmed.ts` med `source: "unknown"`
- OSM-bekräftade taggas `source: "osm_confirmed"`

## Venue-täckning

| Källa | Antal | Visning |
|-------|-------|---------|
| OSM `outdoor_seating`-tagg | ~969 | Färgade markörer med soldata |
| Google Places bekräftad | ~1 531 | Färgade markörer med soldata |
| **Totalt med soldata** | **2 514** | |
| Google nekad (ingen uteservering) | 403 | Grå punkt zoom ≥ 17, popup "ingen uteservering" |
| Okänt (varken OSM eller Google) | 1 165 | Grå punkt zoom ≥ 17 |
| **Totalt i appen** | **~4 082** | |

## Takbar-filter

- 22 takbarer från [rooftopguiden.se](https://www.rooftopguiden.se/takbarer-i-stockholm.html)
- 14 av dessa lades till manuellt med koordinater och OSM `level`-data
- Höjd sätts till `level × 3m` för skuggberäkning (rooftop-venues skuggas inte av lägre byggnader)
- Detektering: OSM `level >= 6` ELLER match mot kuraterad namnlista i `04_export_frontend.py`

## Väderintegration

- **Källa:** SMHI SNOW1gv1 API
- **Endpoint:** `https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/18.07/lat/59.33/data.json`
- **Gratis, ingen API-nyckel**, timvis prognos ~10 dagar framåt
- **Caching:** 30 min i localStorage

## Frontend-arkitektur

- **Kartan:** Leaflet med CARTO light basemap, dynamiskt laddad (ssr: false)
- **Markörer (bekräftade):** DivIcon med CSS-klasser (marker-sun/shade/partial/rain), alltid renderade (~2 514 st)
- **Markörer (obekräftade):** Grå DivIcon, lazy-loadade — skapas bara vid zoom ≥ 17 och inom viewport
- **Popups:** Sol/skugga-tidslinje + bästa soltimme
- **Filter:** sol/skugga, venue-typ (restaurang/café/bar/takbar), soltidsintervall, t-banestation
- **Takbar-filter:** använder `venue.rooftop` boolean från venues-computed.ts
- **State:** Enkel React state — ingen global state manager

## Deploy

- **Frontend:** Railway via Dockerfile (multi-stage Node.js 20 Alpine, standalone Next.js output)
- **Domän:** `soldryck-web-production.up.railway.app`
- **Deploy-kommando:** `railway up` från projektrot
- **CI:** Manuell deploy (ingen auto-deploy från GitHub)

## Datakällor (alla gratis utom Google Places)

| Data | Källa | Licens |
|------|-------|--------|
| Uteserveringar (bekräftade) | OpenStreetMap Overpass API | ODbL |
| Uteservering-verifiering | Google Places API (New) | Kommersiell |
| 3D-byggnader (Stockholm) | Stockholm Dataportalen (SBK LOD1) | CC0 |
| 3D-byggnader (suburbs) | OpenStreetMap Overpass API | ODbL |
| Solpositioner | Pysolar (Python-bibliotek) | GPL |
| Väderprognos | SMHI SNOW1gv1 API | Öppna data |
| Baskarta | CARTO / OpenStreetMap | ODbL |

## Kör pipelinen (uppdatera data)

```bash
cd pipeline
pip install -r requirements.txt

# Full pipeline från grunden
python 01_fetch_venues.py                   # ~30s, hämtar från OSM
python 02_load_buildings.py                 # ~60s, laddar 3D-byggnader
python 02b_adjust_venue_positions.py        # ~30s, fixar koordinater
python 02c_add_osm_buildings.py             # ~30 min, suburbs-byggnader
python 02d_venue_elevation.py               # ~5s, takbar-höjddata
python 03_compute_shadows.py                # ~44 min, beräknar skuggor för alla
python 04_export_frontend.py                # ~2s, exporterar till frontend
python 05_generate_shadow_geojson.py        # ~3-4h, shadow overlay
python 06_compress_shadows.py               # ~20 min, komprimerar shadow-data
python 07_verify_outdoor_seating.py         # ~5h (env: GOOGLE_PLACES_API_KEY)
python 08_merge_verified_venues.py          # ~5s, slår ihop verifierade

# Om du bara lagt till nya venues (t.ex. takbarer):
python 03b_compute_shadows_incremental.py   # Räknar bara venues utan befintlig data
python 04_export_frontend.py
```

Behöver köras ca 1 gång/år — byggnader och terräng ändras sällan.

## Kända begränsningar

- **Träd** skuggar men finns inte i byggnadsdata
- **Markiser/parasoll** påverkar upplevd sol men är utanför scope
- **17 venues** sitter fortfarande inuti byggnadspolygoner (komplexa former)
- **LOD1 = platta tak** — takform ignoreras (minimal påverkan på markskugga)
- **Terrängmodell** kommer från `MARK_Z` i byggnadsdata — områden utan byggnader saknar terrängdata
- **Väderprognos** gäller hela Stockholm (en punkt), inte per venue
- **Manuellt tillagda venues** (takbarer) har inga OSM-bilder och saknar öppettider i Google Places-integreringen
