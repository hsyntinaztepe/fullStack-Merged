import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';

import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let radarClient;
let activeStream = null;
let batchTimer = null;
let isQuitting = false;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

function broadcast(channel, payload) {
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send(channel, payload);
  });
}

function stopActiveStream() {
  if (activeStream) {
    try { activeStream.cancel(); } catch {}
    activeStream = null;
  }
  if (batchTimer) {
    clearInterval(batchTimer);
    batchTimer = null;
  }
}

app.whenReady().then(() => {
  const packageDef = protoLoader.loadSync(
    path.join(__dirname, 'proto/radar.proto'),
    { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true }
  );
  const grpcObj = grpc.loadPackageDefinition(packageDef);
  radarClient = new grpcObj.radar.RadarService(
    'localhost:50053',
    grpc.credentials.createInsecure()
  );

  createWindow();
});

app.on('before-quit', () => {
  isQuitting = true;
  stopActiveStream();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// 📡 Stream başlat
ipcMain.on('radar:startStream', (_event, args) => {
  // Önce varsa eski stream'i kapat
  stopActiveStream();

  const interval = args?.interval || 1000;
  const filter = args?.filter || '';

  let currentBatch = [];

  activeStream = radarClient.StreamRadarTargets({
    refresh_interval_ms: interval,
    filter
  });

  const flushBatch = () => {
    if (currentBatch.length > 0) {
      broadcast('radar:targetBatch', currentBatch);
      currentBatch = [];
    }
  };

  activeStream.on('data', (target) => {
    currentBatch.push(target);
  });

  batchTimer = setInterval(flushBatch, interval);

  activeStream.on('end', () => {
    flushBatch();
    stopActiveStream();
    if (!isQuitting) {
      console.log('Radar stream ended by server, reconnecting...');
      setTimeout(() => ipcMain.emit('radar:startStream', null, { interval, filter }), 2000);
    }
  });

  activeStream.on('error', (err) => {
    if (err?.code === grpc.status.CANCELLED) {
      console.log('Radar stream client tarafından iptal edildi (normal).');
      flushBatch();
      stopActiveStream();
      return; // ❗ Client iptalinde reconnect yapma
    }
    console.error('Radar stream error:', err);
    flushBatch();
    stopActiveStream();
    if (!isQuitting) {
      console.log('Radar stream error sonrası reconnect...');
      setTimeout(() => ipcMain.emit('radar:startStream', null, { interval, filter }), 2000);
    }
  });
});

// 🛑 Stream durdur
ipcMain.on('radar:stopStream', () => {
  stopActiveStream();
});

// 📋 Unary çağrı
ipcMain.handle('radar:getTargets', async () => {
  return new Promise((resolve, reject) => {
    radarClient.GetRadarTargets({}, (err, response) => {
      if (err) return reject(err);
      resolve(response.targets);
    });
  });
});

// 📂 GeoJSON aç
ipcMain.handle('geo:open', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'GeoJSON yükle',
    filters: [{ name: 'GeoJSON', extensions: ['geojson', 'json'] }],
    properties: ['openFile']
  });
  if (canceled || !filePaths?.[0]) return { ok: false, reason: 'canceled' };
  try {
    const raw = await fs.readFile(filePaths[0], 'utf8');
    return { ok: true, data: raw, path: filePaths[0] };
  } catch (err) {
    return { ok: false, reason: String(err) };
  }
});

// 💾 GeoJSON kaydet
ipcMain.handle('geo:save', async (_evt, payload) => {
  const { suggestedName = 'data.geojson', content } = payload || {};
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'GeoJSON kaydet',
    defaultPath: suggestedName,
    filters: [{ name: 'GeoJSON', extensions: ['geojson', 'json'] }]
  });
  if (canceled || !filePath) return { ok: false, reason: 'canceled' };

  try {
    await fs.writeFile(filePath, content, 'utf8');
    return { ok: true, path: filePath };
  } catch (err) {
    return { ok: false, reason: String(err) };
  }
});
