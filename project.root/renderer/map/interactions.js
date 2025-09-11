import Draw from 'ol/interaction/Draw.js';
import Modify from 'ol/interaction/Modify.js';
import Select from 'ol/interaction/Select.js';
import Translate from 'ol/interaction/Translate.js';
import { drawSource, drawLayer, map } from './initMap.js';
import { setStatus } from '../ui/status.js';

let draw = null, modify = null, select = null, translate = null;

export function setDrawInteraction(type) {
  if (draw) { map.removeInteraction(draw); draw = null; }
  if (type === 'None') { setStatus('Çizim kapalı'); return; }
  draw = new Draw({ source: drawSource, type });
  draw.on('drawstart', () => setStatus(`Çizim: ${type}`));
  draw.on('drawend', () => setStatus('Çizim bitti'));
  map.addInteraction(draw);
}

export function ensureModify(enabled) {
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

export function ensureTranslate(enabled) {
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
