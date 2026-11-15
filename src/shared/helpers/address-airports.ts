/** Exact IATA aliases supply search text only, never coordinates or delivery coverage.
 * Official sources: aeropuertocibao.com.do, puntacanainternationalairport.com,
 * vinci-airports.com/en/our-airports/dominican-republic/las-americas-airport/.
 */
const AIRPORTS = [
  { code: "STI", name: "Cibao International Airport", query: "Aeropuerto Internacional del Cibao, Santiago, Dominican Republic" },
  { code: "PUJ", name: "Punta Cana International Airport", query: "Punta Cana International Airport, Dominican Republic" },
  { code: "SDQ", name: "Las Américas International Airport", query: "Aeropuerto Internacional de Las Américas, Santo Domingo, Dominican Republic" },
] as const;

export function recognizedAirport(query: string, countryCode: string) {
  if (countryCode.trim().toUpperCase() !== "DO") return undefined;
  const code = query.trim().toUpperCase();
  return AIRPORTS.find((airport) => airport.code === code);
}
