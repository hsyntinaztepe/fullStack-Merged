// ui/suspiciousPanel.js

const listEl = document.getElementById('suspicious-list');

function probClass(p) {
  if (p >= 0.67) return 'prob-high';
  if (p >= 0.34) return 'prob-mid';
  return 'prob-low';
}

function fmt(v, digits = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return '-';
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(digits) : String(v);
}

function renderItem(t) {
  const p = Number(t.suspiciousProbability ?? 0);
  const cls = probClass(p);

  const div = document.createElement('div');
  div.className = 'suspicious-item';
  div.innerHTML = `
    <div class="row">
      <div><strong>${t.radarId}</strong> ${t.callsign !== 'UNKNOWN' ? `| ${t.callsign}` : ''}</div>
      <div class="badge ${cls}">P=${fmt(p, 2)}</div>
    </div>
    <div class="row">
      <div>${t.friend_foe || t.status || '-'}</div>
      <div>spd ${fmt(t.velocity, 0)} | hdg ${fmt(t.heading, 0)}</div>
    </div>
    <div class="row">
      <div>lat ${fmt(t.lat, 4)}</div>
      <div>lon ${fmt(t.lon, 4)}</div>
    </div>
    <div class="row">
      <div>baro ${fmt(t.baroAlt, 0)}</div>
      <div>geo ${fmt(t.geoAlt, 0)}</div>
    </div>
  `;
  // Panoda tıklanınca haritayı hedefe odaklamak istersen event ekleyebilirsin:
  // div.addEventListener('click', () => window.dispatchEvent(new CustomEvent('map:focus', { detail: { lat: t.lat, lon: t.lon, id: t.radarId } })));
  return div;
}

function renderList(targets = []) {
  listEl.innerHTML = '';
  // Yüksek olasılık en üstte
  const sorted = [...targets].sort((a, b) => (b.suspiciousProbability ?? 0) - (a.suspiciousProbability ?? 0));
  sorted.forEach(t => listEl.appendChild(renderItem(t)));
}

// radarStream.js içinde dispatch edilen event’i dinle
window.addEventListener('suspicious:update', (e) => {
  const targets = e.detail || [];
  renderList(targets);
});
