import { ipcMain } from 'electron';
import { radarClient } from './grpcClient.js';

let activeStream = null;

ipcMain.on('radar:startStream', (event, args) => {
  if (activeStream) {
    try { activeStream.cancel(); } catch {}
    activeStream = null;
  }

  const refreshMs = args?.refresh_interval_ms ?? 1000;

  const call = radarClient.StreamRadarTargets({
    refresh_interval_ms: refreshMs
  });

  activeStream = call;

  call.on('data', (target) => {

    event.sender.send('radar:streamData', target);
  });

  call.on('end', () => {
    console.log('[STREAM] Stream ended by server.');
    event.sender.send('radar:streamEnd');
    activeStream = null;
  });

  call.on('error', (err) => {
    console.error('[STREAM] Error:', err?.message || String(err));
    event.sender.send('radar:streamError', err?.message || String(err));
    activeStream = null;
  });
});

ipcMain.on('radar:stopStream', (event) => {
  if (activeStream) {
    try { activeStream.cancel(); } catch {}
    console.log('[STREAM] Stream stopped by client.');
    activeStream = null;
    event.sender.send('radar:streamStopped');
  }
});

export function stopActiveStream() {
  if (activeStream) {
    try { activeStream.cancel(); } catch {}
    console.log('[STREAM] Stream stopped programmatically.');
    activeStream = null;
  }
}
