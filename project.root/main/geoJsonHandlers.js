import { ipcMain, dialog } from 'electron';
import fs from 'node:fs/promises';

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
