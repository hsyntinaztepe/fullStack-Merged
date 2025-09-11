import 'ol/ol.css';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorLayer from 'ol/layer/Vector.js';
import OSM from 'ol/source/OSM.js';
import XYZ from 'ol/source/XYZ.js';
import VectorSource from 'ol/source/Vector.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import Draw from 'ol/interaction/Draw.js';
import Modify from 'ol/interaction/Modify.js';
import Select from 'ol/interaction/Select.js';
import Translate from 'ol/interaction/Translate.js';
import Style from 'ol/style/Style.js';
import Stroke from 'ol/style/Stroke.js';
import Fill from 'ol/style/Fill.js';
import CircleStyle from 'ol/style/Circle.js';
import { fromLonLat } from 'ol/proj.js';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';

// ------------------------------
// Status utility
// ------------------------------
const statusEl = document.getElementById('status');
const setStatus = (t) => { if (statusEl) statusEl.textContent = t; };

// ------------------------------
// Sources
// ------------------------------
const drawSource = new VectorSource();   // User drawings
const radarSource = new VectorSource();  // Live radar targets

// ------------------------------
// Base layers
// ------------------------------
const baseLayers = {
  osm: new TileLayer({ source: new OSM() }),
  satellite: new TileLayer({
    source: new XYZ({
      url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      attributions: '© Google'
    })
  }),
  hybrid: new TileLayer({
    source: new XYZ({
      url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      attributions: '© Google'
    })
  }),
  terrain: new TileLayer({
    source: new XYZ({
      url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
      attributions: '© Google'
    })
  })
};

// ------------------------------
// Styles
// ------------------------------
const drawStyle = (feature) => {
  const type = feature.getGeometry().getType();
  switch (type) {
    case 'Point':
      return new Style({
        image: new CircleStyle({
          radius: 7,
          fill: new Fill({ color: '#1976d2' }),
          stroke: new Stroke({ color: '#fff', width: 2 })
        })
      });
    case 'LineString':
      return new Style({ stroke: new Stroke({ color: '#e53935', width: 3 }) });
    case 'Polygon':
      return new Style({
        fill: new Fill({ color: 'rgba(67,160,71,0.25)' }),
        stroke: new Stroke({ color: '#43a047', width: 2 })
      });
    default:
      return new Style();
  }
};

const radarStyle = new Style({
  image: new CircleStyle({
    radius: 7,
    fill: new Fill({ color: '#ff5722' }),
    stroke: new Stroke({ color: '#fff', width: 2 })
  })
});

// ------------------------------
// Layers
// ------------------------------
const drawLayer = new VectorLayer({ source: drawSource, style: drawStyle });
const radarLayer = new VectorLayer({ source: radarSource, style: radarStyle });

// ------------------------------
// Map
// ------------------------------
const map = new Map({
  target: 'map',
  layers: [
    baseLayers.osm, // default base
    drawLayer,
    radarLayer
  ],
  view: new View({
    center: fromLonLat([32.85, 39.93]), // Ankara
    zoom: 8
  })
});

// ------------------------------
// Base layer switcher
// ------------------------------
window.changeLayer = function(layerType) {
  const first = map.getLayers().item(0);
  if (first) map.removeLayer(first);
  map.getLayers().insertAt(0, baseLayers[layerType] || baseLayers.osm);
  setStatus(`Harita türü: ${layerType}`);
};

// ------------------------------
// Drawing tools
// ------------------------------
let draw = null, modify = null, select = null, translate = null;

function setDrawInteraction(type) {
  if (draw) { map.removeInteraction(draw); draw = null; }
  if (type === 'None') { setStatus('Çizim kapalı'); return; }
  draw = new Draw({ source: drawSource, type });
  draw.on('drawstart', () => setStatus(`Çizim: ${type}`));
  draw.on('drawend', () => setStatus('Çizim bitti'));
  map.addInteraction(draw);
}

function ensureModify(enabled) {
  if (enabled && !modify) {
    modify = new Modify({ source: drawSource });
    map.addInteraction(modify);
    setStatus('Düzenleme açık');
  } else if (!enabled && modify) {
    map.removeInteraction(modify);
    modify = null;
    setStatus('Düzenleme kapalı');
  }
}

function ensureTranslate(enabled) {
  if (enabled && !translate) {
    if (!select) {
      select = new Select({ layers: [drawLayer] });
      map.addInteraction(select);
    }
    translate = new Translate({ features: select.getFeatures() });
    map.addInteraction(translate);
    setStatus('Taşıma açık (önce bir öğe seç)');
  } else if (!enabled && translate) {
    map.removeInteraction(translate);
    translate = null;
    if (select) { map.removeInteraction(select); select = null; }
    setStatus('Taşıma kapalı');
  }
}

