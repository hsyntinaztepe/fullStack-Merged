import { app, ipcMain, BrowserWindow } from 'electron';
import { createWindow } from './window.js';
import './grpcClient.js';
import './radarStream.js';
import './iffStream.js';
import { cleanup } from './cleanup.js';
import fs from 'fs';
import path from 'path';
import axios from 'axios'; 

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', cleanup);


const logFilePath = path.join(app.getPath('userData'), 'logs.csv');

ipcMain.handle('predict', async (event, liveData) => {
  try {
    const res = await axios.post('http://localhost:5000/predict', liveData);
    return res.data;
  } catch (err) {
    console.error('[predict] API hatası:', err.message);
    return { error: err.message };
  }
});
