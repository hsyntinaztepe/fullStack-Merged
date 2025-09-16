#include "radarservice.h"

#include <grpcpp/grpcpp.h>
#include "radar.grpc.pb.h"

#include <string>
#include <vector>
#include <iostream>
#include <thread>
#include <chrono>
#include <cstdint>
#include <unordered_map>
#include <unordered_set>
#include <mutex>
#include <cstdlib>
#include <ctime>
#include <sstream>
#include <iomanip>
#include <algorithm>
#include <cmath>

// MongoDB C++ Driver
#include <bsoncxx/json.hpp>
#include <bsoncxx/types.hpp>
#include <bsoncxx/builder/basic/document.hpp>
#include <bsoncxx/builder/basic/kvp.hpp>
#include <mongocxx/client.hpp>
#include <mongocxx/instance.hpp>
#include <mongocxx/uri.hpp>
#include <mongocxx/options/find.hpp>

// Programda 1 kez instance (global)
static mongocxx::instance s_mongo_instance{};

// RNG seed
static bool __seeded = ([]()
                        {
    std::srand(static_cast<unsigned int>(std::time(nullptr)));
    return true; })();

// ---------------------- Yardımcı fonksiyonlar ----------------------

std::string RadarServiceImpl::get_string_utf8(const bsoncxx::document::view &v, const char *key, const std::string &def)
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

bool RadarServiceImpl::get_double_safe(const bsoncxx::document::view &v, const char *key, double &out)
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

int32_t RadarServiceImpl::get_int32_safe(const bsoncxx::document::view &v, const char *key, int32_t def)
{
    auto elem = v[key];
    if (!elem)
        return def;
    switch (elem.type())
    {
    case bsoncxx::type::k_int32:
        return elem.get_int32().value;
    case bsoncxx::type::k_int64:
        return static_cast<int32_t>(elem.get_int64().value);
    case bsoncxx::type::k_double:
        return static_cast<int32_t>(elem.get_double().value);
    default:
        return def;
    }
}

std::string RadarServiceImpl::get_oid_string(const bsoncxx::document::view &v)
{
    auto elem = v["_id"];
    if (!elem)
        return {};
    if (elem.type() == bsoncxx::type::k_oid)
    {
        return elem.get_oid().value.to_string();
    }
    if (elem.type() == bsoncxx::type::k_string)
    {
        auto sv = elem.get_string().value;
        return std::string(sv.data(), sv.size());
    }
    return {};
}

// Türkiye bbox doğrulaması (lat/lon)
bool RadarServiceImpl::is_in_tr_bbox(double lat, double lon)
{
    return (lat >= 36.0 && lat <= 42.0 && lon >= 26.0 && lon <= 45.0);
}

// Basit drift için rastgele ±1 yön
int RadarServiceImpl::sign_rand() { return (std::rand() % 2) ? 1 : -1; }

// ---------------------- Implementasyon ----------------------

RadarServiceImpl::RadarServiceImpl(std::string mongo_uri,
                                   std::string db_name,
                                   std::string coll_name)
    : mongo_uri_(std::move(mongo_uri)),
      db_name_(std::move(db_name)),
      coll_name_(std::move(coll_name)) {}

bool RadarServiceImpl::checkAndReloadData()
{
    std::time_t now = std::time(nullptr);
    if (now - last_reload_check_ < 5)
        return false;
    last_reload_check_ = now;

    loadRadarData();
    return true;
}