// Toolbar bindings
document.querySelectorAll('.toolbar button[data-tool]').forEach(btn => {
  btn.addEventListener('click', () => setDrawInteraction(btn.getAttribute('data-tool')));
});
document.getElementById('modify')?.addEventListener('click', () => {
  const on = !modify;
  ensureModify(on);
  if (on && translate) ensureTranslate(false);
});
document.getElementById('translate')?.addEventListener('click', () => {
  const on = !translate;
  ensureTranslate(on);
  if (on && modify) ensureModify(false);
});
document.getElementById('clear')?.addEventListener('click', () => {
  drawSource.clear();
  setStatus('Çizimler temizlendi');
});
document.getElementById('fit')?.addEventListener('click', () => {
  const extent = drawSource.getExtent();
  if (extent && isFinite(extent[0])) {
    map.getView().fit(extent, { padding: [40, 40, 40, 40], duration: 250, maxZoom: 16 });
    setStatus('Veriye göre kadrajlandı');
  } else {
    setStatus('Kadrajlanacak veri yok');
  }
});
document.getElementById('load')?.addEventListener('click', async () => {
  try {
    const res = await window.geo.open();
    if (!res?.ok) return setStatus('Yükleme iptal/başarısız');
    const data = JSON.parse(res.data);
    const features = new GeoJSON().readFeatures(data, { featureProjection: 'EPSG:3857' });
    drawSource.clear();
    drawSource.addFeatures(features);
    document.getElementById('fit')?.click();
    setStatus('GeoJSON yüklendi');
  } catch (err) {
    console.error(err);
    setStatus('GeoJSON yüklenemedi');
  }
});
document.getElementById('save')?.addEventListener('click', async () => {
  try {
    const geojson = new GeoJSON().writeFeatures(drawSource.getFeatures(), { featureProjection: 'EPSG:3857' });
    const res = await window.geo.save({ suggestedName: 'data.geojson', content: geojson });
    if (!res?.ok) return setStatus('Kaydetme iptal/başarısız');
    setStatus('GeoJSON kaydedildi');
  } catch (err) {
    console.error(err);
    setStatus('GeoJSON kaydedilemedi');
  }
});

// ------------------------------
// Optional sample load
// ------------------------------
(async () => {
  try {
    const resp = await fetch('/data/shapes.geojson');
    if (resp.ok) {
      const data = await resp.json();
      const feats = new GeoJSON().readFeatures(data, { featureProjection: 'EPSG:3857' });
      drawSource.addFeatures(feats);
      document.getElementById('fit')?.click();
      setStatus('Örnek GeoJSON yüklendi');
    }
  } catch {}
})();

// ------------------------------
// Radar: gRPC streaming
// ------------------------------
// ... (senin yukarıdaki kodunun başı aynı kalıyor)

// ------------------------------
// Radar: gRPC streaming
// ------------------------------
function toLonLatFromTarget(t) {
  const x = typeof t.x_coordinate === 'number' ? t.x_coordinate : t.x;
  const y = typeof t.y_coordinate === 'number' ? t.y_coordinate : t.y;
  const lon = x / 100;
  const lat = y / 100;
  return [lon, lat];
}

function syncRadarFeatures(targets) {
  const existingFeatures = radarSource.getFeatures();
  const existingIds = new Set(existingFeatures.map(f => f.getId()));
  const incomingIds = new Set();

  targets.forEach(t => {
    if (!t?.id) return;
    incomingIds.add(t.id);

    let feature = radarSource.getFeatureById(t.id);
    const coords = fromLonLat(toLonLatFromTarget(t));

    if (!feature) {
      feature = new Feature({
        geometry: new Point(coords),
        name: t.id,
        velocity: t.velocity,
        location: t.location
      });
      feature.setId(t.id);
      radarSource.addFeature(feature);
    } else {
      feature.getGeometry().setCoordinates(coords);
      if (typeof t.velocity !== 'undefined') feature.set('velocity', t.velocity);
      if (typeof t.location !== 'undefined') feature.set('location', t.location);
    }
  });

  // Artık gelmeyenleri sil
  existingFeatures.forEach(f => {
    if (!incomingIds.has(f.getId())) {
      radarSource.removeFeature(f);
    }
  });

  // İlk veri geldiğinde radar katmanına zoom ya
}

// Tek seferde stream başlat
try {
  window.radar.startStream(1000);
  window.radar.onTargetBatch((targets) => {
    console.log('Gelen hedefler:', targets);
    syncRadarFeatures(targets);
    setStatus(`Radar verisi güncellendi (${targets.length} hedef)`);
  });
} catch (err) {
  console.error('Radar stream başlatılamadı:', err);
  setStatus('Radar stream başlatılamadı');
}

