#include "datalinkservice.h"

#include <grpcpp/grpcpp.h>
#include "datalink.grpc.pb.h"

#include <string>
#include <iostream>
#include <thread>
#include <chrono>
#include <cstdint>
#include <vector>
#include <algorithm>
#include <sstream>
#include <iomanip>

// MongoDB C++ Driver
#include <bsoncxx/json.hpp>
#include <bsoncxx/types.hpp>
#include <mongocxx/client.hpp>
#include <mongocxx/instance.hpp>
#include <mongocxx/uri.hpp>

// Programda 1 kez instance
static mongocxx::instance s_mongo_instance{};

// Constructor
DataLinkServiceImpl::DataLinkServiceImpl(std::string mongo_uri,
                                         std::string db_name,
                                         std::string coll_name)
    : mongo_uri_(std::move(mongo_uri)),
      db_name_(std::move(db_name)),
      coll_name_(std::move(coll_name))
{
}

// -------- Yardımcı fonksiyonlar --------

std::string DataLinkServiceImpl::get_string_utf8(const bsoncxx::document::view &v,
                                                 const char *key,
                                                 const std::string &def)
{
    auto elem = v[key];
    if (!elem)
        return def;
    if (elem.type() == bsoncxx::type::k_string)
    {
        auto sv = elem.get_string().value;
        return std::string(sv.data(), sv.size());
    }
    return def;
}

bool DataLinkServiceImpl::get_double_safe(const bsoncxx::document::view &v,
                                          const char *key,
                                          double &out)
{
    auto elem = v[key];
    if (!elem)
        return false;
    switch (elem.type())
    {
    case bsoncxx::type::k_double:
        out = elem.get_double().value;
        return true;
    case bsoncxx::type::k_int32:
        out = static_cast<double>(elem.get_int32().value);
        return true;
    case bsoncxx::type::k_int64:
        out = static_cast<double>(elem.get_int64().value);
        return true;
    default:
        return false;
    }
}

bool DataLinkServiceImpl::get_int64_safe(const bsoncxx::document::view &v,
                                         const char *key,
                                         int64_t &out)
{
    auto elem = v[key];
    if (!elem)
        return false;
    switch (elem.type())
    {
    case bsoncxx::type::k_int64:
        out = elem.get_int64().value;
        return true;
    case bsoncxx::type::k_int32:
        out = static_cast<int64_t>(elem.get_int32().value);
        return true;
    default:
        return false;
    }
}

bool DataLinkServiceImpl::is_in_tr_bbox(double lat, double lon)
{
    return (lat >= 36.0 && lat <= 42.0 && lon >= 26.0 && lon <= 45.0);
}

// -------- Ana streaming metodu --------

grpc::Status DataLinkServiceImpl::StreamDataLink(
    grpc::ServerContext *context,
    const datalink::DataLinkRequest *request,
    grpc::ServerWriter<datalink::DataLinkStreamResponse> *writer)
{
    try
    {
        mongocxx::client conn{mongocxx::uri{mongo_uri_}};
        auto db = conn[db_name_];
        auto coll = db[coll_name_];

        struct DLRecord
        {
            std::string id;
            std::string callsign;
            std::string status;
            double lat;
            double lon;
            double velocity;
            double baroaltitude;
            double geoaltitude;
            int64_t timestamp;
        };

        std::vector<DLRecord> records;

        auto cursor = coll.find({});
        for (auto &&doc : cursor)
        {
            std::string id = get_string_utf8(doc, "_id", "UNKNOWN");
            std::string callsign = get_string_utf8(doc, "callsign", "UNKNOWN");
            std::string status = get_string_utf8(doc, "status", "UNKNOWN");

            double lat = 0.0, lon = 0.0, vel = 0.0, baro = 0.0, geo = 0.0;
            int64_t ts = 0;

            if (!get_double_safe(doc, "lat", lat))
                continue;
            if (!get_double_safe(doc, "lon", lon))
                continue;
            if (!get_double_safe(doc, "velocity", vel))
                vel = 0.0;
            if (!get_double_safe(doc, "baroaltitude", baro))
                baro = 0.0;
            if (!get_double_safe(doc, "geoaltitude", geo))
                geo = 0.0;
            get_int64_safe(doc, "timestamp", ts);

            if (!is_in_tr_bbox(lat, lon))
                continue;

            records.push_back({id, callsign, status, lat, lon, vel, baro, geo, ts});
        }

        // Lat → Lon → Callsign sırasına göre sırala
        std::sort(records.begin(), records.end(),
                  [](const DLRecord &a, const DLRecord &b)
                  {
                      if (a.lat != b.lat)
                          return a.lat < b.lat;
                      if (a.lon != b.lon)
                          return a.lon < b.lon;
                      return a.callsign < b.callsign;
                  });

        int rank = 0;
        std::ostringstream oss;

        for (const auto &rec : records)
        {
            ++rank;
            oss.str(std::string());
            oss.clear();
            oss << "DL" << std::setw(3) << std::setfill('0') << rank;

            datalink::DataLinkStreamResponse resp;
            datalink::DataLinkData *data = resp.mutable_data();
            data->set_id(oss.str());
            data->set_callsign(rec.callsign);
            data->set_status(rec.status);
            data->set_lat(rec.lat);
            data->set_lon(rec.lon);
            data->set_velocity(rec.velocity);
            data->set_baroaltitude(rec.baroaltitude);
            data->set_geoaltitude(rec.geoaltitude);
            data->set_timestamp(rec.timestamp);

            // Konsola log
            std::cout << "[DL] ID: " << data->id()
                      << " | Callsign: " << data->callsign()
                      << " | Status: " << data->status()
                      << " | Lat: " << data->lat()
                      << " | Lon: " << data->lon()
                      << " | Vel: " << data->velocity()
                      << " | Baro: " << data->baroaltitude()
                      << " | Geo: " << data->geoaltitude()
                      << " | TS: " << data->timestamp()
                      << std::endl;

            if (!writer->Write(resp))
            {
                std::cerr << "[DL] Client disconnected." << std::endl;
                break;
            }

            if (context->IsCancelled())
            {
                std::cout << "[DL] Stream cancelled by client." << std::endl;
                break;
            }

            std::this_thread::sleep_for(std::chrono::milliseconds(50));
        }
    }
    catch (const std::exception &e)
    {
        std::cerr << "[ERROR] MongoDB DataLink query failed: " << e.what() << std::endl;
        return grpc::Status(grpc::StatusCode::INTERNAL, e.what());
    }

    return grpc::Status::OK;
}
