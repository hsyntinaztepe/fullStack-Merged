#include "datalinkservice.h"

#include <bsoncxx/json.hpp>
#include <mongocxx/client.hpp>
#include <mongocxx/instance.hpp>
#include <mongocxx/uri.hpp>

#include <iostream>
#include <thread>
#include <chrono>
#include <sstream>
#include <iomanip>
#include <vector>
#include <algorithm>

static mongocxx::instance s_mongo_instance{};

DataLinkServiceImpl::DataLinkServiceImpl(std::string mongo_uri,
                                         std::string db_name,
                                         std::string coll_name)
    : mongo_uri_(std::move(mongo_uri)),
      db_name_(std::move(db_name)),
      coll_name_(std::move(coll_name)) {}

std::string DataLinkServiceImpl::get_string_utf8(const bsoncxx::document::view& v,
                                                 const char* key,
                                                 const std::string& def) {
    auto elem = v[key];
    if (!elem) return def;
    if (elem.type() == bsoncxx::type::k_string) {
        auto sv = elem.get_string().value;
        return std::string(sv.data(), sv.size());
    }
    return def;
}

bool DataLinkServiceImpl::get_double_safe(const bsoncxx::document::view& v,
                                          const char* key,
                                          double& out) {
    auto elem = v[key];
    if (!elem) return false;
    switch (elem.type()) {
        case bsoncxx::type::k_double: out = elem.get_double().value; return true;
        case bsoncxx::type::k_int32:  out = static_cast<double>(elem.get_int32().value); return true;
        case bsoncxx::type::k_int64:  out = static_cast<double>(elem.get_int64().value); return true;
        default: return false;
    }
}

bool DataLinkServiceImpl::is_in_tr_bbox(double lat, double lon) {
    return (lat >= 36.0 && lat <= 42.0 && lon >= 26.0 && lon <= 45.0);
}

grpc::Status DataLinkServiceImpl::StreamDataLink(
    grpc::ServerContext* context,
    const datalink::DLRequest* request,
    grpc::ServerWriter<datalink::DLStreamResponse>* writer)
{
    try {
        mongocxx::client conn{mongocxx::uri{mongo_uri_}};
        auto db   = conn[db_name_];
        auto coll = db[coll_name_];

        struct DLRecord {
            std::string callsign;
            std::string status;
            double lat;
            double lon;
            double velocity;
            double baroalt;
            double geoalt;
        };

        std::vector<DLRecord> records;

        auto cursor = coll.find({});
        for (auto&& doc : cursor) {
            std::string callsign = get_string_utf8(doc, "callsign", "UNKNOWN");
            std::string status   = get_string_utf8(doc, "status", "UNKNOWN");

            double lat=0, lon=0, vel=0, baro=0, geo=0;
            if (!get_double_safe(doc, "lat", lat)) continue;
            if (!get_double_safe(doc, "lon", lon)) continue;
            get_double_safe(doc, "velocity", vel);
            get_double_safe(doc, "baroaltitude", baro);
            get_double_safe(doc, "geoaltitude", geo);

            if (!is_in_tr_bbox(lat, lon)) continue;

            records.push_back({callsign, status, lat, lon, vel, baro, geo});
        }

        std::sort(records.begin(), records.end(),
            [](const DLRecord& a, const DLRecord& b) {
                if (a.lat != b.lat) return a.lat < b.lat;
                if (a.lon != b.lon) return a.lon < b.lon;
                return a.callsign < b.callsign;
            });

        std::ostringstream oss;
        int rank = 0;

        for (const auto& rec : records) {
            ++rank;
            oss.str(std::string());
            oss.clear();
            oss << "DL" << std::setw(3) << std::setfill('0') << rank;

            datalink::DLStreamResponse resp;
            datalink::DLData* data = resp.mutable_data();
            data->set_id(oss.str());
            data->set_callsign(rec.callsign);
            data->set_status(rec.status);
            data->set_lat(rec.lat);
            data->set_lon(rec.lon);
            data->set_velocity(rec.velocity);
            data->set_baroalt(rec.baroalt);
            data->set_geoalt(rec.geoalt);

            std::cout << "[DL] ID: " << data->id()
                      << " | Callsign: " << data->callsign()
                      << " | Status: " << data->status()
                      << " | Lat: " << data->lat()
                      << " | Lon: " << data->lon()
                      << " | Vel: " << data->velocity()
                      << " | Baro: " << data->baroalt()
                      << " | Geo: " << data->geoalt()
                      << std::endl;

            if (!writer->Write(resp)) {
                std::cerr << "[DL] Client disconnected." << std::endl;
                break;
            }

            if (context->IsCancelled()) {
                std::cout << "[DL] Stream cancelled by client." << std::endl;
                break;
            }

            std::this_thread::sleep_for(std::chrono::milliseconds(50));
        }

    } catch (const std::exception& e) {
        std::cerr << "[ERROR] MongoDB DataLink query failed: " << e.what() << std::endl;
        return grpc::Status(grpc::StatusCode::INTERNAL, e.what());
    }

    return grpc::Status::OK;
}
