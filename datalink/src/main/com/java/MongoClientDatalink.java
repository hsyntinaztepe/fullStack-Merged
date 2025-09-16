package main.com.java;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;

public final class MongoClientDatalink {

    private static final String DEFAULT_URI = "mongodb://localhost:27017";
    private static volatile MongoClient client;

    private MongoClientDatalink() {
    }

    public static MongoClient getClient() {
        if (client == null) {
            synchronized (MongoClientDatalink.class) {
                if (client == null) {
                    String uri = System.getenv("DATALINK_MONGO_URI");
                    if (uri == null || uri.isBlank()) {
                        uri = DEFAULT_URI;
                    }
                    client = MongoClients.create(uri);

                    Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                        try {
                            if (client != null) {
                                client.close();
                            }
                        } catch (Throwable ignored) {}
                    }, "mongo-client-datalink-shutdown"));
                }
            }
        }
        return client;
    }

    public static void closeClient() {
        synchronized (MongoClientDatalink.class) {
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
