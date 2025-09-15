import { app, ipcMain, BrowserWindow } from 'electron';
import { createWindow } from './window.js';
import './grpcClient.js';
import './radarStream.js';
import './iffStream.js';
import { cleanup } from './cleanup.js';
import fs from 'fs';
import path from 'path';
import axios from 'axios'; // <-- API çağrısı için

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', cleanup);

// Log dosyası
const logFilePath = path.join(app.getPath('userData'), 'logs.csv');

ipcMain.on('log:write', (event, line) => {
  fs.appendFile(logFilePath, line + '\n', 'utf8', (err) => {
    if (err) console.error('[log:write] Yazılamadı:', err);
  });
});

// --- Python API tahmin isteği ---
ipcMain.handle('predict', async (event, liveData) => {
  try {
    const res = await axios.post('http://localhost:5000/predict', liveData);
    return res.data; // { prediction: 0/1, probability: 0.xx }
  } catch (err) {
    console.error('[predict] API hatası:', err.message);
    return { error: err.message };
  }
});
