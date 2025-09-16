import Overlay from 'ol/Overlay.js';
import { toLonLat } from 'ol/proj.js';

export function initMergedPopup(map, layer) {
  const container = document.getElementById('popup');
  const content = document.getElementById('popup-content');
  const closer = document.getElementById('popup-closer');

  if (!container || !content || !closer) return;

  const overlay = new Overlay({
    element: container,
    autoPan: { animation: { duration: 200 } },
    positioning: 'bottom-center',
    offset: [0, -12]
  });
  map.addOverlay(overlay);

  let activeFeature = null;
  let changeListenerKey = null;
  let anchorCoord = null; 

  function closePopup() {
    overlay.setPosition(undefined);
    content.innerHTML = '';
    if (activeFeature && changeListenerKey) {
      activeFeature.un('change', changeListenerKey);
    }
    activeFeature = null;
    changeListenerKey = null;
    anchorCoord = null;
  }

  closer.onclick = () => {
    closePopup();
    return false;
  };

  map.on('singleclick', (evt) => {
    const feature = map.forEachFeatureAtPixel(evt.pixel, f => f, {
      layerFilter: l => l === layer,
      hitTolerance: 6
    });

    if (feature) {
      if (activeFeature && changeListenerKey) {
        activeFeature.un('change', changeListenerKey);
      }

      activeFeature = feature;
      anchorCoord = evt.coordinate;

      const updatePopup = () => {
        const coord = activeFeature.getGeometry().getClosestPoint(anchorCoord);
        content.innerHTML = buildMergedHTML(activeFeature.getProperties(), coord);
        overlay.setPosition(coord);
      };

      // İlk açılışta doldur
      updatePopup();

      // Feature değiştiğinde otomatik güncelle
      changeListenerKey = activeFeature.on('change', updatePopup);

    } else {
      closePopup();
    }
  });
}

function buildMergedHTML(props, coord) {
  const [lon, lat] = toLonLat(coord);
  const hiddenKeys = ['geometry', 'radarId', 'lat', 'lon']; // gizlenecek alanlar

  const rows = Object.entries(props)
    .filter(([k]) => !hiddenKeys.includes(k))
    .map(([k, v]) => `<tr><th>${k}</th><td>${v ?? '-'}</td></tr>`)
    .join('');

  return `
    <div><strong>Radar/IFF Track</strong></div>
    <table>${rows}</table>
    <div><small>${lon.toFixed(5)}, ${lat.toFixed(5)}</small></div>
  `;
}

