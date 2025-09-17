#include <grpcpp/grpcpp.h>
#include "datalinkservice.h"

#include <iostream>
#include <string>

int main(int argc, char **argv)
{
    std::string server_address("0.0.0.0:50052"); // gRPC portu
    std::string mongo_uri = "mongodb://localhost:27017";
    std::string db_name = "flightdb";
    std::string coll_name = "datalink";

    // Komut satırından argümanla değiştirme opsiyonu
    if (argc > 1)
        server_address = argv[1];
    if (argc > 2)
        mongo_uri = argv[2];
    if (argc > 3)
        db_name = argv[3];
    if (argc > 4)
        coll_name = argv[4];

    DataLinkServiceImpl service(mongo_uri, db_name, coll_name);

    grpc::ServerBuilder builder;
    builder.AddListeningPort(server_address, grpc::InsecureServerCredentials());
    builder.RegisterService(&service);

    std::unique_ptr<grpc::Server> server(builder.BuildAndStart());
    std::cout << "[DL] gRPC server started at " << server_address << std::endl;
    std::cout << "[DL] Mongo URI: " << mongo_uri
              << " | DB: " << db_name
              << " | Collection: " << coll_name << std::endl;

    server->Wait(); // server sonsuza kadar çalışır

    return 0;
}
