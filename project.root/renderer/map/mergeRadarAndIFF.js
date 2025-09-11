// mergeRadarAndIFF.js
export function mergeRadarAndIFF(radarTarget, iffMatch) {
  return {
    // Radar kimliği
    radarId: radarTarget.id || null,

    // Konum bilgileri (radar öncelikli)
    lat: radarTarget.lat ?? null,
    lon: radarTarget.lon ?? null,

    // Radar verileri
    velocity: radarTarget.velocity ?? null,
    baroAlt: radarTarget.baroAlt ?? null,
    geoAlt: radarTarget.geoAlt ?? null,

    // IFF verileri
    status: iffMatch?.status || 'UNKNOWN',
    callsign: iffMatch?.callsign || 'UNKNOWN'
  };
}
