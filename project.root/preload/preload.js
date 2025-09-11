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
contextBridge.exposeInMainWorld('radar', createStreamAPI('radar'));
contextBridge.exposeInMainWorld('iff', createStreamAPI('iff'));

contextBridge.exposeInMainWorld('geo', {
  open: () => ipcRenderer.invoke('geo:open'),
  save: (payload) => ipcRenderer.invoke('geo:save', payload)
});

contextBridge.exposeInMainWorld('electronDebug', {
  log: (...args) => console.log('[Renderer]', ...args),
  error: (...args) => console.error('[Renderer]', ...args)
});
