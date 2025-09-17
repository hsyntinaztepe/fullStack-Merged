package com.aewc.sim;

import java.util.*;

public class AircraftGenerator {
    private static final List<Aircraft> aircraftList = new ArrayList<>();
    private static final Random random = new Random();

    public static List<Aircraft> getAircrafts() {
        return aircraftList;
    }

    public static void generateAircrafts(int count) {
        for (int i = 0; i < count; i++) {

            String affiliation = random.nextBoolean() ? "FRIEND" : "UNKNOWN";
            String callsign;

            if ("UNKNOWN".equals(affiliation)) {
                callsign = "UNKNOWN";
            } else {
                char letter1 = (char) ('A' + random.nextInt(26));
                char letter2 = (char) ('A' + random.nextInt(26));
                int number = random.nextInt(100);
                callsign = "" + letter1 + letter2 + String.format("%02d", number);
            }

            double lat = 36 + random.nextDouble() * (42 - 36); // 36–42
            double lon = 26 + random.nextDouble() * (45 - 26); // 26–45
            double velocity = 200 + random.nextDouble() * 800;
            double baroaltitude = 1111 + random.nextDouble() * 10000;
            double geoaltitude = baroaltitude + random.nextDouble() * 100;

            aircraftList.add(new Aircraft(callsign, lat, lon, velocity, baroaltitude, geoaltitude, affiliation));
        }
    }
}