void RadarServiceImpl::loadRadarData()
{
    mongocxx::client conn{mongocxx::uri{mongo_uri_}};
    auto db = conn[db_name_];
    auto coll = db[coll_name_];

    std::unordered_map<std::string, MovingTarget> parsed;
    std::unordered_set<std::string> seen_ids;

    try
    {
        mongocxx::options::find find_opts;
        find_opts.sort(bsoncxx::builder::basic::make_document(
            bsoncxx::builder::basic::kvp("_id", 1)));

        auto cursor = coll.find({}, find_opts);
        for (auto &&doc : cursor)
        {
            try
            {
                std::string key = get_oid_string(doc);
                if (key.empty())
                    continue;

                double lat = 0.0, lon = 0.0;
                if (!get_double_safe(doc, "lat", lat))
                    continue;
                if (!get_double_safe(doc, "lon", lon))
                    continue;

                int32_t velocity = get_int32_safe(doc, "velocity", 0);
                int32_t baroAltitude = get_int32_safe(doc, "baroAltitude", 0);
                int32_t geoAltitude = get_int32_safe(doc, "geoAltitude", 0);

                if (!is_in_tr_bbox(lat, lon))
                    continue;

                MovingTarget mt;
                mt.id = key;
                mt.lat = lat;
                mt.lon = lon;
                mt.velocity = velocity;
                mt.baro_altitude = baroAltitude;
                mt.geo_altitude = geoAltitude;

                // Hıza bağlı başlangıç drift miktarı
                double deg_per_sec = (mt.velocity / 100.0) * 0.001;
                mt.dlat = deg_per_sec * sign_rand();
                mt.dlon = deg_per_sec * sign_rand();

                // heading
                mt.heading = std::atan2(mt.dlat, mt.dlon) * 180.0 / M_PI;
                if (mt.heading < 0)
                    mt.heading += 360.0;

                // %30 ihtimalle manevra modu
                mt.maneuvering = (std::rand() % 100) < 30;

                auto it = targets_.find(key);
                if (it != targets_.end())
                {
                    mt.dlat = it->second.dlat;
                    mt.dlon = it->second.dlon;
                    mt.move_accumulator = it->second.move_accumulator;
                    mt.heading = it->second.heading;
                    mt.maneuvering = it->second.maneuvering;
                }

                parsed.emplace(key, std::move(mt));
                seen_ids.insert(key);
            }
            catch (const std::exception &e)
            {
                std::cerr << "Mongo parse hata: " << e.what() << std::endl;
            }
        }
    }
    catch (const std::exception &e)
    {
        std::cerr << "MongoDB bağlantı/sorgu hatası: " << e.what() << std::endl;
        return;
    }

    {
        std::lock_guard<std::mutex> lock(targets_mutex_);
        for (auto &kv : parsed)
        {
            const std::string &id = kv.first;
            auto it = targets_.find(id);
            if (it != targets_.end())
            {
                it->second.velocity = kv.second.velocity;
                it->second.baro_altitude = kv.second.baro_altitude;
                it->second.geo_altitude = kv.second.geo_altitude;
            }
            else
            {
                targets_.emplace(id, std::move(kv.second));
                std::cout << "Target eklendi: " << id << std::endl;
            }
        }
        for (auto it = targets_.begin(); it != targets_.end();)
        {
            if (seen_ids.find(it->first) == seen_ids.end())
            {
                std::cout << "Target silindi: " << it->first << std::endl;
                it = targets_.erase(it);
            }
            else
            {
                ++it;
            }
        }
        std::cout << "Reloaded from MongoDB. Active targets: " << targets_.size() << std::endl;
    }
}

void RadarServiceImpl::smartLoadRadarData()
{
    loadRadarData();
}

grpc::Status RadarServiceImpl::StreamRadarTargets(
    grpc::ServerContext *context,
    const radar::StreamRequest *request,
    grpc::ServerWriter<radar::RadarTarget> *writer)
{
    int interval_ms = request->refresh_interval_ms() > 0 ? request->refresh_interval_ms() : 1000;

    while (!context->IsCancelled())
    {
        sendRadarFile(writer, request);
        if (context->IsCancelled())
            break;
        std::this_thread::sleep_for(std::chrono::milliseconds(interval_ms));
    }
    return grpc::Status::OK;
}

