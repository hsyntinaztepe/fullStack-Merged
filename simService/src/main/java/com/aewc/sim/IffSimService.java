package com.aewc.sim;

import com.mongodb.client.*;

import java.util.concurrent.TimeUnit;

import org.bson.Document;

public class IffSimService implements Runnable {
    private static final long PERIOD_MS = TimeUnit.SECONDS.toMillis(30);
    @Override
    public void run() {
        try (MongoClient mongoClient = MongoClients.create("mongodb://localhost:27017")) {
            MongoDatabase db = mongoClient.getDatabase("aewc");
            MongoCollection<Document> iffCol = db.getCollection("iff");

            while (true) {
                for (Aircraft ac : AircraftGenerator.getAircrafts()) {
                    Document doc = new Document("lat", ac.lat).append("lon", ac.lon)
                            .append("callsign", ac.callsign)
                            .append("status", ac.affiliation);
                    iffCol.insertOne(doc);
                }
                Thread.sleep(PERIOD_MS);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
