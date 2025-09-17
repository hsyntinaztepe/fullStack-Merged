#pragma once
#include <bsoncxx/document/view.hpp>
#include <bsoncxx/types.hpp>

#include <grpcpp/grpcpp.h>
#include "datalink.grpc.pb.h"

#include <string>

class DataLinkServiceImpl final : public datalink::DataLink::Service {
public:
    DataLinkServiceImpl(std::string mongo_uri,
                        std::string db_name,
                        std::string coll_name);

    grpc::Status StreamDataLink(
        grpc::ServerContext* context,
        const datalink::DLRequest* request,
        grpc::ServerWriter<datalink::DLStreamResponse>* writer) override;

private:
    std::string mongo_uri_;
    std::string db_name_;
    std::string coll_name_;

    std::string get_string_utf8(const bsoncxx::document::view& v,
                                const char* key,
                                const std::string& def);
    bool get_double_safe(const bsoncxx::document::view& v,
                         const char* key,
                         double& out);
    bool is_in_tr_bbox(double lat, double lon);
};
