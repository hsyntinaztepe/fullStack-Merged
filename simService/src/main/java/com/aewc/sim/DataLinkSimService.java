package com.aewc.sim;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import org.bson.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;

public class DataLinkSimService implements Runnable {

    private static final int PERIOD_MS = 30_000;
    private final ScheduledExecutorService exec;
    private final MongoCollection<Document> collection;

    public DataLinkSimService() {
        this.exec = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "datalink-sim");
            t.setDaemon(true);
            return t;
        });
        MongoDatabase db = MongoClientProvider.getClient().getDatabase("aewc");
        this.collection = db.getCollection("datalink_tracks");
    }

    @Override
    public void run() {
        exec.scheduleAtFixedRate(this::produceSnapshot, 0, PERIOD_MS, TimeUnit.MILLISECONDS);
    }

    // Produce a batch document list from current aircraft snapshot and insert once.
    private void produceSnapshot() {
        List<Aircraft> snapshot = AircraftGenerator.getAircrafts(); // immutable snapshot
        if (snapshot.isEmpty()) return;

        Instant now = Instant.now();
        List<Document> batch = new ArrayList<>(snapshot.size());

        for (Aircraft ac : snapshot) {
            Document d = new Document("callsign", ac.callsign)
                    .append("affiliation", ac.affiliation)
                    .append("latitude", ac.lat)
                    .append("longitude", ac.lon)
                    .append("velocity", ac.velocity)
                    .append("baroAltitude", ac.baroaltitude)
                    .append("geoAltitude", ac.geoaltitude)
                    .append("timestamp", now.toEpochMilli());
            batch.add(d);
        }

        if (!batch.isEmpty()) {
            collection.insertMany(batch);
        }
    }

    // stop scheduler gracefully
    public void stop() {
        exec.shutdownNow();
    }
}
