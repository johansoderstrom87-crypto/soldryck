# Soldryck

Webapp som visar vilka uteserveringar i Stockholm som har sol — timme för timme, baserat på riktiga 3D-byggnadsmodeller och solpositionsberäkningar.

**Live:** https://soldryck.se
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
      venues-computed.ts    Auto-genererad: ~2 843 platser med soldata (~6.2 MB)
      venues-unconfirmed.ts Auto-genererad: ~1 733 platser utan bekräftad uteservering
      metro-network.ts      Auto-genererad: tunnelbanespår + perronger (~144 KB)
      mock-venues.ts        Testdata (8 platser, används som fallback)
    /lib
      weather.ts       SMHI API-integration (prognos + symbolkoder 1-27)
    /api
      shadows/route.ts Servar shadow-data, läser från SHADOW_DATA_PATH (volym i prod)
    page.tsx           Huvudsida — sammankopplar alla komponenter
    layout.tsx         HTML-layout med Leaflet CSS
    globals.css        Tailwind + marker-styles (sol/skugga/regn/grå)
  /scripts
    seed-shadow-data.mjs  Hämtar shadow-data från GitHub vid container-start
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
  09_fetch_metro.py               Hämtar tunnelbanespår + perronger från OSM
  10_fetch_osm_dietary.py         Hämtar OSM dog=* + diet:gluten_free=* taggar
  11_backfill_dog_gluten.py       Backfillar Google allowsDogs + reviews för glutenfri-scan
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

### Steg 7b: Dubbelkolla outdoor_seating=no via Google (`07b_verify_negative_seating.py`)
- **Bakgrund:** Vissa OSM-bidragsgivare har bulk-taggat venues som `outdoor_seating=no` fast de faktiskt har uteservering. Steg 1 exkluderar dessa, och steg 7 missar dem (behandlar bara `<MISSING>`-venues).
- **Hämtar:** Alla OSM-venues taggade `outdoor_seating=no/none/0` i bboxen via Overpass (~292 st), cachar i `data/raw/osm_outdoor_no.json`
- **Verifierar:** Google `searchText` per venue, samma fält som steg 7
- **Resultat av senaste körning:** 292 venues → **125 ja (override OSM)**, 71 nej, 96 okänt
- Sparar till `data/outdoor_verification_negative.json`, stödjer återupptagning

### Steg 8: Slå ihop verifierade venues (`08_merge_verified_venues.py`)
- Google-bekräftade (outdoorSeating=true) → läggs till `venues.geojson` med `source: "google_confirmed"`
- **OSM=no men Google=yes** → läggs till med `source: "osm_no_google_yes"` (override)
- Google-nekade (false) → `venues-unconfirmed.ts` med `source: "google_denied"`
- Utan data → `venues-unconfirmed.ts` med `source: "unknown"`
- OSM-bekräftade taggas `source: "osm_confirmed"`
- **Läser både** `outdoor_verification.json` och `outdoor_verification_negative.json`

### Steg 9: Tunnelbanenät (`09_fetch_metro.py`)
- **Källa:** OpenStreetMap via Overpass API
- **Spårlinjer:** `railway=subway` ways, grupperade per linjefärg via `route=subway`-relationer (T10/T11=blå, T13/T14=röd, T17/T18/T19=grön)
- **Perronger:** `railway=platform` + `public_transport=platform`+`subway=yes`
- **Resultat:** ~519 spårsegment, 57 perronger (~144 KB)
- **Output:** `frontend/app/data/metro-network.ts` (TypeScript export, statisk data)
- **Toggle:** Visas via "Tunnelbana"-toggle i Header — av som default

### Steg 10: OSM dietary/pet-tags (`10_fetch_osm_dietary.py`)
- **Källa:** OpenStreetMap via Overpass API (gratis)
- **Hämtar:** `dog=*` och `diet:gluten_free=*` för alla amenity-typer + `leisure=outdoor_seating` inom Stockholm-bboxen
- **Output:** `data/osm_dietary_tags.json` — schema `{osm_id: {dog?, gluten_free?}}`
- **Användning:** Konsumeras av steg 04 för att sätta `dogFriendly` resp. `glutenFree` på venues. OSM-täckning är tunn (~5–10%) men gratis och tillförlitlig där den finns.

