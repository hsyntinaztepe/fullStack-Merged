#pragma once

#include <grpcpp/grpcpp.h>
#include "datalink.grpc.pb.h"

#include <string>
#include <bsoncxx/document/view.hpp>

// DataLinkService implementasyonu
class DataLinkServiceImpl final : public datalink::DataLinkService::Service
{
public:
    DataLinkServiceImpl(std::string mongo_uri,
                        std::string db_name,
                        std::string coll_name);

    grpc::Status StreamDataLink(
        grpc::ServerContext *context,
        const datalink::DataLinkRequest *request,
        grpc::ServerWriter<datalink::DataLinkStreamResponse> *writer) override;

private:
    std::string mongo_uri_;
    std::string db_name_;
    std::string coll_name_;

    // Yardımcı fonksiyonlar
    static std::string get_string_utf8(const bsoncxx::document::view &v,
                                       const char *key,
                                       const std::string &def);

    static bool get_double_safe(const bsoncxx::document::view &v,
                                const char *key,
                                double &out);

    static bool get_int64_safe(const bsoncxx::document::view &v,
                               const char *key,
                               int64_t &out);

    static bool is_in_tr_bbox(double lat, double lon);
};
