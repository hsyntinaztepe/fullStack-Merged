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

            String affiliation = random.nextBoolean() ? "FRIEND" : "FOE";
            String callsign;

            if ("FOE".equals(affiliation)) {
                // FOE ise callsign sabit "FOE"
                callsign = "UNKNOWN";
            } else {
                // FRIEND ise rastgele 2 harf + 2 rakam
                char letter1 = (char) ('A' + random.nextInt(26));
                char letter2 = (char) ('A' + random.nextInt(26));
                int number = random.nextInt(100);
                callsign = "" + letter1 + letter2 + String.format("%02d", number);
            }

            double lat = 35 + random.nextDouble() * 10;
            double lon = 30 + random.nextDouble() * 10;
            double velocity = 200 + random.nextDouble() * 800;
            double baroaltitude = random.nextDouble() * 10000;
            double geoaltitude = random.nextDouble() * 10000;

            aircraftList.add(new Aircraft(callsign, lat, lon, velocity, baroaltitude, geoaltitude, affiliation));
        }
    }
}
