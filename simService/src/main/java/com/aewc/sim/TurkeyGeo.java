package com.aewc.sim;

import java.util.Random;

public class TurkeyGeo {
    public static final double MIN_LAT = 36.0;
    public static final double MAX_LAT = 42.2;
    public static final double MIN_LON = 26.0;
    public static final double MAX_LON = 45.0;

    private static final Random rand = new Random();

    public static double randomLat() {
        return MIN_LAT + (MAX_LAT - MIN_LAT) * rand.nextDouble();
    }

    public static double randomLon() {
        return MIN_LON + (MAX_LON - MIN_LON) * rand.nextDouble();
    }

    public static double randomVelocity() {
        return 100 + 400 * rand.nextDouble();
    }

    public static double randomAltitude() {
        return 1000 + 11000 * rand.nextDouble();
    }

    public static String randomCallsign(int idx) {
        return "C" + String.format("%03d", idx);
    }
}
