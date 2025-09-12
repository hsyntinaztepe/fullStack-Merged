package com.aewc.sim;

import com.mongodb.client.*;
import org.bson.Document;

public class IffSimService implements Runnable {
    @Override
    public void run() {
        try (MongoClient mongoClient = MongoClients.create("mongodb://localhost:27017")) {
            MongoDatabase db = mongoClient.getDatabase("aewc");
            MongoCollection<Document> iffCol = db.getCollection("iff");

            while (true) {
                for (Aircraft ac : AircraftGenerator.getAircrafts()) {
                    Document doc = new Document("lat", ac.lat).append("lon", ac.lon)
                            .append("callsign", ac.callsign)
                            .append("affiliation", ac.affiliation);
                    iffCol.insertOne(doc);
                }
                Thread.sleep(2000);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
