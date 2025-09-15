package com.aewc.sim;

import java.util.*;
import java.util.concurrent.ThreadLocalRandom;

public final class AircraftGenerator {

    public static final double MIN_LAT = 36.0;
    public static final double MAX_LAT = 42.2;
    public static final double MIN_LON = 26.0;
    public static final double MAX_LON = 45.0;
    public static final double MIN_VELOCITY = 100.0;
    public static final double MAX_VELOCITY = 500.0;
    public static final double MIN_BARO_ALT = 1000.0;
    public static final double MAX_BARO_ALT = 12000.0;
    public static final double MIN_GEO_ALT = 1000.0;
    public static final double MAX_GEO_ALT = 12000.0;
    public static final String DEFAULT_CALLSIGN_PREFIX = "C";
    public static final double DEFAULT_UNKNOWN_FRACTION = 0.5;
    public static final long DEFAULT_SEED = 0L;
    private static final List<Aircraft> aircraftList = Collections.synchronizedList(new ArrayList<>());

    private AircraftGenerator() {}

    public static List<Aircraft> getAircrafts() {
        synchronized (aircraftList) {
            return List.copyOf(aircraftList);
        }
    }

    public static void clear() {
        synchronized (aircraftList) {
            aircraftList.clear();
        }
    }

    public static void generateAircrafts(int count) {
        generateAircrafts(count, null, null, DEFAULT_SEED);
    }

    /**
     * Generate aircraft. Constants remain unchanged; method parameters temporarily override behavior.
     *
     * @param count           number of aircraft to create / nombre d'aéronefs à créer
     * @param unknownFraction fraction (0..1) of UNKNOWN affiliations (null -> DEFAULT_UNKNOWN_FRACTION)
     * @param callsignPrefix  prefix for FRIEND callsigns (null -> DEFAULT_CALLSIGN_PREFIX)
     * @param seed            seed for Random (0 = ThreadLocalRandom)
     */
    public static void generateAircrafts(int count, Double unknownFraction, String callsignPrefix, long seed) {
        if (count <= 0) return;

        double uf = (unknownFraction == null) ? DEFAULT_UNKNOWN_FRACTION : Math.max(0.0, Math.min(1.0, unknownFraction));
        String prefix = (callsignPrefix == null) ? DEFAULT_CALLSIGN_PREFIX : callsignPrefix;
        final Random rand = (seed == 0L) ? ThreadLocalRandom.current() : new Random(seed);

        synchronized (aircraftList) {
            if (aircraftList instanceof ArrayList) {
                ((ArrayList<Aircraft>) aircraftList).ensureCapacity(aircraftList.size() + count);
            } else {
                ArrayList<Aircraft> copy = new ArrayList<>(aircraftList.size() + count);
                copy.addAll(aircraftList);
                aircraftList.clear();
                aircraftList.addAll(copy);
            }
        }

        for (int i = 0; i < count; i++) {
            boolean isUnknown = rand.nextDouble() < uf;
            String affiliation = isUnknown ? "UNKNOWN" : "FRIEND";
            String callsign = isUnknown ? "UNKNOWN" : generateCallsign(rand, prefix);

            double lat = randomBetween(rand, MIN_LAT, MAX_LAT);
            double lon = randomBetween(rand, MIN_LON, MAX_LON);
            double velocity = randomBetween(rand, MIN_VELOCITY, MAX_VELOCITY);
            double baroalt = randomBetween(rand, MIN_BARO_ALT, MAX_BARO_ALT);
            double geoalt = randomBetween(rand, MIN_GEO_ALT, MAX_GEO_ALT);

            aircraftList.add(new Aircraft(callsign, lat, lon, velocity, baroalt, geoalt, affiliation));
        }
    }

    private static double randomBetween(Random rand, double min, double max) {
        return min + (max - min) * rand.nextDouble();
    }

    private static String generateCallsign(Random rand, String prefix) {
        char l1 = (char) ('A' + rand.nextInt(26));
        char l2 = (char) ('A' + rand.nextInt(26));
        int num = rand.nextInt(100);
        StringBuilder sb = new StringBuilder(prefix.length() + 4);
        if (!prefix.isEmpty()) sb.append(prefix);
        sb.append(l1).append(l2);
        if (num < 10) sb.append('0');
        sb.append(num);
        return sb.toString();
    }
}
