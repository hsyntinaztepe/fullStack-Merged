#ifndef IFFSERVICE_H
#define IFFSERVICE_H

#include "iff.grpc.pb.h"
#include <grpcpp/grpcpp.h>

#include <string>
#include <vector>

// BSON/Mongo tipleri için gerekli başlıklar
#include <bsoncxx/document/view.hpp>
#include <bsoncxx/types.hpp>

class IFFServiceImpl final : public iff::IFFService::Service
{
public:
    explicit IFFServiceImpl(std::string mongo_uri,
                            std::string db_name,
                            std::string coll_name);

    grpc::Status StreamIFFData(grpc::ServerContext* context,
                               const iff::IFFRequest* request,
                               grpc::ServerWriter<iff::IFFStreamResponse>* writer) override;

private:
    // Yardımcı fonksiyonlar (sınıfın static üyeleri)
    static std::string get_string_utf8(const bsoncxx::document::view& v,
                                       const char* key,
                                       const std::string& def = {});
    static bool        get_double_safe(const bsoncxx::document::view& v,
                                       const char* key,
                                       double& out);
    static bool        is_in_tr_bbox(double lat, double lon);

    // Mongo bağlantı bilgileri
    std::string mongo_uri_;
    std::string db_name_;
    std::string coll_name_;
};

#endif // IFFSERVICE_H
