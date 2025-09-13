import { app, ipcMain, BrowserWindow } from 'electron';
import { createWindow } from './window.js';
import './grpcClient.js';       // gRPC client tanımı
import './radarStream.js';  
import './iffStream.js'; 
import { cleanup } from './cleanup.js';
import fs from 'fs';
import path from 'path';

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', cleanup);

// Log dosyasını userData klasörüne yaz
const logFilePath = path.join(app.getPath('userData'), 'logs.csv');

ipcMain.on('log:write', (event, line) => {
  fs.appendFile(logFilePath, line + '\n', 'utf8', (err) => {
    if (err) console.error('[log:write] Yazılamadı:', err);
  });
});
