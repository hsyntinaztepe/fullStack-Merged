// radarservice.h
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

class RadarServiceImpl final : public radar::RadarService::Service
{
public:
    explicit RadarServiceImpl(std::string mongo_uri = "mongodb://localhost:27017",
                              std::string db_name   = "radarDB",
                              std::string coll_name = "radarIFF");

    grpc::Status StreamRadarTargets(
        grpc::ServerContext* context,
        const radar::StreamRequest* request,
        grpc::ServerWriter<radar::RadarTarget>* writer) override;

    bool checkAndReloadData();
    void loadRadarData();
    void smartLoadRadarData();

private:
    struct MovingTarget {
        std::string id; // _id as string key
        double lat = 0.0;
        double lon = 0.0;
        int32_t velocity = 0;
        int32_t baro_altitude = 0;
        int32_t geo_altitude  = 0;

        // internal drift state
        double dlat = 0.0;
        double dlon = 0.0;
        double move_accumulator = 0.0;
    };

    void sendRadarFile(grpc::ServerWriter<radar::RadarTarget>* writer,
                       const radar::StreamRequest* request);

    std::string mongo_uri_;
    std::string db_name_;
    std::string coll_name_;

    std::unordered_map<std::string, MovingTarget> targets_;
    std::mutex targets_mutex_;
    std::time_t last_reload_check_ = 0;
};

#endif // RADARSERVICE_H
