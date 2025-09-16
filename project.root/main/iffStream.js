
import { ipcMain } from 'electron';
import { iffClient } from './grpcClient.js'; 

let activeIFFStream = null;

ipcMain.on('iff:startStream', (event, args) => {
  
  if (activeIFFStream) {
    try { activeIFFStream.cancel(); } catch {}
    activeIFFStream = null;
  }


  const request = {
    lat: args?.lat ?? 0,            
    lon: args?.lon ?? 0,            
    radius_km: args?.radius_km ?? 0 
  };


  const call = iffClient.StreamIFFData(request);
  activeIFFStream = call;


  call.on('data', (resp) => {
    
    console.log('[IFF STREAM]', {
      id: resp.data?.id,
      status: resp.data?.status,
      lat: resp.data?.lat,
      lon: resp.data?.lon,
      callsign: resp.data?.callsign
    });



    event.sender.send('iff:streamData', resp.data);
  });


  call.on('end', () => {
    console.log('[IFF STREAM] End of stream');
    event.sender.send('iff:streamEnd');
    activeIFFStream = null;
  });


  call.on('error', (err) => {
    console.error('[IFF STREAM] Error:', err?.message || String(err));
    event.sender.send('iff:streamError', err?.message || String(err));
    activeIFFStream = null;
  });
});


ipcMain.on('iff:stopStream', (event) => {
  if (activeIFFStream) {
    try { activeIFFStream.cancel(); } catch {}
    activeIFFStream = null;
    console.log('[IFF STREAM] Stopped by client');
    event.sender.send('iff:streamStopped');
  }
});


export function stopActiveIFFStream() {
  if (activeIFFStream) {
    try { activeIFFStream.cancel(); } catch {}
    activeIFFStream = null;
    console.log('[IFF STREAM] Stopped programmatically');
  }
}
