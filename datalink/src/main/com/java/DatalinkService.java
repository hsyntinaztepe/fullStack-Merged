package main.com.java;

import datalink.DatalinkServiceGrpc;
import datalink.DatalinkTrack;
import datalink.GetTrackRequest;
import datalink.GetTrackResponse;
import datalink.ListTracksRequest;
import datalink.ListTracksResponse;
import datalink.SetManualIdentificationRequest;
import datalink.SetManualIdentificationResponse;
import datalink.Identification;
import datalink.IdentificationSource;

import radar.Radar;
import radar.RadarServiceGrpc;

import iff.Iff;
import iff.IFFServiceGrpc;

import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.stub.StreamObserver;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class DatalinkService extends DatalinkServiceGrpc.DatalinkServiceImplBase {

    // Stockage en mémoire des pistes fusionnées
    private final Map<String, DatalinkTrack> tracks = new ConcurrentHashMap<>();

    public DatalinkService() {
        // Connexion aux services Radar et IFF
        startRadarStream("localhost", 50051);
        startIffStream("localhost", 50053);
    }

    private void startRadarStream(String host, int port) {
        ManagedChannel channel = ManagedChannelBuilder.forAddress(host, port).usePlaintext().build();
        RadarServiceGrpc.RadarServiceStub stub = RadarServiceGrpc.newStub(channel);

        Radar.StreamRequest req = Radar.StreamRequest.newBuilder()
                .setRefreshIntervalMs(1000)
                .build();

        stub.streamRadarTargets(req, new StreamObserver<Radar.RadarTarget>() {
            @Override
            public void onNext(Radar.RadarTarget rt) {
                // Création ou mise à jour de la piste
                DatalinkTrack.Builder b = tracks.containsKey(rt.getId())
                        ? tracks.get(rt.getId()).toBuilder()
                        : DatalinkTrack.newBuilder().setTrackId(rt.getId());

                b.setLatitude(rt.getLat())
                 .setLongitude(rt.getLon())
                 .setAltitudeM(rt.getBaroAltitude() != 0 ? rt.getBaroAltitude() : rt.getGeoAltitude())
                 .setSpeed(rt.getVelocity())
                 .setHeading(rt.getHeading())
                 .setPlatform(rt.getIsFighter() ? "fighter" : "")
                 .setUpdatedAt(System.currentTimeMillis());

                tracks.put(rt.getId(), b.build());
            }

            @Override public void onError(Throwable t) { t.printStackTrace(); }
            @Override public void onCompleted() { }
        });
    }

    private void startIffStream(String host, int port) {
        ManagedChannel channel = ManagedChannelBuilder.forAddress(host, port).usePlaintext().build();
        IFFServiceGrpc.IFFServiceStub stub = IFFServiceGrpc.newStub(channel);

        Iff.IFFRequest req = Iff.IFFRequest.newBuilder().build();

        stub.streamIFFData(req, new StreamObserver<Iff.IFFStreamResponse>() {
            @Override
            public void onNext(Iff.IFFStreamResponse resp) {
                Iff.IFFData d = resp.getData();
                if (!tracks.containsKey(d.getId())) {
                    // On ignore si pas encore de données radar
                    return;
                }
                DatalinkTrack.Builder b = tracks.get(d.getId()).toBuilder();
                b.setCallsign(d.getCallsign())
                 .setLatitude(d.getLat())
                 .setLongitude(d.getLon())
                 .setIdentification(mapStatus(d.getStatus()))
                 .setIdentificationSource(IdentificationSource.IDENT_SRC_IFF)
                 .setUpdatedAt(System.currentTimeMillis());

                tracks.put(d.getId(), b.build());
            }

            @Override public void onError(Throwable t) { t.printStackTrace(); }
            @Override public void onCompleted() { }
        });
    }

    private Identification mapStatus(String status) {
        if (status == null) return Identification.IDENTIFICATION_UNKNOWN;
        return switch (status.toLowerCase()) {
            case "friend", "friendly" -> Identification.IDENTIFICATION_FRIEND;
            case "foe", "hostile", "enemy" -> Identification.IDENTIFICATION_FOE;
            case "neutral" -> Identification.IDENTIFICATION_NEUTRAL;
            default -> Identification.IDENTIFICATION_UNKNOWN;
        };
    }

    // RPC GetTrack
    @Override
    public void getTrack(GetTrackRequest request, StreamObserver<GetTrackResponse> responseObserver) {
        DatalinkTrack track = tracks.get(request.getTrackId());
        GetTrackResponse resp = GetTrackResponse.newBuilder()
                .setTrack(track != null ? track : DatalinkTrack.getDefaultInstance())
                .build();
        responseObserver.onNext(resp);
        responseObserver.onCompleted();
    }

    // RPC ListTracks
    @Override
    public void listTracks(ListTracksRequest request, StreamObserver<ListTracksResponse> responseObserver) {
        ListTracksResponse resp = ListTracksResponse.newBuilder()
                .addAllTracks(tracks.values())
                .build();
        responseObserver.onNext(resp);
        responseObserver.onCompleted();
    }

    // RPC SetManualIdentification
    @Override
    public void setManualIdentification(SetManualIdentificationRequest request,
                                        StreamObserver<SetManualIdentificationResponse> responseObserver) {
        DatalinkTrack existing = tracks.get(request.getTrackId());
        if (existing != null) {
            DatalinkTrack updated = existing.toBuilder()
                    .setIdentification(request.getIdentification())
                    .setIdentificationSource(IdentificationSource.IDENT_SRC_MANUAL)
                    .setUpdatedAt(System.currentTimeMillis())
                    .build();
            tracks.put(request.getTrackId(), updated);
            responseObserver.onNext(SetManualIdentificationResponse.newBuilder().setTrack(updated).build());
        } else {
            responseObserver.onNext(SetManualIdentificationResponse.newBuilder().build());
        }
        responseObserver.onCompleted();
    }
}
