package com.aewc.sim;

import com.mongodb.client.*;
import org.bson.Document;

import java.util.concurrent.TimeUnit;

public class DataLinkService implements Runnable {
    private static final long PERIOD_MS = TimeUnit.SECONDS.toMillis(10);

    @Override
    public void run() {
        try (MongoClient mongoClient = MongoClients.create("mongodb://localhost:27017")) {
            MongoDatabase db = mongoClient.getDatabase("aewc");
            MongoCollection<Document> dlCol = db.getCollection("datalink");

            while (true) {
                for (Aircraft ac : AircraftGenerator.getAircrafts()) {
                    Document doc = new Document("callsign", ac.callsign)
                            .append("status", ac.affiliation)
                            .append("lat", ac.lat)
                            .append("lon", ac.lon)
                            .append("velocity", ac.velocity)
                            .append("baroaltitude", ac.baroaltitude)
                            .append("geoaltitude", ac.geoaltitude)
                            .append("timestamp", System.currentTimeMillis());

                    dlCol.insertOne(doc);
                }
                Thread.sleep(PERIOD_MS);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
