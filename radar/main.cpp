#include "radarservice.h"
#include <grpcpp/grpcpp.h>
#include <iostream>
#include <memory>
#include <string>

int main() {
    // Sunucu ve Mongo ayarları (gerekirse değiştir)
    const std::string server_address = "0.0.0.0:50053";
    const std::string mongo_uri      = "mongodb://localhost:27017";
    const std::string db_name        = "microservices";
    const std::string coll_name      = "radar";

    try {
        // Servis örneğini oluştur (Mongo parametreleri ile)
        RadarServiceImpl service(mongo_uri, db_name, coll_name);

        // gRPC sunucusunu başlat
        grpc::ServerBuilder builder;
        builder.AddListeningPort(server_address, grpc::InsecureServerCredentials());
        builder.RegisterService(&service);

        std::unique_ptr<grpc::Server> server(builder.BuildAndStart());
        if (!server) {
            std::cerr << "[ERROR] gRPC server başlatılamadı." << std::endl;
            return EXIT_FAILURE;
        }

        std::cout << "[INFO] Radar Service listening on " << server_address << std::endl;
        std::cout << "[INFO] MongoDB: " << mongo_uri << " / " << db_name << "." << coll_name << std::endl;
        std::cout << "[INFO] CTRL+C ile durdurabilirsiniz." << std::endl;

        // Not: Frontend'e gönderilen gerçek veriler radarservice.cpp içindeki sendRadarFile'da
        // writer->Write(out) öncesi [SEND] log olarak konsola basılıyor.

        server->Wait();
    } catch (const std::exception& e) {
        std::cerr << "[ERROR] Sunucu başlatılamadı: " << e.what() << std::endl;
        return EXIT_FAILURE;
    }

    return EXIT_SUCCESS;
}
