import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Radar proto yükleme
const radarPackageDef = protoLoader.loadSync(
  path.join(__dirname, '../proto/radar.proto'),
  { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true }
);
const radarGrpcObj = grpc.loadPackageDefinition(radarPackageDef);

export const radarClient = new radarGrpcObj.radar.RadarService(
  'localhost:50053',
  grpc.credentials.createInsecure()
);

// IFF proto yükleme
const iffPackageDef = protoLoader.loadSync(
  path.join(__dirname, '../proto/iff.proto'),
  { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true }
);
const iffGrpcObj = grpc.loadPackageDefinition(iffPackageDef);

export const iffClient = new iffGrpcObj.iff.IFFService(
  'localhost:50051', // IFF servisin çalıştığı port
  grpc.credentials.createInsecure()
);
