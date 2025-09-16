#ifndef RADARSERVICE_H
#define RADARSERVICE_H

#include "radar.grpc.pb.h"
#include <grpcpp/grpcpp.h>

#include <string>
#include <vector>
#include <ctime>
#include <unordered_map>
#include <mutex>
#include <cstdint>

#include <bsoncxx/document/view.hpp>
#include <bsoncxx/types.hpp>

class RadarServiceImpl final : public radar::RadarService::Service
{
public:
    explicit RadarServiceImpl(std::string mongo_uri = "mongodb://localhost:27017",
                              std::string db_name = "aewc",
                              std::string coll_name = "radar");

    grpc::Status StreamRadarTargets(
        grpc::ServerContext *context,
        const radar::StreamRequest *request,
        grpc::ServerWriter<radar::RadarTarget> *writer) override;

    bool checkAndReloadData();
    void loadRadarData();
    void smartLoadRadarData();

private:
    struct MovingTarget
    {
        std::string id;
        double lat = 0.0;
        double lon = 0.0;
        int32_t velocity = 0;
        int32_t baro_altitude = 0;
        int32_t geo_altitude = 0;

        double dlat = 0.0;
        double dlon = 0.0;
        double move_accumulator = 0.0;

        double heading = 0.0;
        bool maneuvering = false;
    };

    void sendRadarFile(grpc::ServerWriter<radar::RadarTarget> *writer,
                       const radar::StreamRequest *request);

    static std::string get_string_utf8(const bsoncxx::document::view &v, const char *key, const std::string &def = {});
    static bool get_double_safe(const bsoncxx::document::view &v, const char *key, double &out);
    static int32_t get_int32_safe(const bsoncxx::document::view &v, const char *key, int32_t def = 0);
    static std::string get_oid_string(const bsoncxx::document::view &v);
    static bool is_in_tr_bbox(double lat, double lon);
    static int sign_rand();

    std::string mongo_uri_;
    std::string db_name_;
    std::string coll_name_;

    std::unordered_map<std::string, MovingTarget> targets_;
    std::mutex targets_mutex_;
    std::time_t last_reload_check_ = 0;
};

#endif
