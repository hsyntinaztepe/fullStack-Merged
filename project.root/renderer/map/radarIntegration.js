import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import { fromLonLat } from 'ol/proj.js';
import { radarSource } from './initMap.js';
import { setStatus } from '../ui/status.js';

// Her target için ayrı timer tut
let targetTimers = new Map();

// Lat/lon toleranslı eşleşme (km cinsinden)
function findIFFMatchByLocation(radarLat, radarLon, iffTargets, toleranceKm = 5) {
  const toRad = deg => deg * Math.PI / 180;
  const R = 6371; // Dünya yarıçapı km
  return iffTargets.find(iff => {
    const dLat = toRad(iff.lat - radarLat);
    const dLon = toRad(iff.lon - radarLon);
    const a = Math.sin(dLat/2)**2 +
              Math.cos(toRad(radarLat)) * Math.cos(toRad(iff.lat)) *
              Math.sin(dLon/2)**2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return distance <= toleranceKm;
  });
}

export function startRadarStream(iffTargets) {
  // Eski timer'ları temizle
  targetTimers.forEach(timer => clearTimeout(timer));
  targetTimers.clear();

  window.radar.startStream();

  window.radar.onStreamData((t) => {
    const lat = parseFloat(t.lat ?? t.y_coordinate);
    const lon = parseFloat(t.lon ?? t.x_coordinate);



    // IFF eşleşmesini lat/lon ile bul
    const iffMatch = Array.isArray(iffTargets)
      ? findIFFMatchByLocation(lat, lon, iffTargets, 5) // 5 km tolerans
      : null;

    // Radar + IFF verisini birleştir
    const merged = {
      radarId: t.id,
      lat,
      lon,
      velocity: t.velocity,
      baroAlt: t.baroAlt,
      geoAlt: t.geoAlt,
      status: iffMatch?.status || 'UNKNOWN',
      callsign: iffMatch?.callsign || 'UNKNOWN'
    };

    // ------------------ ID ile feature update ------------------
    let feature = radarSource.getFeatureById(merged.radarId);
    if (!feature) {
      // Yeni hedef
      feature = new Feature({
        geometry: new Point(fromLonLat([lon, lat])),
        ...merged
      });
      feature.setId(merged.radarId);
      radarSource.addFeature(feature);
      console.log(`Yeni target eklendi: ${merged.radarId}`, merged);
    } else {
      // Var olan hedefi update et
      feature.getGeometry().setCoordinates(fromLonLat([lon, lat]));
      Object.keys(merged).forEach(key => {
        if (key !== 'geometry') feature.set(key, merged[key]);
      });
    }
    // ------------------------------------------------------------

    setStatus(`Hedef güncellendi: ${merged.radarId} (${merged.velocity ?? '-'} km/h)`);

    // Timer resetle → 2 saniye boyunca veri gelmezse silinsin
    if (targetTimers.has(merged.radarId)) {
      clearTimeout(targetTimers.get(merged.radarId));
    }
    const timer = setTimeout(() => {
      let f = radarSource.getFeatureById(merged.radarId);
      if (f) {
        radarSource.removeFeature(f);
        console.log(`Target kaldırıldı (timeout): ${merged.radarId}`);
        setStatus(`Target kaldırıldı: ${merged.radarId}`);
      }
      targetTimers.delete(merged.radarId);
    }, 2000);
    targetTimers.set(merged.radarId, timer);
  });

  window.radar.onStreamEnd(() => {
    setStatus('Radar stream kapandı (server)');
    cleanupAllTargets();
  });

  window.radar.onStreamError((err) => {
    setStatus('Radar stream hatası: ' + err);
    cleanupAllTargets();
  });
}

function cleanupAllTargets() {
  radarSource.clear();
  targetTimers.forEach(timer => clearTimeout(timer));
  targetTimers.clear();
}

export async function loadRadarTargets() {
  radarSource.clear();
  targetTimers.forEach(timer => clearTimeout(timer));
  targetTimers.clear();
  setStatus('Radar verisi stream ile yüklenecek');
}
