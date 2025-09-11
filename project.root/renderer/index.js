// index.js

// Harita ve kaynaklar
import './map/initMap.js';

// UI ve kontrol modülleri
import { setDrawInteraction, ensureModify, ensureTranslate } from './map/interactions.js';
import { changeLayer } from './map/layerControl.js';
import { loadGeoJsonFromFile, saveGeoJsonToFile, loadExampleGeoJson } from './map/geoJsonHandlers.js';
import { startRadarStream, loadRadarTargets } from './map/radarIntegration.js';
import { drawSource, map, radarLayer } from './map/initMap.js';
import { setStatus } from './ui/status.js';
import { initMergedPopup } from './map/radarPopup.js';

// === Toolbar bağlama ===
document.querySelectorAll('.toolbar button[data-tool]').forEach(btn => {
  btn.addEventListener('click', () => setDrawInteraction(btn.getAttribute('data-tool')));
});

document.getElementById('modify').addEventListener('click', () => {
  ensureModify(!document.getElementById('modify').classList.toggle('active'));
  if (ensureTranslate) ensureTranslate(false);
});

document.getElementById('translate').addEventListener('click', () => {
  ensureTranslate(!document.getElementById('translate').classList.toggle('active'));
  if (ensureModify) ensureModify(false);
});

document.getElementById('clear').addEventListener('click', () => {
  drawSource.clear();
  setStatus('Çizimler temizlendi');
});

document.getElementById('fit').addEventListener('click', () => {
  const extent = drawSource.getExtent();
  if (extent && isFinite(extent[0])) {
    import('./map/initMap.js').then(({ map }) => {
      map.getView().fit(extent, { padding: [40, 40, 40, 40], duration: 250, maxZoom: 16 });
    });
    setStatus('Veriye göre kadrajlandı');
  } else {
    setStatus('Kadrajlanacak veri yok');
  }
});

document.getElementById('load').addEventListener('click', loadGeoJsonFromFile);
document.getElementById('save').addEventListener('click', saveGeoJsonToFile);

// Katman değiştirme global erişim
window.changeLayer = changeLayer;

// === Başlangıç yüklemeleri ===
await loadExampleGeoJson();
await loadRadarTargets();

// === IFF snapshot + Radar stream eşleşme mantığı ===
let iffTargets = [];

// Yeni proto'ya uygun IFF stream başlatma
// Filtre istemezsen lat/lon/radius_km = 0 gönder
window.iff.startStream({
  lat: 0,
  lon: 0,
  radius_km: 0
});

// IFF verisi geldikçe topla
window.iff.onStreamData((data) => {
  if (!data) return;
  console.log('[IFF STREAM]', data);
  iffTargets.push({
    status: data.status,
    lat: data.lat,
    lon: data.lon,
    callsign: data.callsign
  });
});

window.iff.onStreamError((err) => {
  console.error('[IFF STREAM] Error:', err);
  setStatus('IFF stream hatası');
});

let radarRendererListenerAttached = false;

window.iff.onStreamEnd(() => {
  console.log('[IFF STREAM] End of stream, starting radar stream...');

  // Renderer konsoluna radar verisini de bas
  if (!radarRendererListenerAttached) {
    radarRendererListenerAttached = true;

    window.radar.onStreamData((t) => {
      console.log('[RADAR STREAM - Renderer]', t);
    });

    window.radar.onStreamError?.((err) => {
      console.error('[RADAR STREAM - Renderer] Error:', err);
    });

    window.radar.onStreamEnd?.(() => {
      console.log('[RADAR STREAM - Renderer] End of stream');
    });
  }

  // IFF verisi hazır → radar stream başlat
  startRadarStream(iffTargets);
});

window.iff.onStreamStopped(() => {
  console.log('[IFF STREAM] Stopped');
});

// === Popup’ı başlat ===
initMergedPopup(map, radarLayer);
