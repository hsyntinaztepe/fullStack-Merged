package com.aewc.sim;

public class MainLauncher {
    public static void main(String[] args) {
        AircraftGenerator.generateAircrafts(30);
        new Thread(new RadarSimService()).start();
        new Thread(new IffSimService()).start();
        System.out.println("Baris kartal simulasyonu basladi: Radar, IFF ve Datalink ayni anda calisiyor");
    }
}
