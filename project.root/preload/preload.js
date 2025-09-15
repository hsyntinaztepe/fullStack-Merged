// preload.js
const { contextBridge, ipcRenderer } = require('electron');

/**
 * Tek tip stream API oluşturucu
 * @param {string} prefix - IPC kanal prefix'i (ör: 'radar', 'iff')
 */
function createStreamAPI(prefix) {
  return {
    startStream: (refreshMs = 1000, filter = "") => {
      ipcRenderer.send(`${prefix}:startStream`, { 
        refresh_interval_ms: refreshMs, 
        filter 
      });
    },
    stopStream: () => {
      ipcRenderer.send(`${prefix}:stopStream`);
    },
    onStreamData: (callback) => {
      const wrapped = (_, data) => callback?.(data);
      ipcRenderer.on(`${prefix}:streamData`, wrapped);
      return () => ipcRenderer.removeListener(`${prefix}:streamData`, wrapped);
    },
    onStreamEnd: (callback) => {
      const wrapped = () => callback?.();
      ipcRenderer.on(`${prefix}:streamEnd`, wrapped);
      return () => ipcRenderer.removeListener(`${prefix}:streamEnd`, wrapped);
    },
    onStreamError: (callback) => {
      const wrapped = (_, error) => callback?.(error);
      ipcRenderer.on(`${prefix}:streamError`, wrapped);
      return () => ipcRenderer.removeListener(`${prefix}:streamError`, wrapped);
    },
    onStreamStopped: (callback) => {
      const wrapped = () => callback?.();
      ipcRenderer.on(`${prefix}:streamStopped`, wrapped);
      return () => ipcRenderer.removeListener(`${prefix}:streamStopped`, wrapped);
    }
  };
}

/* -----------------------------
   API'leri expose et
----------------------------- */

// Radar ve IFF stream API
contextBridge.exposeInMainWorld('radar', createStreamAPI('radar'));
contextBridge.exposeInMainWorld('iff', createStreamAPI('iff'));

// Geo API
contextBridge.exposeInMainWorld('geo', {
  open: () => ipcRenderer.invoke('geo:open'),
  save: (payload) => ipcRenderer.invoke('geo:save', payload)
});

// Debug log API
contextBridge.exposeInMainWorld('electronDebug', {
  log: (...args) => console.log('[Renderer]', ...args),
  error: (...args) => console.error('[Renderer]', ...args)
});

// Log yazma API
contextBridge.exposeInMainWorld('electron', {
  logWrite: (line) => {
    if (typeof line === 'string' && line.trim()) {
      ipcRenderer.send('log:write', line);
    } else {
      console.warn('[Preload] Geçersiz log verisi gönderilmeye çalışıldı:', line);
    }
  }
});

/* -----------------------------
   Python Tahmin API Köprüsü
----------------------------- */
contextBridge.exposeInMainWorld('api', {
  /**
   * Canlı veriyi Python model API'sine gönderip tahmin sonucu döndürür
   * @param {Object} data - Tek satır canlı veri
   * @returns {Promise<{prediction:number, probability:number}>}
   */
  predict: (data) => ipcRenderer.invoke('predict', data)
});
