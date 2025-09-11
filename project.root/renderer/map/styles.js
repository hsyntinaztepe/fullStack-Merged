import Style from 'ol/style/Style.js';
import Stroke from 'ol/style/Stroke.js';
import Fill from 'ol/style/Fill.js';
import CircleStyle from 'ol/style/Circle.js';
import Text from 'ol/style/Text.js';

// Çizim katmanı stili
export const drawStyle = (feature) => {
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
      return new Style({
        stroke: new Stroke({ color: '#e53935', width: 3 })
      });
    case 'Polygon':
      return new Style({
        fill: new Fill({ color: 'rgba(67,160,71,0.25)' }),
        stroke: new Stroke({ color: '#43a047', width: 2 })
      });
    default:
      return new Style();
  }
};

// Radar/IFF hedef stili
export function radarStyle(feature) {
  const status = (feature.get('status') ?? 'UNKNOWN').toString();
  const callsign = (feature.get('callsign') ?? 'UNKNOWN').toString();

  let color = '#000000ff'; // default siyah
  if (status === 'DOST') color = '#00ff00ff';
  else if (status === 'DUSMAN') color = '#ff0000ff';
  else if (status === 'UNKNOWN') color = '#9B9B9BFF';

  return new Style({
    image: new CircleStyle({
      radius: 7,
      fill: new Fill({ color }),
      stroke: new Stroke({ color: '#ffffffff', width: 2 })
    }),
    text: new Text({
      text: callsign,
      font: 'bold 12px sans-serif',
      fill: new Fill({ color: '#ffffff' }),
      stroke: new Stroke({ color: '#000000', width: 3 }),
      offsetY: -15
    })
  });
}
