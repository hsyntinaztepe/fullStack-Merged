package com.aewc.sim;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;

/**
 * Thread-safe MongoClient provider.
 * URI can be set with env var AEWC_MONGO_URI, default jdbc-style used if absent.
 */
public final class MongoClientProvider {
    private static final String DEFAULT_URI = "mongodb://localhost:27017";
    private static volatile MongoClient client;

    private MongoClientProvider() {}

    public static MongoClient getClient() {
        if (client == null) {
            synchronized (MongoClientProvider.class) {
                if (client == null) {
                    String uri = System.getenv("AEWC_MONGO_URI");
                    if (uri == null || uri.isBlank()) uri = DEFAULT_URI;
                    client = MongoClients.create(uri);
                    // register shutdown hook once
                    Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                        try {
                            if (client != null) client.close();
                        } catch (Throwable ignored) {}
                    }, "mongo-client-shutdown"));
                }
            }
        }
        return client;
    }

    /**
     * Optional explicit close for tests or controlled lifecycle.
     * After close, next getClient() will create a new instance.
     */
    public static void closeClient() {
        synchronized (MongoClientProvider.class) {
            if (client != null) {
                try {
                    client.close();
                } finally {
                    client = null;
                }
            }
        }
    }
}
