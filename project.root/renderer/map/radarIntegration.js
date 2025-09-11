import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import { fromLonLat } from 'ol/proj.js';
import { radarSource } from './initMap.js';
import { setStatus } from '../ui/status.js';

// Her target için ayrı timer tut
let targetTimers = new Map();

// Yakınlık tabanlı lock tablosu
// { lat, lon, status, callsign }
const lockTable = [];

// Mesafe hesaplama (km)
function distanceKm(lat1, lon1, lat2, lon2) {
  const toRad = deg => deg * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// Lock tablosunda yakın kayıt bul
function findLockByProximity(lat, lon, toleranceKm = 3) {
  return lockTable.find(entry => distanceKm(lat, lon, entry.lat, entry.lon) <= toleranceKm);
}

// Yeni lock ekle
function addLock(lat, lon, status, callsign) {
  lockTable.push({ lat, lon, status, callsign });
}

export function startRadarStream(iffTargets) {
  // Önceki verileri temizle
  targetTimers.forEach(timer => clearTimeout(timer));
  targetTimers.clear();
  lockTable.length = 0;

  window.radar.startStream();

  window.radar.onStreamData((t) => {
    const lat = parseFloat(t.lat ?? t.y_coordinate);
    const lon = parseFloat(t.lon ?? t.x_coordinate);

    // Önce lock tablosunda yakın kayıt var mı bak
    let lock = findLockByProximity(lat, lon);

    if (!lock) {
      // Yoksa IFF eşleşmesi dene (sadece ilk kez)
      let matched = null;
      if (Array.isArray(iffTargets)) {
        matched = iffTargets.find(iff => distanceKm(lat, lon, iff.lat, iff.lon) <= 5);
      }
      const status = (matched?.status ?? 'UNKNOWN').toString();
      const callsign = (matched?.callsign ?? 'UNKNOWN').toString();

      // Yeni lock kaydı ekle
      addLock(lat, lon, status, callsign);
      lock = { lat, lon, status, callsign };
    } else {
      // Lock bulundu → sadece lock konumunu güncelle (takip için)
      lock.lat = lat;
      lock.lon = lon;
    }

    const radarId = `${Math.round(lat * 1e5)}_${Math.round(lon * 1e5)}`;

    const merged = {
      radarId,
      lat,
      lon,
      velocity: t.velocity ?? null,
      baroAlt: t.baroAlt ?? t.baro_altitude ?? null,
      geoAlt: t.geoAlt ?? t.geo_altitude ?? null,
      status: lock.status,
      callsign: lock.callsign
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

    setStatus(`Hedef güncellendi: ${radarId} (${merged.velocity ?? '-'} km/h)`);

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
      // Lock kaydını da temizle
      const idx = lockTable.findIndex(entry => entry.status === lock.status && entry.callsign === lock.callsign);
      if (idx !== -1) lockTable.splice(idx, 1);
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
  lockTable.length = 0;
}

export async function loadRadarTargets() {
  radarSource.clear();
  targetTimers.forEach(timer => clearTimeout(timer));
  targetTimers.clear();
  lockTable.length = 0;
  setStatus('Radar verisi stream ile yüklenecek');
}