### Steg 11: Google backfill — allowsDogs + reviews (`11_backfill_dog_gluten.py`)
- **Källa:** Google Places API (New) — Place Details by `place_id` (cheapare än Text Search-anropet i steg 07)
- **Fält:** `allowsDogs` + `reviews` (Atmosphere-tier ≈ $0.030/anrop, ~$75 för full backfill)
- **Glutenfri-detektion:** Räknar reviews som matchar regex `glutenfri(tt|a)?` eller `gluten[\s-]?free` (case-insensitive). ≥2 träffar → `glutenFree: true` i steg 04.
- **Flaggor:** `--no-reviews` (bara `allowsDogs`, ~$42), `--dry-run` (rapportera utan att kalla API)
- **Resumable** — sparar inkrementellt i `data/dog_gluten_backfill.json`
- **När köras:** En gång efter steg 07 är klart. Inte automatiskt i full pipeline pga kostnad — kör manuellt när du vill backfilla.

## Venue-täckning

| Källa | Antal | Visning |
|-------|-------|---------|
| OSM `outdoor_seating`-tagg | ~969 | Färgade markörer med soldata |
| Google Places bekräftad (utan OSM-tagg) | ~1 531 | Färgade markörer med soldata |
| OSM=no men Google=yes (override) | 125 | Färgade markörer med soldata |
| **Totalt med soldata** | **~2 843** | |
| Google nekad (ingen uteservering) | 474 | Grå punkt zoom ≥ 17, popup "ingen uteservering" |
| Okänt (varken OSM eller Google) | 1 259 | Grå punkt zoom ≥ 17 |
| **Totalt i appen** | **~4 576** | |

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
- **Markörer (bekräftade):** DivIcon med CSS-klasser (marker-sun/shade/partial/rain), alltid renderade (~2 843 st)
- **Markörer (obekräftade):** Grå DivIcon, lazy-loadade — skapas bara vid zoom ≥ 17 och inom viewport
- **Popups:** Sol/skugga-tidslinje + bästa soltimme
- **Filter:** sol/skugga, venue-typ (restaurang/café/bar/takbar), soltidsintervall, t-banestation
- **Takbar-filter:** använder `venue.rooftop` boolean från venues-computed.ts
- **State:** Enkel React state — ingen global state manager

## Deploy

- **Frontend:** Railway via Dockerfile (multi-stage Node.js 20 Alpine, standalone Next.js output)
- **Domän:** `soldryck.se` (custom domain på Railway, pekar på samma service som `soldryck-web-production.up.railway.app`)
- **CI:** Auto-deploy från GitHub master-push (konfigurerat i Railway-serviceinställningarna — Deployments-tabben visar "via GitHub" för senaste deploy)
- **Manuell deploy** (om GitHub-kopplingen skulle gå sönder): `railway up --service soldryck-web` från projektrot
- **Image-storlek:** ~50 MB (shadow-data exkluderat — se nedan)

### Shadow-data via Railway Volume

Shadow-data (~132 MB komprimerat, 187 filer) bundlas **inte** med image. Istället:

- **Volym:** `soldryck-web-volume` mountad på `/app/shadow-data` (5 GB tilldelat)
- **Env-variabel:** `SHADOW_DATA_PATH=/app/shadow-data` (sätts i Dockerfile)
- **Bootstrap:** `frontend/scripts/seed-shadow-data.mjs` körs vid container-start. Om volymen är tom hämtar den alla 187 `.json.gz`-filer från GitHub raw URLs (~6 sek). Idempotent — gör inget om filerna redan finns.
- **Re-seed efter pipeline-uppdatering:**
  - `railway run --service soldryck-web -- node scripts/seed-shadow-data.mjs --force` (laddar ner allt på nytt)
  - eller sätt env-variabel `RESEED_SHADOW_DATA=1` på en deploy → reset till noll efteråt
- **Ignore:** `shadow-data/` finns i både `.dockerignore` och `.railwayignore`

### Skapa volymen från grunden (om den måste återskapas)

```bash
MSYS_NO_PATHCONV=1 railway volume add -m /app/shadow-data
# (välj soldryck-web service interaktivt om du har flera)
```

