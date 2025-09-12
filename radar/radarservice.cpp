// radarservice.cpp
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
static bool __seeded = ([](){
    std::srand(static_cast<unsigned int>(std::time(nullptr)));
    return true;
})();

// ---------------------- Yardımcı fonksiyonlar ----------------------

std::string RadarServiceImpl::get_string_utf8(const bsoncxx::document::view& v, const char* key, const std::string& def) {
    auto elem = v[key];
    if (!elem) return def;
    if (elem.type() == bsoncxx::type::k_string) {
        auto sv = elem.get_string().value;
        return std::string(sv.data(), sv.size());
    }
    return def;
}

bool RadarServiceImpl::get_double_safe(const bsoncxx::document::view& v, const char* key, double& out) {
    auto elem = v[key];
    if (!elem) return false;
    switch (elem.type()) {
        case bsoncxx::type::k_double: out = elem.get_double().value; return true;
        case bsoncxx::type::k_int32:  out = static_cast<double>(elem.get_int32().value); return true;
        case bsoncxx::type::k_int64:  out = static_cast<double>(elem.get_int64().value); return true;
        default: return false;
    }
}

int32_t RadarServiceImpl::get_int32_safe(const bsoncxx::document::view& v, const char* key, int32_t def) {
    auto elem = v[key];
    if (!elem) return def;
    switch (elem.type()) {
        case bsoncxx::type::k_int32:  return elem.get_int32().value;
        case bsoncxx::type::k_int64:  return static_cast<int32_t>(elem.get_int64().value);
        case bsoncxx::type::k_double: return static_cast<int32_t>(elem.get_double().value);
        default: return def;
    }
}

std::string RadarServiceImpl::get_oid_string(const bsoncxx::document::view& v) {
    auto elem = v["_id"];
    if (!elem) return {};
    if (elem.type() == bsoncxx::type::k_oid) {
        return elem.get_oid().value.to_string();
    }
    if (elem.type() == bsoncxx::type::k_string) {
        auto sv = elem.get_string().value;
        return std::string(sv.data(), sv.size());
    }
    return {};
}

// Türkiye bbox doğrulaması (lat/lon)
bool RadarServiceImpl::is_in_tr_bbox(double lat, double lon) {
    return (lat >= 36.0 && lat <= 42.0 && lon >= 26.0 && lon <= 45.0);
}

int RadarServiceImpl::sign_rand() { return (std::rand() % 2) ? 1 : -1; }

RadarServiceImpl::RadarServiceImpl(std::string mongo_uri,
                                   std::string db_name,
                                   std::string coll_name)
    : mongo_uri_(std::move(mongo_uri)),
      db_name_(std::move(db_name)),
      coll_name_(std::move(coll_name)) {}

bool RadarServiceImpl::checkAndReloadData() {
    std::time_t now = std::time(nullptr);
    if (now - last_reload_check_ < 5)
        return false;
    last_reload_check_ = now;

    loadRadarData();
    return true;
}

