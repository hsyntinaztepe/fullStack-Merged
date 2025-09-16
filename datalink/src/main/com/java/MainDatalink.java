package main.com.java;
import io.grpc.Server;
import io.grpc.ServerBuilder;

public class MainDatalink {

    public static void main(String[] args) {
        // Paramètres de configuration
        final String serverAddress = "0.0.0.0";
        final int serverPort       = 50053;
        final String mongoUri      = "mongodb://localhost:27017";
        final String dbName        = "aewc";
        final String collName      = "datalink";

        try {
            // Instanciation de ton service gRPC avec Mongo
            DatalinkService service = new DatalinkService(mongoUri, dbName, collName);

            // Construction du serveur gRPC
            Server server = ServerBuilder
                    .forPort(serverPort)
                    .addService(service)
                    .build();

            // Démarrage
            server.start();

            System.out.printf("[INFO] Datalink Service listening on %s:%d%n", serverAddress, serverPort);
            System.out.printf("[INFO] MongoDB: %s / %s.%s%n", mongoUri, dbName, collName);
            System.out.println("[INFO] CTRL+C pour arrêter le service.");

            // Attente indéfinie
            server.awaitTermination();

        } catch (Exception e) {
            System.err.println("[ERROR] Impossible de démarrer le serveur : " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }
}
