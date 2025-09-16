import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorLayer from 'ol/layer/Vector.js';
import OSM from 'ol/source/OSM.js';
import XYZ from 'ol/source/XYZ.js';
import VectorSource from 'ol/source/Vector.js';
import { fromLonLat } from 'ol/proj.js';
import { drawStyle, radarStyle } from './styles.js';
import { defaults as defaultControls } from 'ol/control.js';

export const drawSource = new VectorSource();
export const radarSource = new VectorSource();

export const baseLayers = {
  osm: new TileLayer({ source: new OSM() }),
  satellite: new TileLayer({
    source: new XYZ({ url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', attributions: '© Google' })
  }),
  hybrid: new TileLayer({
    source: new XYZ({ url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', attributions: '© Google' })
  }),
  terrain: new TileLayer({
    source: new XYZ({ url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', attributions: '© Google' })
  })
};

export const drawLayer = new VectorLayer({ source: drawSource, style: drawStyle });
export const radarLayer = new VectorLayer({
  source: radarSource,
  style: radarStyle  
});

export const map = new Map({
  target: 'map',
  layers: [baseLayers.satellite, drawLayer, radarLayer],
  view: new View({
    center: fromLonLat([32.85, 39.93]),
    zoom: 8
  }),
  controls: defaultControls({
    zoom: false,        
    attribution: false   
  })
});

