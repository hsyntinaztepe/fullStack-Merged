#include "datalinkservice.h"
#include <grpcpp/grpcpp.h>
#include <iostream>

void RunServer()
{
    std::string server_address("0.0.0.0:50052");
    DataLinkServiceImpl service;

    grpc::ServerBuilder builder;
    builder.AddListeningPort(server_address, grpc::InsecureServerCredentials());
    builder.RegisterService(&service);

    std::unique_ptr<grpc::Server> server(builder.BuildAndStart());
    std::cout << "✅ DataLink Service listening on " << server_address << std::endl;
    std::cout << "Frontend, Node.js üzerinden bu servise bağlanabilir." << std::endl;
    std::cout << "CTRL+C ile durdurabilirsiniz." << std::endl;

    server->Wait();
}

int main()
{
    RunServer();
    return 0;
}
