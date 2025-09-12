import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import { fromLonLat } from 'ol/proj.js';
import { radarSource } from './initMap.js';
import { setStatus } from '../ui/status.js';

// Her hedef için ayrı timer tut
let targetTimers = new Map();

// ID normalize fonksiyonu
const cleanId = (id) => (id || '').trim().toUpperCase();

export function startRadarStream(iffTargetsMap) {
  // Tip kontrolü
  if (!(iffTargetsMap instanceof Map)) {
    console.error('startRadarStream: iffTargetsMap bir Map değil!', iffTargetsMap);
    return;
  }

  // Önceki verileri temizle
  cleanupAllTargets();

  // Radar stream başlat
  window.radar.startStream();

  window.radar.onStreamData((t) => {
    const lat = parseFloat(t.lat ?? t.y_coordinate);
    const lon = parseFloat(t.lon ?? t.x_coordinate);

    // ID'yi normalize et
    const id = cleanId(t.id);
    const radarId = id || `${Math.round(lat * 1e5)}_${Math.round(lon * 1e5)}`;

    // IFF eşleşmesini ID ile bul
    const iffMatch = iffTargetsMap.get(id) || null;
    const status = (iffMatch?.status ?? 'UNKNOWN').toString();
    const callsign = (iffMatch?.callsign ?? 'UNKNOWN').toString();

    const merged = {
      radarId,
      id, // normalize edilmiş ID
      lat,
      lon,
      velocity: t.velocity ?? null,
      baroAlt: t.baroAlt ?? t.baro_altitude ?? null,
      geoAlt: t.geoAlt ?? t.geo_altitude ?? null,
      status,
      callsign
    };

    // Feature oluştur / güncelle
    let feature = radarSource.getFeatureById(radarId);
    if (!feature) {
      feature = new Feature({
        geometry: new Point(fromLonLat([lon, lat])),
        ...merged
      });
      feature.setId(radarId);
      radarSource.addFeature(feature);
      console.log(`Yeni target eklendi: ${radarId}`, merged);
    } else {
      feature.getGeometry().setCoordinates(fromLonLat([lon, lat]));
      Object.keys(merged).forEach(key => {
        if (key !== 'geometry') feature.set(key, merged[key]);
      });
    }

    setStatus(`Hedef güncellendi: ${radarId} (${merged.velocity ?? '-' } km/h)`);

    // Timer resetle → 2 saniye veri gelmezse sil
    if (targetTimers.has(radarId)) {
      clearTimeout(targetTimers.get(radarId));
    }
    const timer = setTimeout(() => {
      const f = radarSource.getFeatureById(radarId);
      if (f) {
        radarSource.removeFeature(f);
        console.log(`Target kaldırıldı (timeout): ${radarId}`);
        setStatus(`Target kaldırıldı: ${radarId}`);
      }
      targetTimers.delete(radarId);
    }, 2000);
    targetTimers.set(radarId, timer);
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
  cleanupAllTargets();
  setStatus('Radar verisi stream ile yüklenecek');
}
