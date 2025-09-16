import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import { fromLonLat } from 'ol/proj.js';
import { radarSource } from './initMap.js';
import { setStatus } from '../ui/status.js';

const { logWrite } = window.electron || {};
const { predict } = window.api || {};

let targetTimers = new Map();
let suspiciousTargets = [];
const manualOverrides = new Map(); // radarId -> { status: 'FOE' }

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
    if (isNaN(lat) || isNaN(lon)) return;

    const id = cleanId(t.id);
    const radarId = id || `${Math.round(lat * 1e5)}_${Math.round(lon * 1e5)}`;

    const iffMatch = iffTargetsMap.get(id) || null;
    let status = (iffMatch?.status ?? 'UNKNOWN').toString();
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

    const override = manualOverrides.get(radarId);
    if (override) {
      Object.assign(merged, override);
    }

    logMergedCSV(merged);

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
        merged.suspicious = result.prediction;
        merged.suspiciousProbability = result.probability;

        if (result.probability > 0) {
          const idx = suspiciousTargets.findIndex(t => t.radarId === merged.radarId);
          if (idx >= 0) suspiciousTargets[idx] = merged;
          else suspiciousTargets.push(merged);
        } else {
          suspiciousTargets = suspiciousTargets.filter(t => t.radarId !== merged.radarId);
        }

        window.dispatchEvent(new CustomEvent('suspicious:update', { detail: suspiciousTargets }));
      } catch (err) {
        console.error('[RadarStream] Tahmin API hatası:', err);
      }
    }

    let feature = radarSource.getFeatureById(radarId);
    if (!feature) {
      feature = new Feature({
        geometry: new Point(fromLonLat([lon, lat])),
        ...merged
      });
      feature.setId(radarId);
      radarSource.addFeature(feature);
    } else {
      feature.getGeometry().setCoordinates(fromLonLat([lon, lat]));
      Object.keys(merged).forEach((key) => {
        if (key !== 'geometry') feature.set(key, merged[key]);
      });
    }

    setStatus(`Hedef güncellendi: ${radarId} (${merged.velocity ?? '-'} km/h)`);

    if (targetTimers.has(radarId)) clearTimeout(targetTimers.get(radarId));
    const timer = setTimeout(() => {
      const f = radarSource.getFeatureById(radarId);
      if (f) {
        radarSource.removeFeature(f);
        setStatus(`Target kaldırıldı: ${radarId}`);
      }
      targetTimers.delete(radarId);
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
  manualOverrides.clear();
  window.dispatchEvent(new CustomEvent('suspicious:update', { detail: suspiciousTargets }));
}

export async function loadRadarTargets() {
  cleanupAllTargets();
  setStatus('Radar verisi stream ile yüklenecek');
}

window.addEventListener('target:markFoe', (e) => {
  const { radarId } = e.detail;
  manualOverrides.set(radarId, { status: 'FOE' , callsign: 'FOE'});
  const feature = radarSource.getFeatureById(radarId);
  if (feature) {
    feature.set('status', 'FOE');
    feature.set('callsign', 'FOE');
  }
  setStatus(`Target ${radarId} marked as FOE`);
});

window.addEventListener('target:resetStatus', (e) => {
  const { radarId } = e.detail;
  manualOverrides.delete(radarId);
  setStatus(`Target ${radarId} reset to original status`);
});
