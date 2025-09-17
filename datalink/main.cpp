#include <grpcpp/grpcpp.h>
#include "datalinkservice.h"   // Senin DataLinkServiceImpl sınıfın
#include "datalink.grpc.pb.h"

#include <iostream>
#include <memory>
#include <string>

int main(int argc, char** argv) {
    std::string server_address("0.0.0.0:50052");

    std::string mongo_uri = "mongodb://localhost:27017";
    std::string db_name   = "aewc";
    std::string coll_name = "datalink";

    DataLinkServiceImpl service(mongo_uri, db_name, coll_name);

    grpc::ServerBuilder builder;
    builder.AddListeningPort(server_address, grpc::InsecureServerCredentials());
    builder.RegisterService(&service);

    std::unique_ptr<grpc::Server> server(builder.BuildAndStart());
    std::cout << "[DL] Server listening on " << server_address << std::endl;

    server->Wait();
    return 0;
}