void RadarServiceImpl::loadRadarData() {
    mongocxx::client conn{mongocxx::uri{mongo_uri_}};
    auto db   = conn[db_name_];
    auto coll = db[coll_name_];

    std::unordered_map<std::string, MovingTarget> parsed;
    std::unordered_set<std::string> seen_ids;

    try {
        mongocxx::options::find find_opts;
        find_opts.sort(bsoncxx::builder::basic::make_document(
            bsoncxx::builder::basic::kvp("_id", 1)
        ));

        auto cursor = coll.find({}, find_opts);
        for (auto&& doc : cursor) {
            try {
                std::string key = get_oid_string(doc);
                if (key.empty()) continue;

                double lat = 0.0, lon = 0.0;
                if (!get_double_safe(doc, "lat", lat)) continue;
                if (!get_double_safe(doc, "lon", lon)) continue;

                int32_t velocity      = get_int32_safe(doc, "velocity", 0);
                int32_t baroAltitude  = get_int32_safe(doc, "baroAltitude", 0);
                int32_t geoAltitude   = get_int32_safe(doc, "geoAltitude", 0);

                if (!is_in_tr_bbox(lat, lon)) continue;

                MovingTarget mt;
                mt.id = key;
                mt.lat = lat;
                mt.lon = lon;
                mt.velocity = velocity;
                mt.baro_altitude = baroAltitude;
                mt.geo_altitude  = geoAltitude;

                auto it = targets_.find(key);
                if (it == targets_.end()) {
                    // Yeni hedef: rastgele bir heading ata (0..360)
                    mt.heading_deg = static_cast<double>(std::rand() % 360);
                    // UNKNOWN kabul edip %50 savaş uçağı say
                    mt.is_fighter = (std::rand() % 100) < 50;
                } else {
                    // Mevcut hedefin durumunu koru
                    mt.heading_deg = it->second.heading_deg;
                    mt.move_accumulator = it->second.move_accumulator;
                    mt.is_fighter = it->second.is_fighter;
                }

                parsed.emplace(key, std::move(mt));
                seen_ids.insert(key);
            } catch (const std::exception& e) {
                std::cerr << "Mongo parse hata: " << e.what() << std::endl;
            }
        }
    } catch (const std::exception& e) {
        std::cerr << "MongoDB bağlantı/sorgu hatası: " << e.what() << std::endl;
        return;
    }

    {
        std::lock_guard<std::mutex> lock(targets_mutex_);
        for (auto& kv : parsed) {
            const std::string& id = kv.first;
            auto it = targets_.find(id);
            if (it != targets_.end()) {
                it->second.velocity       = kv.second.velocity;
                it->second.baro_altitude  = kv.second.baro_altitude;
                it->second.geo_altitude   = kv.second.geo_altitude;
                it->second.heading_deg    = kv.second.heading_deg;
                it->second.is_fighter     = kv.second.is_fighter;
            } else {
                targets_.emplace(id, std::move(kv.second));
                std::cout << "Target eklendi: " << id << std::endl;
            }
        }
        for (auto it = targets_.begin(); it != targets_.end();) {
            if (seen_ids.find(it->first) == seen_ids.end()) {
                std::cout << "Target silindi: " << it->first << std::endl;
                it = targets_.erase(it);
            } else {
                ++it;
            }
        }
        std::cout << "Reloaded from MongoDB. Active targets: " << targets_.size() << std::endl;
    }
}

void RadarServiceImpl::smartLoadRadarData() {
    loadRadarData();
}

grpc::Status RadarServiceImpl::StreamRadarTargets(
    grpc::ServerContext *context,
    const radar::StreamRequest *request,
    grpc::ServerWriter<radar::RadarTarget> *writer)
{
    int interval_ms = request->refresh_interval_ms() > 0 ? request->refresh_interval_ms() : 1000;

    while (!context->IsCancelled()) {
        sendRadarFile(writer, request);
        if (context->IsCancelled())
            break;
        std::this_thread::sleep_for(std::chrono::milliseconds(interval_ms));
    }
    return grpc::Status::OK;
}

static inline double deg_wrap_360(double a) {
    while (a < 0.0)   a += 360.0;
    while (a >= 360.) a -= 360.0;
    return a;
}

