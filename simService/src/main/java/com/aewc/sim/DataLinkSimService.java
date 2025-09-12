package com.aewc.sim;

import com.mongodb.client.*;
import org.bson.Document;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;

public class DataLinkSimService implements Runnable {

    private static final int TRACK_COUNT = 30;
    private static final long PERIOD_MS = 30_000L;
    private final List<TrackState> tracks = new ArrayList<>();
    private final Random rand = new Random();
    private final MongoCollection<Document> collection;

    public DataLinkSimService() {
        MongoClient mongoClient = MongoClients.create("mongodb://localhost:27017");
        MongoDatabase db = mongoClient.getDatabase("aewc_sim");
        collection = db.getCollection("datalink_tracks");

        for (int i = 0; i < TRACK_COUNT; i++) {
            tracks.add(new TrackState(
                TurkeyGeo.randomCallsign(i),
                rand.nextBoolean() ? "FRIEND" : "FOE",
                TurkeyGeo.randomLat(),
                TurkeyGeo.randomLon(),
                rand.nextDouble() * 360,
                TurkeyGeo.randomVelocity(),
                TurkeyGeo.randomAltitude(),
                TurkeyGeo.randomAltitude()
            ));
        }
    }

    @Override
    public void run() {
        ScheduledExecutorService exec = Executors.newSingleThreadScheduledExecutor();
        exec.scheduleAtFixedRate(() -> {
            Instant now = Instant.now();
            for (TrackState t : tracks) {
                t.move();
                Document doc = new Document("callsign", t.callsign)
                        .append("affiliation", t.affiliation)
                        .append("latitude", t.lat)
                        .append("longitude", t.lon)
                        .append("velocity", t.velocity)
                        .append("baroAltitude", t.baroAlt)
                        .append("geoAltitude", t.geoAlt)
                        .append("timestamp", now.toEpochMilli());
                collection.insertOne(doc);
            }
        }, 0, PERIOD_MS, TimeUnit.MILLISECONDS);
    }

    private class TrackState {
        String callsign, affiliation;
        double lat, lon, heading, velocity, baroAlt, geoAlt;

        TrackState(String callsign, String affiliation, double lat, double lon,
                   double heading, double velocity, double baroAlt, double geoAlt) {
            this.callsign = callsign;
            this.affiliation = affiliation;
            this.lat = lat;
            this.lon = lon;
            this.heading = heading;
            this.velocity = velocity;
            this.baroAlt = baroAlt;
            this.geoAlt = geoAlt;
        }

        void move() {
            heading += (rand.nextDouble() - 0.5) * 3.0;
            double dist = velocity * (PERIOD_MS / 1000.0);
            double dLat = (dist * Math.cos(Math.toRadians(heading))) / 111_320.0;
            double dLon = (dist * Math.sin(Math.toRadians(heading))) / (111_320.0 * Math.cos(Math.toRadians(lat)));
            lat += dLat;
            lon += dLon;
        }
    }
}
