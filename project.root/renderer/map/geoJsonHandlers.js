import GeoJSON from 'ol/format/GeoJSON.js';
import { drawSource, map } from './initMap.js';
import { setStatus } from '../ui/status.js';
import shapesUrl from '../../data/shapes.geojson?url';

export async function loadGeoJsonFromFile() {
  try {
    const res = await window.geo.open();
    if (!res?.ok) return setStatus('Yükleme iptal/başarısız');
    const data = JSON.parse(res.data);
    const features = new GeoJSON().readFeatures(data, { featureProjection: 'EPSG:3857' });
    drawSource.clear();
    drawSource.addFeatures(features);
    fitToData();
    setStatus('GeoJSON yüklendi');
  } catch (err) {
    console.error(err);
    setStatus('GeoJSON yüklenemedi');
  }
}

export async function saveGeoJsonToFile() {
  try {
    const geojson = new GeoJSON().writeFeatures(drawSource.getFeatures(), { featureProjection: 'EPSG:3857' });
    const res = await window.geo.save({ suggestedName: 'data.geojson', content: geojson });
    if (!res?.ok) return setStatus('Kaydetme iptal/başarısız');
    setStatus('GeoJSON kaydedildi');
  } catch (err) {
    console.error(err);
    setStatus('GeoJSON kaydedilemedi');
  }
}

export async function loadExampleGeoJson() {
  try {
    const resp = await fetch(shapesUrl);
    if (resp.ok) {
      const data = await resp.json();
      const feats = new GeoJSON().readFeatures(data, { featureProjection: 'EPSG:3857' });
      drawSource.addFeatures(feats);
      fitToData();
      setStatus('Örnek GeoJSON yüklendi');
    } else {
      setStatus('Örnek GeoJSON yüklenemedi');
    }
  } catch (err) {
    console.error(err);
    setStatus('Örnek GeoJSON yüklenemedi');
  }
}

function fitToData() {
  const extent = drawSource.getExtent();
  if (extent && isFinite(extent[0])) {
    map.getView().fit(extent, { padding: [40, 40, 40, 40], duration: 250, maxZoom: 16 });
  } else {
    setStatus('Kadrajlanacak veri yok');
  }
}
