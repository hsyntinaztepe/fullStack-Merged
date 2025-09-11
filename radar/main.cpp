#include "radarservice.h"
#include <grpcpp/grpcpp.h>
#include <iostream>

// MongoDB test için eklenen başlıklar
#include <mongocxx/client.hpp>
#include <mongocxx/instance.hpp>
#include <mongocxx/uri.hpp>
#include <bsoncxx/json.hpp>

// Geçici MongoDB test fonksiyonu
void TestMongoRead(const std::string& mongo_uri,
                   const std::string& db_name,
                   const std::string& coll_name)
{
    try {
        mongocxx::client conn{mongocxx::uri{mongo_uri}};
        auto db   = conn[db_name];
        auto coll = db[coll_name];

        auto maybe_doc = coll.find_one({});
        if (maybe_doc) {
            std::cout << "[TEST] MongoDB bağlantısı başarılı. İlk kayıt:" << std::endl;
            std::cout << bsoncxx::to_json(*maybe_doc) << std::endl;
        } else {
            std::cout << "[TEST] MongoDB bağlantısı başarılı fakat koleksiyon boş." << std::endl;
        }
    }
    catch (const std::exception& e) {
        std::cerr << "[TEST] MongoDB bağlantı/okuma hatası: " << e.what() << std::endl;
    }
}

void RunServer()
{
    // Sunucu ve Mongo ayarları
    const std::string server_address = "0.0.0.0:50053";
    const std::string mongo_uri      = "mongodb://localhost:27017";
    const std::string db_name        = "microservices";
    const std::string coll_name      = "radar";


    // --- Geçici Mongo test ---
    TestMongoRead(mongo_uri, db_name, coll_name);
    // -------------------------

    // Servis örneğini Mongo parametreleriyle oluştur
    RadarServiceImpl service(mongo_uri, db_name, coll_name);

    grpc::ServerBuilder builder;
    builder.AddListeningPort(server_address, grpc::InsecureServerCredentials());
    builder.RegisterService(&service);

    std::unique_ptr<grpc::Server> server(builder.BuildAndStart());
    std::cout << "[INFO] Radar Service listening on " << server_address << std::endl;
    std::cout << "[INFO] MongoDB: " << mongo_uri << " / " << db_name << "." << coll_name << std::endl;
    std::cout << "[INFO] CTRL+C ile durdurabilirsiniz." << std::endl;

    server->Wait();
}

int main()
{
    try {
        RunServer();
    }
    catch (const std::exception &e) {
        std::cerr << "[ERROR] Sunucu başlatılamadı: " << e.what() << std::endl;
        return EXIT_FAILURE;
    }
    return EXIT_SUCCESS;
}
