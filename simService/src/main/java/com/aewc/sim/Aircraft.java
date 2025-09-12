package com.aewc.sim;

public class Aircraft {
    public String callsign;
    public double lat;
    public double lon;
    public double velocity;
    public double baroaltitude;
    public double geoaltitude;
    public String affiliation;

    public Aircraft(String callsign, double lat, double lon, double velocity, double baroaltitude, double geoaltitude, String affiliation) {
        this.callsign = callsign;
        this.lat = lat;
        this.lon = lon;
        this.velocity = velocity;
        this.baroaltitude = baroaltitude;
        this.geoaltitude = geoaltitude;
        this.affiliation = affiliation;
    }
}
