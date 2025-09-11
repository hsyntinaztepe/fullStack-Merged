import { app } from 'electron';
import { createWindow } from './window.js';
import './grpcClient.js';       // gRPC client tanımı
import './radarStream.js';  
import './iffStream.js'; 
import { cleanup } from './cleanup.js';

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  const { BrowserWindow } = require('electron');
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', cleanup);
