import { map, baseLayers } from './initMap.js';
import { setStatus } from '../ui/status.js';

export function changeLayer(layerType) {
  map.removeLayer(map.getLayers().item(0));
  map.getLayers().insertAt(0, baseLayers[layerType]);
  setStatus(`Harita türü: ${layerType}`);
}
