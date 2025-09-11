// iffStream.js
import { ipcMain } from 'electron';
import { iffClient } from './grpcClient.js'; // radarClient gibi, IFF için tanımlı olmalı

let activeIFFStream = null;

ipcMain.on('iff:startStream', (event, args) => {
  // Önce varsa aktif stream'i kapat
  if (activeIFFStream) {
    try { activeIFFStream.cancel(); } catch {}
    activeIFFStream = null;
  }

  // Proto'ya uygun request parametreleri
  const request = {
    lat: args?.lat ?? 0,            // Merkez enlem (opsiyonel)
    lon: args?.lon ?? 0,            // Merkez boylam (opsiyonel)
    radius_km: args?.radius_km ?? 0 // Yarıçap km (opsiyonel)
  };

  // gRPC stream başlat
  const call = iffClient.StreamIFFData(request);
  activeIFFStream = call;

  // Veri geldiğinde
  call.on('data', (resp) => {
    // Konsola bas (gelen tüm alanlar)
    console.log('[IFF STREAM]', {
      status: resp.data?.status,
      lat: resp.data?.lat,
      lon: resp.data?.lon,
      callsign: resp.data?.callsign
    });

    // Renderer'a gönder
    event.sender.send('iff:streamData', resp.data);
  });

  // Stream bittiğinde
  call.on('end', () => {
    console.log('[IFF STREAM] End of stream');
    event.sender.send('iff:streamEnd');
    activeIFFStream = null;
  });

  // Hata olduğunda
  call.on('error', (err) => {
    console.error('[IFF STREAM] Error:', err?.message || String(err));
    event.sender.send('iff:streamError', err?.message || String(err));
    activeIFFStream = null;
  });
});

// Stream'i durdurma isteği
ipcMain.on('iff:stopStream', (event) => {
  if (activeIFFStream) {
    try { activeIFFStream.cancel(); } catch {}
    activeIFFStream = null;
    console.log('[IFF STREAM] Stopped by client');
    event.sender.send('iff:streamStopped');
  }
});

// Dışarıdan da durdurabilmek için
export function stopActiveIFFStream() {
  if (activeIFFStream) {
    try { activeIFFStream.cancel(); } catch {}
    activeIFFStream = null;
    console.log('[IFF STREAM] Stopped programmatically');
  }
}
