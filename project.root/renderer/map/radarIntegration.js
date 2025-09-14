import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import { fromLonLat } from 'ol/proj.js';
import { radarSource } from './initMap.js';
import { setStatus } from '../ui/status.js';

// Preload'ta expose edilen API
const { logWrite } = window.electron || {};
const { predict } = window.api || {}; // Python API tahmin fonksiyonu

let targetTimers = new Map();
let suspiciousTargets = []; // probability > 0 olan hedefler

const cleanId = (id) => (id || '').trim().toUpperCase();

function logMergedCSV(merged) {
  const csvLine = [
    merged.radarId,
    merged.id,
    merged.callsign,
    merged.status,
    merged.lat,
    merged.lon,
    merged.velocity,
    merged.baroAlt,
    merged.geoAlt,
    merged.heading
  ].join(',');

  console.log('[MERGED JSON]', merged);
  console.log('[MERGED CSV]', csvLine);

  if (typeof logWrite === 'function') {
    logWrite(csvLine);
  } else {
    console.warn('[RadarStream] logWrite API tanımlı değil, CSV log yazılamadı.');
  }
}

export function startRadarStream(iffTargetsMap) {
  if (!(iffTargetsMap instanceof Map)) {
    console.error('startRadarStream: iffTargetsMap bir Map değil!', iffTargetsMap);
    return;
  }

  cleanupAllTargets();
  window.radar.startStream();

  window.radar.onStreamData(async (t) => {
    const lat = parseFloat(t.lat ?? t.y_coordinate);
    const lon = parseFloat(t.lon ?? t.x_coordinate);

    if (isNaN(lat) || isNaN(lon)) {
      console.warn('[RadarStream] Geçersiz koordinat verisi:', t);
      return;
    }

    const id = cleanId(t.id);
    const radarId = id || `${Math.round(lat * 1e5)}_${Math.round(lon * 1e5)}`;

    const iffMatch = iffTargetsMap.get(id) || null;
    const status = (iffMatch?.status ?? 'UNKNOWN').toString();
    const callsign = (iffMatch?.callsign ?? 'UNKNOWN').toString();

    const merged = {
      radarId,
      id,
      lat,
      lon,
      velocity: t.velocity ?? null,
      baroAlt: t.baroAlt ?? t.baro_altitude ?? null,
      geoAlt: t.geoAlt ?? t.geo_altitude ?? null,
      status,
      callsign,
      heading: t.heading ?? "0"
    };

    logMergedCSV(merged);

    // --- Python API'ye tahmin isteği ---
    if (typeof predict === 'function') {
      try {
        const liveData = {
          id1: merged.radarId,
          id2: merged.id,
          callsign: merged.callsign,
          friend_foe: merged.status,
          lat: merged.lat,
          lon: merged.lon,
          speed: merged.velocity,
          baroAltitude: merged.baroAlt,
          geoAltitude: merged.geoAlt,
          heading: parseFloat(merged.heading)
        };

        const result = await predict(liveData);
        console.log(`[Tahmin] ${merged.radarId}:`, result);

        merged.suspicious = result.prediction;
        merged.suspiciousProbability = result.probability;

        // Probability > 0 ise listeye ekle/güncelle
        if (result.probability > 0) {
          const idx = suspiciousTargets.findIndex(t => t.radarId === merged.radarId);
          if (idx >= 0) {
            suspiciousTargets[idx] = merged;
          } else {
            suspiciousTargets.push(merged);
          }
        } else {
          // 0 ise listeden çıkar
          suspiciousTargets = suspiciousTargets.filter(t => t.radarId !== merged.radarId);
        }

        // Listeyi UI'a gönder
        window.dispatchEvent(new CustomEvent('suspicious:update', { detail: suspiciousTargets }));

      } catch (err) {
        console.error('[RadarStream] Tahmin API hatası:', err);
      }
    } else {
      console.warn('[RadarStream] predict fonksiyonu preload üzerinden tanımlı değil.');
    }

    // --- Harita güncelleme ---
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
      Object.keys(merged).forEach((key) => {
        if (key !== 'geometry') feature.set(key, merged[key]);
      });
    }

    setStatus(`Hedef güncellendi: ${radarId} (${merged.velocity ?? '-'} km/h)`);

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
      // Listeden de çıkar
      suspiciousTargets = suspiciousTargets.filter(t => t.radarId !== radarId);
      window.dispatchEvent(new CustomEvent('suspicious:update', { detail: suspiciousTargets }));
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
  targetTimers.forEach((timer) => clearTimeout(timer));
  targetTimers.clear();
  suspiciousTargets = [];
  window.dispatchEvent(new CustomEvent('suspicious:update', { detail: suspiciousTargets }));
}

export async function loadRadarTargets() {
  cleanupAllTargets();
  setStatus('Radar verisi stream ile yüklenecek');
}