Vid nästa deploy seedas filerna automatiskt från GitHub.

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
| Tunnelbanespår + perronger | OpenStreetMap Overpass API | ODbL |

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
python 07b_verify_negative_seating.py       # ~30s, dubbelkollar OSM-no via Google
python 08_merge_verified_venues.py          # ~5s, slår ihop verifierade
python 09_fetch_metro.py                    # ~30s, tunnelbanespår + perronger
python 10_fetch_osm_dietary.py              # ~10s, OSM dog/glutenfri-taggar
python 11_backfill_dog_gluten.py            # ~5h, Google reviews (~$75) — kör manuellt vid behov

# Om du bara lagt till nya venues (t.ex. takbarer):
python 03b_compute_shadows_incremental.py   # Räknar bara venues utan befintlig data
python 04_export_frontend.py
```

Behöver köras ca 1 gång/år — byggnader och terräng ändras sällan.

## Hund/Glutenfri — paused (2026-05)

**Status:** Hela infrastrukturen är byggd och commitad men UI-knapparna är dolda bakom feature-flaggan `DOG_GLUTEN_FILTERS_ENABLED = false` i [Header.tsx](frontend/app/components/Header.tsx). Anledningen är att vi inte kunde köra Google-backfillen (steg 11) inom Google Cloud-trialens kvarvarande 322 kr.

### Vad som är gjort
- **Pipeline:** Steg 07 sparar nu `allows_dogs`. Steg 10 (`10_fetch_osm_dietary.py`) drar OSM dog/glutenfri-taggar gratis via Overpass. Steg 11 (`11_backfill_dog_gluten.py`) finns redo med `--no-reviews`/`--dry-run`-flaggor men har inte körts.
- **Steg 04** läser båda källorna och emitterar `dogFriendly` / `glutenFree` på venues.
- **Frontend:** `ComputedVenue.dogFriendly?`/`glutenFree?` typer, filterlogik i `passesStaticFilters` (SunMap.tsx), state + props-wiring i page.tsx → Header.tsx, två toggles i settings-dropdownen (wrappade i flaggan).

### Nuvarande data (efter steg 10 körd)
- **Hundvänlig:** 1 venue av 2 844 (bara OSM)
- **Glutenfri:** 18 venues av 2 844 (bara OSM)

Det räcker inte för att aktivera filtren — för få träffar gör dem missvisande snarare än hjälpsamma.

### Vad som blockerar
Steg 11 backfill mot Google Places API (New) Place Details:
- 3 401 venues har `google_id` (från steg 07 + 07b)
- Full backfill (allowsDogs + reviews): ~$102 / ~1 071 kr
- Bara hundvänlig (`--no-reviews`): ~$58 / ~609 kr
- Trial-krediten räcker till ~$29 = restaurant-only `--no-reviews` (1 700 anrop)

### Plan för att återuppta
1. **När:** Efter Google Cloud-trial:n löper ut (kvar 54 dagar per 2026-05-23, dvs runt 2026-07-16). Då uppgraderas billing-kontot och Maps Platform free tier (~$200/månad i krediter) aktiveras.
2. **Hur:** Kör `python 11_backfill_dog_gluten.py` (full) eller `--no-reviews` om man bara vill ha hund.
3. **Återaktivera UI:** Flippa `DOG_GLUTEN_FILTERS_ENABLED = true` i [Header.tsx](frontend/app/components/Header.tsx). Allt övrigt är redan på plats.
4. **Verifiera:** Räknarna i steg 04:s slutprint bör visa minst några hundra hundvänliga + glutenfria innan UI:t släpps på.

### Möjligt mellanläge
Bar+pub+biergarten med reviews kostar bara ~$7 / 76 kr och ryms i trial-krediten. Det skulle ge ~240 venues med både hund + glutenfri-data — för smalt för att aktivera filtren på hela appen men användbart som proof-of-concept. Inte gjort än.

## Kända begränsningar

- **Träd** skuggar men finns inte i byggnadsdata
- **Markiser/parasoll** påverkar upplevd sol men är utanför scope
- **17 venues** sitter fortfarande inuti byggnadspolygoner (komplexa former)
- **LOD1 = platta tak** — takform ignoreras (minimal påverkan på markskugga)
- **Terrängmodell** kommer från `MARK_Z` i byggnadsdata — områden utan byggnader saknar terrängdata
- **Väderprognos** gäller hela Stockholm (en punkt), inte per venue
- **Manuellt tillagda venues** (takbarer) har inga OSM-bilder och saknar öppettider i Google Places-integreringen
