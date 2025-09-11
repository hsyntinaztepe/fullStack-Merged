#include "iffservice.h"

#include <grpcpp/grpcpp.h>
#include "iff.grpc.pb.h"

#include <string>
#include <iostream>
#include <thread>
#include <chrono>
#include <cstdint>
#include <unordered_map>
#include <mutex>
#include <cstdlib>
#include <ctime>

// MongoDB C++ Driver
#include <bsoncxx/json.hpp>
#include <bsoncxx/types.hpp>
#include <mongocxx/client.hpp>
#include <mongocxx/instance.hpp>
#include <mongocxx/uri.hpp>

// Programda 1 kez instance
static mongocxx::instance s_mongo_instance{};

// Constructor tanımı
IFFServiceImpl::IFFServiceImpl(std::string mongo_uri,
                               std::string db_name,
                               std::string coll_name)
    : mongo_uri_(std::move(mongo_uri)),
      db_name_(std::move(db_name)),
      coll_name_(std::move(coll_name))
{
}

// Güvenli string çıkarıcı
static inline std::string get_string_utf8(const bsoncxx::document::view& v, const char* key, const std::string& def = {}) {
    auto elem = v[key];
    if (!elem) return def;
    if (elem.type() == bsoncxx::type::k_string) {
        auto sv = elem.get_string().value;
        return std::string(sv.data(), sv.size());
    }
    return def;
}

// Güvenli double çıkarıcı
static inline bool get_double_safe(const bsoncxx::document::view& v, const char* key, double& out) {
    auto elem = v[key];
    if (!elem) return false;
    switch (elem.type()) {
        case bsoncxx::type::k_double: out = elem.get_double().value; return true;
        case bsoncxx::type::k_int32:  out = static_cast<double>(elem.get_int32().value); return true;
        case bsoncxx::type::k_int64:  out = static_cast<double>(elem.get_int64().value); return true;
        default: return false;
    }
}

// Türkiye bbox doğrulaması (lat/lon)
static inline bool is_in_tr_bbox(double lat, double lon) {
    return (lat >= 36.0 && lat <= 42.0 && lon >= 26.0 && lon <= 45.0);
}

grpc::Status IFFServiceImpl::StreamIFFData(
    grpc::ServerContext* context,
    const iff::IFFRequest* request,
    grpc::ServerWriter<iff::IFFStreamResponse>* writer)
{
    try {
        mongocxx::client conn{mongocxx::uri{mongo_uri_}};
        auto db   = conn[db_name_];
        auto coll = db[coll_name_];

        auto cursor = coll.find({});

        for (auto&& doc : cursor) {
            std::string callsign = get_string_utf8(doc, "callsign", "UNKNOWN");
            std::string status   = get_string_utf8(doc, "status", "UNKNOWN");

            double lat = 0.0, lon = 0.0;
            if (!get_double_safe(doc, "lat", lat)) continue;
            if (!get_double_safe(doc, "lon", lon)) continue;

            // Türkiye sınırları dışında ise atla
            if (!is_in_tr_bbox(lat, lon)) continue;

            iff::IFFStreamResponse resp;
            iff::IFFData* data = resp.mutable_data();
            data->set_status(status);
            data->set_lat(lat);
            data->set_lon(lon);
            data->set_callsign(callsign);

            // Konsola log
            std::cout << "[IFF] callsign=" << callsign
                      << " status=" << status
                      << " lat=" << lat
                      << " lon=" << lon << std::endl;

            if (!writer->Write(resp)) {
                std::cerr << "[IFF] Client disconnected." << std::endl;
                break;
            }

            // İstersen küçük bir gecikme ekleyebilirsin
            std::this_thread::sleep_for(std::chrono::milliseconds(50));

            if (context->IsCancelled()) {
                std::cout << "[IFF] Stream cancelled by client." << std::endl;
                break;
            }
        }

    } catch (const std::exception& e) {
        std::cerr << "[ERROR] MongoDB IFF query failed: " << e.what() << std::endl;
        return grpc::Status(grpc::StatusCode::INTERNAL, e.what());
    }

    return grpc::Status::OK;
}
