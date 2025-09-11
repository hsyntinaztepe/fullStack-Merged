#ifndef IFFSERVICE_H
#define IFFSERVICE_H

#include "iff.grpc.pb.h"
#include <grpcpp/grpcpp.h>
#include <string>

class IFFServiceImpl final : public iff::IFFService::Service
{
public:
    // Mongo bağlantı bilgilerini ctor'da al
    explicit IFFServiceImpl(std::string mongo_uri,
                            std::string db_name,
                            std::string coll_name);

    grpc::Status StreamIFFData(grpc::ServerContext* context,
                               const iff::IFFRequest* request,
                               grpc::ServerWriter<iff::IFFStreamResponse>* writer) override;

private:
    std::string mongo_uri_;
    std::string db_name_;
    std::string coll_name_;
};

#endif // IFFSERVICE_H
