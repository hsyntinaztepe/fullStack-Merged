#include "radarservice.h"
#include <grpcpp/grpcpp.h>
#include <iostream>
#include <memory>
#include <string>

int main() {

    const std::string server_address = "0.0.0.0:50053";
    const std::string mongo_uri      = "mongodb://localhost:27017";
    const std::string db_name        = "aewc";
    const std::string coll_name      = "radar";

    try {
    
        RadarServiceImpl service(mongo_uri, db_name, coll_name);

 
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


        server->Wait();
    } catch (const std::exception& e) {
        std::cerr << "[ERROR] Sunucu başlatılamadı: " << e.what() << std::endl;
        return EXIT_FAILURE;
    }

    return EXIT_SUCCESS;
}