void RadarServiceImpl::sendRadarFile(
    grpc::ServerWriter<radar::RadarTarget> *writer,
    const radar::StreamRequest *request)
{
    if (targets_.empty() || checkAndReloadData())
    {
        if (targets_.empty())
            loadRadarData();
    }

    const int interval_ms = request->refresh_interval_ms() > 0 ? request->refresh_interval_ms() : 1000;
    const double delta_s = interval_ms / 1000.0;

    // 1️⃣ Hedefleri güncelle
    {
        std::lock_guard<std::mutex> lock(targets_mutex_);
        for (auto &kv : targets_)
        {
            MovingTarget &t = kv.second;

            // --- Hız güncelle: ±1, daha küçük rastgele değişim ---
            t.velocity += (std::rand() % 3 - 1);
            t.velocity += static_cast<int32_t>(t.velocity * ((std::rand() % 7 - 3) / 100.0)); // ±3% yerine ±7%
            if (t.velocity < 0)
                t.velocity = 0;

            // --- Baro ve Geo Altitude güncelle: ±5 + küçük % değişim ---
            t.baro_altitude += (std::rand() % 11 - 5);                                                  // ±5 yerine ±10
            t.baro_altitude += static_cast<int32_t>(t.baro_altitude * ((std::rand() % 7 - 3) / 100.0)); // ±3%

            t.geo_altitude += (std::rand() % 11 - 5);                                                 // ±5 yerine ±10
            t.geo_altitude += static_cast<int32_t>(t.geo_altitude * ((std::rand() % 7 - 3) / 100.0)); // ±3%

            // --- Manevra modu %20 (daha az sıklıkla) ---
            if ((std::rand() % 100) < 20)
            {
                t.maneuvering = true;

                // Ani değişim %5 ihtimalle (daha nadir)
                if ((std::rand() % 100) < 5)
                {
                    t.velocity += (std::rand() % 31 - 15); // ±15 (orta seviye)
                    if (t.velocity < 0)
                        t.velocity = 0;

                    double factor = 1.0 + ((std::rand() % 2 == 0) ? 0.007 : -0.007); // ±15%
                    t.baro_altitude = static_cast<int32_t>(t.baro_altitude * factor);
                    t.geo_altitude = static_cast<int32_t>(t.geo_altitude * factor);
                }

                // Küçük heading değişimi ±5° (daha yumuşak)
                double delta_heading = (std::rand() % 11 - 5);
                t.heading += delta_heading;
                if (t.heading < 0)
                    t.heading += 360.0;
                if (t.heading >= 360.0)
                    t.heading -= 360.0;
            }
            else
            {
                t.maneuvering = false;

                // Normal durumda da çok küçük heading sapması %10 ihtimalle
                if ((std::rand() % 100) < 10)
                {
                    double tiny_heading_change = (std::rand() % 5 - 2); // ±2°
                    t.heading += tiny_heading_change;
                    if (t.heading < 0)
                        t.heading += 360.0;
                    if (t.heading >= 360.0)
                        t.heading -= 360.0;
                }
            }

            // --- dlat/dlon heading üzerinden güncelle ---
            double rad = t.heading * M_PI / 180.0;
            t.dlat = std::sin(rad);
            t.dlon = std::cos(rad);

            // --- Konum güncelle ---
            if (t.velocity > 0)
            {
                const double k_lat = 0.00002;
                const double k_lon = 0.00002;

                double step_lat = t.velocity * delta_s * k_lat * t.dlat;
                double step_lon = t.velocity * delta_s * k_lon * t.dlon;

                t.lat += step_lat;
                t.lon += step_lon;

                // Türkiye sınır kontrolü
                if (!is_in_tr_bbox(t.lat, t.lon))
                {
                    t.dlat = -t.dlat;
                    t.dlon = -t.dlon;
                    t.lat -= step_lat;
                    t.lon -= step_lon;
                    t.heading += 180.0;
                    if (t.heading >= 360.0)
                        t.heading -= 360.0;
                }
            }
        }
    }

    // 2️⃣ Snapshot al
    std::vector<MovingTarget> snapshot;
    {
        std::lock_guard<std::mutex> lock(targets_mutex_);
        snapshot.reserve(targets_.size());
        for (auto &kv : targets_)
            snapshot.push_back(kv.second);
    }

    // 3️⃣ gRPC gönderim ve log
    int rank = 0;
    for (const MovingTarget &t : snapshot)
    {
        ++rank;
        std::ostringstream oss;
        oss << "ID" << std::setw(3) << std::setfill('0') << rank;

        radar::RadarTarget out;
        out.set_id(oss.str());
        out.set_lat(t.lat);
        out.set_lon(t.lon);
        out.set_velocity(t.velocity);
        out.set_baro_altitude(t.baro_altitude);
        out.set_geo_altitude(t.geo_altitude);
        out.set_heading(t.heading);

        std::cout << "[SEND] ID: " << out.id()
                  << " | Lat: " << out.lat()
                  << " | Lon: " << out.lon()
                  << " | Vel: " << out.velocity()
                  << " | Heading: " << out.heading()
                  << " | BaroAlt: " << out.baro_altitude()
                  << " | GeoAlt: " << out.geo_altitude()
                  << " | Maneuver: " << (t.maneuvering ? "YES" : "NO")
                  << std::endl;

        if (!writer->Write(out))
        {
            std::cerr << "Writer kapandı, client ayrıldı.\n";
            break;
        }
    }
}
