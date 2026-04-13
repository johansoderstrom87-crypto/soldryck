/** SL Tunnelbana stations in central Stockholm with coordinates */
export interface MetroStation {
  name: string;
  lat: number;
  lng: number;
  lines: string[]; // line colors
}

export const METRO_LINES = [
  { id: "red", label: "Roda linjen", color: "#e3000b" },
  { id: "green", label: "Grona linjen", color: "#00a14e" },
  { id: "blue", label: "Bla linjen", color: "#0065bd" },
] as const;

export const METRO_STATIONS: MetroStation[] = [
  // Röda linjen (13/14)
  { name: "T-Centralen", lat: 59.3313, lng: 18.0598, lines: ["red", "green", "blue"] },
  { name: "Östermalmstorg", lat: 59.3350, lng: 18.0730, lines: ["red"] },
  { name: "Karlaplan", lat: 59.3381, lng: 18.0830, lines: ["red"] },
  { name: "Gärdet", lat: 59.3451, lng: 18.0936, lines: ["red"] },
  { name: "Ropsten", lat: 59.3573, lng: 18.1023, lines: ["red"] },
  { name: "Stadion", lat: 59.3427, lng: 18.0831, lines: ["red"] },
  { name: "Tekniska högskolan", lat: 59.3458, lng: 18.0716, lines: ["red"] },
  { name: "Universitetet", lat: 59.3652, lng: 18.0558, lines: ["red"] },
  { name: "Bergshamra", lat: 59.3818, lng: 18.0345, lines: ["red"] },
  { name: "Danderyds sjukhus", lat: 59.3947, lng: 18.0431, lines: ["red"] },
  { name: "Mörby centrum", lat: 59.4036, lng: 18.0381, lines: ["red"] },
  { name: "Liljeholmen", lat: 59.3109, lng: 18.0222, lines: ["red"] },
  { name: "Aspudden", lat: 59.3064, lng: 18.0099, lines: ["red"] },
  { name: "Örnsberg", lat: 59.3030, lng: 17.9973, lines: ["red"] },
  { name: "Midsommarkransen", lat: 59.3019, lng: 18.0118, lines: ["red"] },
  { name: "Telefonplan", lat: 59.2982, lng: 18.0131, lines: ["red"] },
  { name: "Hägerstensåsen", lat: 59.2943, lng: 17.9998, lines: ["red"] },
  { name: "Fruängen", lat: 59.2854, lng: 17.9857, lines: ["red"] },

  // Gröna linjen (17/18/19)
  { name: "Slussen", lat: 59.3199, lng: 18.0722, lines: ["green"] },
  { name: "Medborgarplatsen", lat: 59.3143, lng: 18.0734, lines: ["green"] },
  { name: "Skanstull", lat: 59.3082, lng: 18.0766, lines: ["green"] },
  { name: "Gullmarsplan", lat: 59.2987, lng: 18.0808, lines: ["green"] },
  { name: "Globen", lat: 59.2935, lng: 18.0779, lines: ["green"] },
  { name: "Hammarbyhöjden", lat: 59.2945, lng: 18.1047, lines: ["green"] },
  { name: "Hötorget", lat: 59.3353, lng: 18.0630, lines: ["green"] },
  { name: "Rådmansgatan", lat: 59.3411, lng: 18.0584, lines: ["green"] },
  { name: "Odenplan", lat: 59.3430, lng: 18.0493, lines: ["green"] },
  { name: "Sankt Eriksplan", lat: 59.3405, lng: 18.0362, lines: ["green"] },
  { name: "Fridhemsplan", lat: 59.3322, lng: 18.0286, lines: ["green"] },
  { name: "Thorildsplan", lat: 59.3320, lng: 18.0169, lines: ["green"] },
  { name: "Kristineberg", lat: 59.3330, lng: 18.0033, lines: ["green"] },
  { name: "Alvik", lat: 59.3337, lng: 17.9796, lines: ["green"] },
  { name: "Gamla stan", lat: 59.3236, lng: 18.0672, lines: ["green"] },
  { name: "Zinkensdamm", lat: 59.3174, lng: 18.0487, lines: ["green"] },
  { name: "Hornstull", lat: 59.3155, lng: 18.0346, lines: ["green"] },

  // Blå linjen (10/11)
  { name: "Kungsträdgården", lat: 59.3310, lng: 18.0740, lines: ["blue"] },
  { name: "Rådhuset", lat: 59.3305, lng: 18.0470, lines: ["blue"] },
  { name: "Stadshagen", lat: 59.3369, lng: 18.0205, lines: ["blue"] },
  { name: "Västra skogen", lat: 59.3484, lng: 18.0024, lines: ["blue"] },
  { name: "Solna centrum", lat: 59.3597, lng: 18.0005, lines: ["blue"] },
  { name: "Näckrosen", lat: 59.3653, lng: 17.9942, lines: ["blue"] },
  { name: "Hallonbergen", lat: 59.3748, lng: 17.9928, lines: ["blue"] },
  { name: "Kista", lat: 59.4032, lng: 17.9445, lines: ["blue"] },
  { name: "Akalla", lat: 59.4145, lng: 17.9133, lines: ["blue"] },
  { name: "Hjulsta", lat: 59.3962, lng: 17.8870, lines: ["blue"] },
];

/** Radius in meters to search for venues near a station */
export const STATION_RADIUS_M = 500;

/** Haversine distance in meters between two lat/lng points */
export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
