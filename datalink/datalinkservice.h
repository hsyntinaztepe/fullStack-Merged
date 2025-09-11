#ifndef DATALINKSERVICE_H
#define DATALINKSERVICE_H

#include "datalink.grpc.pb.h"
#include <grpcpp/grpcpp.h>
#include <string>
#include <vector>

class DataLinkServiceImpl final : public datalink::DataLinkService::Service
{
public:
    
    std::vector<std::string> readDataLinkFile(const std::string &filename);

  
    grpc::Status GetDataLinkMessages(grpc::ServerContext *context,
                                     const datalink::DataLinkRequest *request,
                                     datalink::DataLinkResponse *response) override;
};

#endif // DATALINKSERVICE_H