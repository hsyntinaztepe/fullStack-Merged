// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('radar', {
  /**
   * Unary çağrı: mevcut radar hedeflerini al
   * @returns {Promise<Array>}
   */
  getTargets: () => ipcRenderer.invoke('radar:getTargets'),

  /**
   * Stream başlat
   * @param {number|object} args - interval (ms) veya { interval, filter }
   */
  startStream: (args) => {
    const payload = (typeof args === 'number')
      ? { interval: args }
      : (args && typeof args === 'object' ? args : {});
    ipcRenderer.send('radar:startStream', payload);
  },

  /**
   * Stream durdur
   */
  stopStream: () => {
    ipcRenderer.send('radar:stopStream');
  },

  /**
   * Batch dinleyici: tüm hedefler tek seferde gelir
   * @param {(targets:Array) => void} callback
   * @returns {() => void} unsubscribe fonksiyonu
   */
  onTargetBatch: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_evt, targets) => {
      try { callback(targets); } catch (err) { console.error(err); }
    };
    ipcRenderer.on('radar:targetBatch', listener);
    return () => ipcRenderer.removeListener('radar:targetBatch', listener);
  },

  /**
   * Geriye dönük uyumluluk: batch'i tek tek hedef event'lerine çevir
   * @param {(target:Object) => void} callback
   * @returns {() => void} unsubscribe fonksiyonu
   */
  onTargetUpdate: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_evt, targets) => {
      try {
        if (Array.isArray(targets)) {
          for (const t of targets) callback(t);
        }
      } catch (err) {
        console.error(err);
      }
    };
    ipcRenderer.on('radar:targetBatch', listener);
    return () => ipcRenderer.removeListener('radar:targetBatch', listener);
  }
});

contextBridge.exposeInMainWorld('geo', {
  open: () => ipcRenderer.invoke('geo:open'),
  save: (payload) => ipcRenderer.invoke('geo:save', payload)
});
