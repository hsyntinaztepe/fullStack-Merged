
import './map/initMap.js';


import { setDrawInteraction, ensureModify, ensureTranslate } from './map/interactions.js';
import { changeLayer } from './map/layerControl.js';
import { loadGeoJsonFromFile, saveGeoJsonToFile, loadExampleGeoJson } from './map/geoJsonHandlers.js';
import { startRadarStream, loadRadarTargets } from './map/radarIntegration.js';
import { drawSource, map, radarLayer } from './map/initMap.js';
import { setStatus } from './ui/status.js';
import { initMergedPopup } from './map/radarPopup.js';


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


window.changeLayer = changeLayer;


await loadExampleGeoJson();
await loadRadarTargets();


const iffTargets = new Map();


const cleanId = (id) => (id || '').trim().toUpperCase();


window.iff.startStream({
  lat: 0,
  lon: 0,
  radius_km: 0
});


window.iff.onStreamData((data) => {
  if (!data) return;
  const id = cleanId(data.id);
  console.log('[IFF STREAM]', data);

  iffTargets.set(id, {
    id,
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

  if (!radarRendererListenerAttached) {
    radarRendererListenerAttached = true;

    window.radar.onStreamData((t) => {
      const id = cleanId(t.id);
      console.log('[RADAR STREAM - Renderer]', t);

      const iffMatch = iffTargets.get(id);
      if (iffMatch) {
        console.log('[MATCH FOUND]', { radar: t, iff: iffMatch });
      } else {
        console.log('[NO MATCH]', id);
      }
    });

    window.radar.onStreamError?.((err) => {
      console.error('[RADAR STREAM - Renderer] Error:', err);
    });

    window.radar.onStreamEnd?.(() => {
      console.log('[RADAR STREAM - Renderer] End of stream');
    });
  }

 
  startRadarStream(iffTargets);
});

window.iff.onStreamStopped(() => {
  console.log('[IFF STREAM] Stopped');
});


initMergedPopup(map, radarLayer);
