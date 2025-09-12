#include "iffservice.h"
#include <grpcpp/grpcpp.h>
#include <iostream>
#include <memory>
#include <string>

// MongoDB C++ Driver
#include <mongocxx/client.hpp>
#include <mongocxx/instance.hpp>
#include <mongocxx/uri.hpp>
#include <bsoncxx/json.hpp>

// Tek seferlik Mongo instance

// Mongo bağlantı testi
void TestMongoIFF(const std::string& mongo_uri,
                  const std::string& db_name,
                  const std::string& coll_name)
{
    try {
        mongocxx::client conn{mongocxx::uri{mongo_uri}};
        auto db   = conn[db_name];
        auto coll = db[coll_name];

        auto cursor = coll.find({});
        int count = 0;
        std::cout << "[TEST] MongoDB bağlantısı başarılı. İlk kayıtlar:" << std::endl;
        for (auto&& doc : cursor) {
            std::cout << "  " << bsoncxx::to_json(doc) << std::endl;
            if (++count >= 5) break; // sadece ilk 5 kaydı göster
        }
        if (count == 0) {
            std::cout << "[TEST] Koleksiyon boş." << std::endl;
        }
    }
    catch (const std::exception& e) {
        std::cerr << "[TEST] MongoDB bağlantı/okuma hatası: " << e.what() << std::endl;
    }
}

void RunServer()
{
    const std::string server_address = "0.0.0.0:50051";
    const std::string mongo_uri      = "mongodb://localhost:27017";
    const std::string db_name        = "aewc";
    const std::string coll_name      = "iff";

    // Mongo bağlantısını test et
    TestMongoIFF(mongo_uri, db_name, coll_name);

    // Servis örneğini Mongo parametreleriyle oluştur
    IFFServiceImpl service(mongo_uri, db_name, coll_name);

    grpc::ServerBuilder builder;
    builder.AddListeningPort(server_address, grpc::InsecureServerCredentials());
    builder.RegisterService(&service);

    std::unique_ptr<grpc::Server> server(builder.BuildAndStart());
    std::cout << "[INFO] IFF Service listening on " << server_address << std::endl;
    std::cout << "[INFO] MongoDB: " << mongo_uri << " / " << db_name << "." << coll_name << std::endl;
    std::cout << "[INFO] CTRL+C ile durdurabilirsiniz." << std::endl;

    server->Wait();
}

int main()
{
    try {
        RunServer();
    }
    catch (const std::exception& ex) {
        std::cerr << "[ERROR] Exception in server: " << ex.what() << std::endl;
        return EXIT_FAILURE;
    }
    return EXIT_SUCCESS;
}
