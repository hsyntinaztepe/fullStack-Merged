const statusEl = document.getElementById('status');

export function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}