void RadarServiceImpl::sendRadarFile(
    grpc::ServerWriter<radar::RadarTarget>* writer,
    const radar::StreamRequest* request)
{
    // Veri yoksa (ilk açılış) veya periyodik reload zamanı gelmişse Mongo'dan yükle
    if (targets_.empty() || checkAndReloadData()) {
        if (targets_.empty())
            loadRadarData();
    }

    const int interval_ms = request->refresh_interval_ms() > 0
        ? request->refresh_interval_ms()
        : 1000;
    const double delta_s = interval_ms / 1000.0;

    {
        std::lock_guard<std::mutex> lock(targets_mutex_);
        for (auto& kv : targets_) {
            MovingTarget& t = kv.second;

            if (t.velocity > 0) {
                // Görselleştirme ölçeği: hız × zaman × katsayı
                // Not: Bunları UI'dan parametreleştirmen iyi olur.
                const double k_lat = 0.00002; // derece / (m/s * s)
                const double k_lon = 0.00002; // derece / (m/s * s)

                // Savaş uçağı ise agresif manevra ve hız çarpanı
                double speed_multiplier = 1.0;
                if (t.is_fighter) {
                    speed_multiplier = 1.5;

                    // Manevra olasılıkları:
                    // - %10: Absürt dönüş (±90° ila ±135° arası)
                    // - %30: Küçük rastgele dönüş (±3° ila ±10° arası)
                    int r = std::rand() % 100;
                    if (r < 10) {
                        int sgn = sign_rand();
                        double turn = (90.0 + (std::rand() % 46)) * sgn; // 90..135
                        t.heading_deg = deg_wrap_360(t.heading_deg + turn);
                        // Dikey manevra: agresif tırmanış/iniş (6000–15000 ft/dk arası)
                        int climb_fpm = 6000 + (std::rand() % 9001); // 6000..15000
                        int climb_dir = sign_rand(); // +1 tırman, -1 in
                        double climb_ft = (climb_fpm / 60.0) * delta_s;
                        t.baro_altitude = std::max(0, t.baro_altitude + static_cast<int>(climb_dir * climb_ft));
                        t.geo_altitude  = std::max(0, t.geo_altitude  + static_cast<int>(climb_dir * climb_ft));
                    } else if (r < 40) {
                        int sgn = sign_rand();
                        double turn = (3.0 + (std::rand() % 8)) * sgn; // 3..10 derece
                        t.heading_deg = deg_wrap_360(t.heading_deg + turn);
                        // Orta dikey değişim (1000–3000 ft/dk)
                        int climb_fpm = 1000 + (std::rand() % 2001);
                        int climb_dir = sign_rand();
                        double climb_ft = (climb_fpm / 60.0) * delta_s;
                        t.baro_altitude = std::max(0, t.baro_altitude + static_cast<int>(climb_dir * climb_ft));
                        t.geo_altitude  = std::max(0, t.geo_altitude  + static_cast<int>(climb_dir * climb_ft));
                    }
                } else {
                    // Yolcu uçağı davranışı: küçük/seyrek heading jitter, minimal dikey değişim
                    if ((std::rand() % 100) < 5) {
                        int sgn = sign_rand();
                        double turn = (0.5 + (std::rand() % 5) * 0.5) * sgn; // 0.5..3.0 derece
                        t.heading_deg = deg_wrap_360(t.heading_deg + turn);
                    }
                    if ((std::rand() % 100) < 3) {
                        int climb_fpm = 200 + (std::rand() % 401); // 200..600 ft/dk
                        int climb_dir = sign_rand();
                        double climb_ft = (climb_fpm / 60.0) * delta_s;
                        t.baro_altitude = std::max(0, t.baro_altitude + static_cast<int>(climb_dir * climb_ft));
                        t.geo_altitude  = std::max(0, t.geo_altitude  + static_cast<int>(climb_dir * climb_ft));
                    }
                }

                // Hareket adımı (heading'e göre parçala)
                const double heading_rad = t.heading_deg * M_PI / 180.0;
                const double v = static_cast<double>(t.velocity) * speed_multiplier;
                double step_lat = (v * delta_s) * k_lat * std::cos(heading_rad);
                double step_lon = (v * delta_s) * k_lon * std::sin(heading_rad);

                t.lat += step_lat;
                t.lon += step_lon;

                // TR bbox dışına taşarsa: 180° çevir, bir adım geri al
                if (!is_in_tr_bbox(t.lat, t.lon)) {
                    t.lat -= step_lat;
                    t.lon -= step_lon;
                    t.heading_deg = deg_wrap_360(t.heading_deg + 180.0);
                }
            }
        }
    }

    // Snapshot
    std::vector<MovingTarget> snapshot;
    {
        std::lock_guard<std::mutex> lock(targets_mutex_);
        snapshot.reserve(targets_.size());
        for (auto& kv : targets_) {
            snapshot.push_back(kv.second);
        }
    }

    // Stabil ID üret ve gönder (görsel amaçlı sıralı ID)
    std::ostringstream oss;
    int rank = 0;

    for (const MovingTarget& t : snapshot) {
        ++rank;
        oss.str(std::string());
        oss.clear();
        oss << "ID" << std::setw(3) << std::setfill('0') << rank;

        radar::RadarTarget out;
        out.set_id(oss.str());                  // Görsel ID
        out.set_lat(t.lat);
        out.set_lon(t.lon);
        out.set_velocity(t.velocity);
        out.set_baro_altitude(t.baro_altitude);
        out.set_geo_altitude(t.geo_altitude);

        // İstersen protoda "is_fighter" için bir alan açıp gönder:
        // out.set_is_fighter(t.is_fighter);

        if (!writer->Write(out)) {
            std::cerr << "Writer kapandı, client ayrıldı." << std::endl;
            break;
        }
    }
}
