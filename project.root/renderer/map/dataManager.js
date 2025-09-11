// dataManager.js - Radar ve IFF verilerini birleştirme yöneticisi

class DataManager {
  constructor() {
    this.radarTracks = new Map(); // radarId -> radar data
    this.iffTracks = new Map();   // iffId -> IFF data  
    this.combinedTracks = new Map(); // trackId -> combined data
    this.callbacks = new Set(); // değişiklik callback'leri
  }

  // Radar verisi güncellemesi
  updateRadarTrack(radarData) {
    const trackId = this.generateTrackId(radarData);
    this.radarTracks.set(radarData.id || trackId, radarData);
    this.updateCombinedTrack(trackId);
  }

  // IFF verisi güncellemesi  
  updateIFFTrack(iffData) {
    const trackId = this.generateTrackId(iffData);
    this.iffTracks.set(iffData.id || trackId, iffData);
    this.updateCombinedTrack(trackId);
  }

  // Track ID oluşturma (konum bazlı korelasyon)
  generateTrackId(data) {
    if (data.id) return data.id;
    
    // Konum bazlı ID oluşturma (yakın konumdaki veriler aynı track olarak kabul edilir)
    const lat = Math.round((data.latitude || data.lat || 0) * 1000) / 1000;
    const lon = Math.round((data.longitude || data.lon || 0) * 1000) / 1000;
    return `track_${lat}_${lon}`;
  }

  // Birleştirilmiş track güncelleme
  updateCombinedTrack(trackId) {
    // İlgili radar ve IFF verilerini bul
    let radarData = null;
    let iffData = null;

    // Track ID'si ile eşleşen verileri ara
    for (const [id, data] of this.radarTracks) {
      if (this.generateTrackId(data) === trackId) {
        radarData = data;
        break;
      }
    }

    for (const [id, data] of this.iffTracks) {
      if (this.generateTrackId(data) === trackId) {
        iffData = data;
        break;
      }
    }

    // Konum bazlı korelasyon (yakın konumdaki veriler)
    if (!radarData || !iffData) {
      const tolerance = 0.01; // ~1km tolerans
      
      if (radarData && !iffData) {
        iffData = this.findNearbyTrack(radarData, this.iffTracks, tolerance);
      } else if (iffData && !radarData) {
        radarData = this.findNearbyTrack(iffData, this.radarTracks, tolerance);
      }
    }

    // Birleştirilmiş veri oluştur
    const combined = this.combineTrackData(trackId, radarData, iffData);
    
    if (combined) {
      this.combinedTracks.set(trackId, combined);
      this.notifyCallbacks(trackId, combined);
    }
  }

  // Yakın konum araması
  findNearbyTrack(sourceData, targetTracks, tolerance) {
    const sourceLat = sourceData.latitude || sourceData.lat || 0;
    const sourceLon = sourceData.longitude || sourceData.lon || 0;

    for (const [id, data] of targetTracks) {
      const targetLat = data.latitude || data.lat || 0;
      const targetLon = data.longitude || data.lon || 0;
      
      const latDiff = Math.abs(sourceLat - targetLat);
      const lonDiff = Math.abs(sourceLon - targetLon);
      
      if (latDiff <= tolerance && lonDiff <= tolerance) {
        return data;
      }
    }
    return null;
  }

  // Veri birleştirme
  combineTrackData(trackId, radarData, iffData) {
    if (!radarData && !iffData) return null;

    const combined = {
      id: trackId,
      timestamp: Date.now(),
      
      // Koordinatlar (radar öncelikli)
      latitude: (radarData?.latitude || radarData?.lat) || 
                (iffData?.latitude || iffData?.lat) || 0,
      longitude: (radarData?.longitude || radarData?.lon) || 
                 (iffData?.longitude || iffData?.lon) || 0,
      
      // Radar verileri
      radarId: radarData?.id || null,
      radarStatus: radarData?.status || null,
      altitude: radarData?.altitude || null,
      speed: radarData?.speed || null,
      heading: radarData?.heading || null,
      radarRange: radarData?.range || null,
      radarBearing: radarData?.bearing || null,
      
      // IFF verileri
      iffId: iffData?.id || null,
      iffCode: iffData?.code || null,
      iffMode: iffData?.mode || null,
      iffStatus: iffData?.status || null,
      callSign: iffData?.callSign || null,
      aircraftType: iffData?.aircraftType || null,
      
      // Birleşik durumlar
      hasRadar: !!radarData,
      hasIFF: !!iffData,
      dataSource: radarData && iffData ? 'BOTH' : 
                  radarData ? 'RADAR' : 'IFF'
    };

    return combined;
  }

  // Değişiklik callback'i ekleme
  onChange(callback) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  // Callback'leri bilgilendir
  notifyCallbacks(trackId, data) {
    this.callbacks.forEach(callback => {
      try {
        callback(trackId, data);
      } catch (error) {
        console.error('DataManager callback error:', error);
      }
    });
  }

  // Belirli track'i al
  getTrack(trackId) {
    return this.combinedTracks.get(trackId);
  }

  // Tüm track'leri al
  getAllTracks() {
    return Array.from(this.combinedTracks.values());
  }

  // Track'i sil
  removeTrack(trackId) {
    this.combinedTracks.delete(trackId);
    this.notifyCallbacks(trackId, null); // null = silindi
  }

  // Temizlik
  clear() {
    this.radarTracks.clear();
    this.iffTracks.clear();
    this.combinedTracks.clear();
  }
}

// Global instance
export const dataManager = new DataManager();