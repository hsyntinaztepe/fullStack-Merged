import { ipcMain } from 'electron';
import { datalinkClient } from './grpcClient.js';

let activeDataLinkStream = null;

ipcMain.on('datalink:startStream', (event, args) => {
  if (activeDataLinkStream) {
    try { activeDataLinkStream.cancel(); } catch {}
    activeDataLinkStream = null;
  }

  const request = {
    lat: args?.lat ?? 0,
    lon: args?.lon ?? 0,
    radius_km: args?.radius_km ?? 0
  };

  const call = datalinkClient.StreamDataLink(request);
  activeDataLinkStream = call;

  call.on('data', (resp) => {
    console.log('[DATALINK STREAM] Data:', resp.data);
    event.sender.send('datalink:streamData', resp.data);
  });

  call.on('end', () => {
    console.log('[DATALINK STREAM] End of stream');
    event.sender.send('datalink:streamEnd');
    activeDataLinkStream = null;
  });

  call.on('error', (err) => {
    console.error('[DATALINK STREAM] Error:', err?.message || String(err));
    event.sender.send('datalink:streamError', err?.message || String(err));
    activeDataLinkStream = null;
  });
});

ipcMain.on('datalink:stopStream', (event) => {
  if (activeDataLinkStream) {
    try { activeDataLinkStream.cancel(); } catch {}
    activeDataLinkStream = null;
    console.log('[DATALINK STREAM] Stopped by client');
    event.sender.send('datalink:streamStopped');
  }
});

export function stopActiveDataLinkStream() {
  if (activeDataLinkStream) {
    try { activeDataLinkStream.cancel(); } catch {}
    activeDataLinkStream = null;
    console.log('[DATALINK STREAM] Stopped programmatically');
  }
}
